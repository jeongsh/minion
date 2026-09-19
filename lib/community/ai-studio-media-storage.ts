import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { normalizeStudioSourceUrl } from "./ai-studio-source-url.ts";
import { parseStudioMedia, type StudioMedia } from "./ai-studio-media.ts";
import { validateCommunityImage } from "./upload-security.ts";

function publicIp(address: string): boolean {
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0):/i.test(address);
  if (isIP(address) !== 4) return false;
  const [a,b] = address.split(".").map(Number);
  return ![0,10,127].includes(a) && a < 224 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && [18,19].includes(b));
}

/** DNS is resolved, checked and pinned for each HTTPS hop to prevent SSRF/rebinding. */
export async function downloadStudioMedia(raw: string, maxBytes = 32 * 1024 * 1024, hops = 0, htmlOnly = false): Promise<{ bytes: Buffer; contentType: string }> {
  const url = new URL(normalizeStudioSourceUrl(raw));
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([lookup(url.hostname, { all: true }), new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error("주소 조회 시간이 초과되었습니다.")), 5000); })]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(item => !publicIp(item.address))) throw new Error("공개 미디어 주소만 사용할 수 있습니다.");
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", lookup: (_host, options, callback) => {
      if (options.all) callback(null, [pinned]); else callback(null, pinned.address, pinned.family);
    } }, response => {
      if ([301,302,303,307,308].includes(response.statusCode ?? 0) && response.headers.location) {
        response.resume();
        if (hops >= 2) { reject(new Error("미디어 주소 이동이 너무 많습니다.")); return; }
        downloadStudioMedia(new URL(response.headers.location, url).href, maxBytes, hops + 1, htmlOnly).then(resolve, reject); return;
      }
      const contentType = (response.headers["content-type"] ?? "").split(";")[0].trim();
      const accepted = htmlOnly ? contentType === "text/html" : /^(?:image\/(?:jpeg|png|webp|gif)|video\/(?:mp4|webm))$/.test(contentType);
      if (response.statusCode !== 200 || !accepted || Number(response.headers["content-length"]) > maxBytes) { response.destroy(); reject(new Error("지원되는 공개 파일을 가져오지 못했습니다.")); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > maxBytes) { response.destroy(new Error("미디어 파일이 너무 큽니다.")); return; } chunks.push(chunk); });
      response.on("error", reject);
      response.on("end", () => resolve({ bytes: Buffer.concat(chunks), contentType }));
    });
    const timer = setTimeout(() => req.destroy(new Error("미디어 다운로드 시간이 초과되었습니다.")), 20_000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject); req.end();
  });
}

export async function archiveStudioMedia(items: StudioMedia[]): Promise<StudioMedia[]> {
  const client = createSupabaseAdminClient();
  const output: StudioMedia[] = [];
  for (const item of parseStudioMedia(items)) {
    if (!["image", "video"].includes(item.kind)) { output.push(item); continue; }
    const { bytes, contentType } = await downloadStudioMedia(item.url);
    if (item.kind === "image") {
      if (!validateCommunityImage(bytes, contentType).ok) throw new Error("첨부 이미지 검증에 실패했습니다.");
    } else if (!(contentType === "video/mp4" && bytes.toString("ascii", 4, 8) === "ftyp") && !(contentType === "video/webm" && bytes.subarray(0,4).toString("hex") === "1a45dfa3")) throw new Error("첨부 영상 검증에 실패했습니다.");
    const extension = contentType.split("/")[1];
    const path = `studio/${createHash("sha256").update(bytes).digest("hex")}.${extension}`;
    const uploaded = await client.storage.from("community-ai-media").upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
    if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) throw new Error("첨부 파일 저장에 실패했습니다.");
    output.push({ ...item, url: client.storage.from("community-ai-media").getPublicUrl(path).data.publicUrl });
  }
  return output;
}
