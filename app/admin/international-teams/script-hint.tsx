 "use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RunState = "idle" | "running" | "done" | "error";

export function InternationalRosterScriptHint() {
  const [state, setState] = useState<RunState>("idle");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [fullMode, setFullMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
  }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("running");
    setExitCode(null);
    setLogs([]);

    try {
      const res = await fetch("/api/admin/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "sync-international-rosters", args: fullMode ? ["--full"] : [] }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setLogs((prev) => [...prev, `HTTP 오류: ${res.status}`]);
        setState("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const match = line.match(/__EXIT__:(-?\d+)/);
          if (match) {
            const code = parseInt(match[1], 10);
            setExitCode(code);
            setState(code === 0 ? "done" : "error");
          } else if (line) {
            setLogs((prev) => [...prev, line]);
          }
        }
      }

      if (buffer) {
        const match = buffer.match(/__EXIT__:(-?\d+)/);
        if (match) {
          const code = parseInt(match[1], 10);
          setExitCode(code);
          setState(code === 0 ? "done" : "error");
        } else {
          setLogs((prev) => [...prev, buffer]);
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      setLogs((prev) => [...prev, `오류: ${(error as Error).message}`]);
      setState("error");
    } finally {
      abortRef.current = null;
    }
  }, []);

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 text-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">해외팀/선수 목록 동기화 (Leaguepedia)</h2>
        <p className="text-muted">
          Leaguepedia Cargo API에서 국제대회 로스터/선수 정보를 가져와 팀/선수 목록을 DB에 반영합니다. 실행 중에는
          스크립트 실행 페이지와 동일하게 로그가 아래에 표시됩니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={fullMode}
            onChange={(e) => setFullMode(e.target.checked)}
            disabled={state === "running"}
          />
          전체 동기화 (`--full`)
        </label>
        <button
          type="button"
          onClick={state === "running" ? stop : run}
          className="rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
          disabled={false}
        >
          {state === "running" ? "실행 중... (중지)" : "해외팀/선수 동기화 실행"}
        </button>
        {state === "done" && (
          <span className="text-xs text-emerald-500">완료 (exit {exitCode ?? 0})</span>
        )}
        {state === "error" && (
          <span className="text-xs text-red-500">
            오류{exitCode !== null ? ` (exit ${exitCode})` : ""}
          </span>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
          <div ref={logContainerRef}>
            {logs.map((line, index) => (
              <div key={index} className="whitespace-pre-wrap text-foreground/80">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

