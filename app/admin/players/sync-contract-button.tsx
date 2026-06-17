"use client";

import { useState } from "react";
import { syncContractExpiryAction } from "./actions";

export function SyncContractButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleClick() {
    setState("loading");
    setMessage("");
    try {
      const result = await syncContractExpiryAction();
      if (result.error) {
        setState("error");
        setMessage(result.error);
      } else {
        setState("done");
        setMessage(`${result.updated}명 업데이트, ${result.skipped}명 건너뜀`);
      }
    } catch (e) {
      setState("error");
      setMessage((e as Error).message);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50"
      >
        {state === "loading" ? "동기화 중..." : "계약 업데이트"}
      </button>
      {message && (
        <span className={`text-xs ${state === "error" ? "text-red-500" : "text-muted"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
