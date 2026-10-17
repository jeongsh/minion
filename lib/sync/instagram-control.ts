import { createHmac, randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getBucketName, getR2Client } from "../storage/r2.ts";

const KEY = "_control/instagram.json";
const HOUR = 60 * 60 * 1000;
type State = { owner: string; leaseUntil: number; nextRunAt: number; blockedCredential: string | null };
export interface ControlStore {
  read(): Promise<{ state: State; etag: string } | null>;
  write(state: State, etag?: string): Promise<string>;
}
const r2Store: ControlStore = {
  async read() {
    try {
      const result = await getR2Client().send(new GetObjectCommand({ Bucket: getBucketName(), Key: KEY }), { abortSignal: AbortSignal.timeout(15_000) });
      const state = JSON.parse(await result.Body!.transformToString()) as State;
      if (!result.ETag || typeof state.owner !== "string" || !Number.isFinite(state.leaseUntil) || !Number.isFinite(state.nextRunAt)
        || !(state.blockedCredential === null || typeof state.blockedCredential === "string")) throw new Error("Invalid Instagram control state");
      return { state, etag: result.ETag };
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  },
  async write(state, etag) {
    const result = await getR2Client().send(new PutObjectCommand({
      Bucket: getBucketName(), Key: KEY, Body: JSON.stringify(state), ContentType: "application/json",
      CacheControl: "no-store", ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }),
    }), { abortSignal: AbortSignal.timeout(15_000) });
    if (!result.ETag) throw new Error("Missing Instagram control ETag");
    return result.ETag;
  },
};

export type InstagramFailure = "auth" | "rate" | "transient";
export interface InstagramRun {
  beforeRequest(): void;
  fail(kind: InstagramFailure, retryAfterMs?: number): Promise<void>;
  finish(): Promise<void>;
}

// One lock for every entry point and credential in this bucket. Never retry a CAS conflict.
export async function acquireInstagramRun(store: ControlStore = r2Store, now = Date.now): Promise<InstagramRun> {
  const token = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN?.trim();
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!token || !secret) throw new Error("INSTAGRAM_CONTROL: token and R2 configuration required");
  const credential = createHmac("sha256", secret).update(token).digest("hex");
  const previous = await store.read();
  const started = now();
  if (previous?.state.blockedCredential === credential) throw new Error("INSTAGRAM_CONTROL: authentication/permission failure is blocked until credentials are replaced");
  if (previous && (previous.state.leaseUntil > started || previous.state.nextRunAt > started)) {
    throw new Error(`INSTAGRAM_CONTROL: another run or cooldown is active until ${new Date(Math.max(previous.state.leaseUntil, previous.state.nextRunAt)).toISOString()}`);
  }
  const state: State = { owner: randomUUID(), leaseUntil: started + 30 * 60_000, nextRunAt: started + HOUR, blockedCredential: null };
  let etag = await store.write(state, previous?.etag);
  let stopped = false;
  let finished = false;
  return {
    beforeRequest() {
      // Leave five minutes between the last allowed request and lease expiry.
      if (stopped || finished || now() >= started + 25 * 60_000) throw new Error("INSTAGRAM_GRAPH_STOP: run stopped or deadline exceeded");
    },
    async fail(kind, retryAfterMs = 0) {
      stopped = true;
      state.nextRunAt = Math.max(state.nextRunAt, now() + (kind === "rate" ? 24 * HOUR : HOUR), now() + retryAfterMs);
      if (kind === "auth") state.blockedCredential = credential;
      etag = await store.write(state, etag);
    },
    async finish() {
      if (finished) return;
      finished = true;
      state.leaseUntil = 0;
      await store.write(state, etag);
    },
  };
}
