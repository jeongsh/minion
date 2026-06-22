"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── 스크립트 정의 ─────────────────────────────────────────────

type ScriptArgFlag = { type?: "flag"; flag: string; label: string };
type ScriptArgInput = {
  type: "input";
  name: string;
  label: string;
  default: string;
  inputType?: "number" | "text";
  min?: number;
  max?: number;
};
type ScriptArg = ScriptArgFlag | ScriptArgInput;

type ScriptDef = {
  id: string;
  label: string;
  description: string;
  args?: ScriptArg[];
  defaultAutoArgs?: string[];
};

const SCRIPTS: ScriptDef[] = [
  {
    id: "backfill-timeline-events",
    label: "타임라인 이벤트 백필",
    description: "Leaguepedia PostgameJsonMetadata에서 게임 타임라인(킬/오브젝트/포탑)을 가져와 저장합니다.",
    args: [{ flag: "--force", label: "전체 덮어쓰기 (--force)" }],
  },
  {
    id: "backfill-items-spells-runes",
    label: "아이템·스펠·룬 백필",
    description: "set_player_stats에서 아이템/스펠/룬 컬럼이 비어있는 행을 채웁니다.",
    args: [{ flag: "--force", label: "전체 덮어쓰기 (--force)" }],
  },
  {
    id: "backfill-leaguepedia-sets",
    label: "세트 데이터 백필",
    description:
      "Leaguepedia에서 세트(게임) 통계를 동기화합니다. 기본은 세트가 없는 경기만 처리하고, --force 시 기존 세트 통계도 덮어씁니다.",
    args: [{ flag: "--force", label: "기존 세트 포함 전체 동기화 (--force)" }],
  },
  {
    id: "backfill-leaguepedia-set-picks-bans",
    label: "밴픽 백필",
    description: "Leaguepedia에서 밴픽 데이터를 가져와 저장합니다.",
    args: [{ type: "flag", flag: "--force", label: "전체 덮어쓰기 (--force)" }],
  },
  {
    id: "backfill-leaguepedia-set-ids",
    label: "세트 ID 백필",
    description: "세트의 Leaguepedia Game ID를 채웁니다.",
    args: [{ type: "flag", flag: "--force", label: "전체 덮어쓰기 (--force)" }],
  },
  {
    id: "sync-leaguepedia-lck",
    label: "LCK 동기화",
    description: "Leaguepedia에서 LCK 시즌 경기 일정/결과를 동기화합니다.",
    args: [
      { type: "input", name: "year", label: "연도", default: String(new Date().getFullYear()), inputType: "number", min: 2020, max: 2099 },
      { type: "flag", flag: "--full", label: "전체 재동기화 (--full)" },
    ],
  },
  {
    id: "sync-career-history",
    label: "선수 경력 동기화",
    description: "선수들의 팀 이동 이력을 동기화합니다.",
    args: [{ type: "flag", flag: "--force", label: "전체 덮어쓰기 (--force)" }],
  },
  {
    id: "sync-player-images",
    label: "선수 이미지 동기화",
    description: "Leaguepedia에서 선수 프로필 이미지 URL을 동기화합니다.",
    args: [{ type: "flag", flag: "--force", label: "전체 덮어쓰기 (--force)" }],
  },
  {
    id: "sync-youtube-videos",
    label: "YouTube videos",
    description: "Sync 2026 YouTube videos for team and current player fan pages.",
    args: [
      { type: "input", name: "since", label: "since", default: "2026-01-01", inputType: "text" },
      { type: "flag", flag: "--dry-run", label: "dry run (--dry-run)" },
    ],
  },
  {
    id: "subscribe-youtube-webhooks",
    label: "YouTube webhook subscribe",
    description: "Subscribe team and player YouTube feeds to the configured public webhook callback.",
    args: [{ type: "flag", flag: "--unsubscribe", label: "unsubscribe (--unsubscribe)" }],
  },
  {
    id: "sync-pom",
    label: "POM 동기화",
    description: "공식 Player of the Match 데이터를 동기화합니다.",
    args: [{ type: "flag", flag: "--force", label: "전체 덮어쓰기 (--force)" }],
  },
  {
    id: "sync-staff",
    label: "스태프 동기화",
    description: "감독/코치 정보를 동기화합니다.",
    args: [{ type: "flag", flag: "--force", label: "전체 덮어쓰기 (--force)" }],
  },
];

// ─── 단일 스크립트 패널 ─────────────────────────────────────────

type RunState = "idle" | "running" | "done" | "error";

function ScriptPanel({ script }: { script: ScriptDef }) {
  const [state, setState] = useState<RunState>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [checkedArgs, setCheckedArgs] = useState<Set<string>>(new Set());
  const [inputArgs, setInputArgs] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const arg of script.args ?? []) {
      if (arg.type === "input") defaults[arg.name] = arg.default;
    }
    return defaults;
  });
  const [autoRetry, setAutoRetry] = useState(false);
  const [retryIntervalSec, setRetryIntervalSec] = useState(60);
  const [countdown, setCountdown] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 로그 자동 스크롤
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const startCountdown = useCallback((seconds: number, onDone: () => void) => {
    setCountdown(seconds);
    let remaining = seconds;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        onDone();
      }
    }, 1000);
  }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(0);

    const controller = new AbortController();
    abortRef.current = controller;

    setState("running");
    setLogs([]);
    setExitCode(null);

    const args = [
      ...Object.entries(inputArgs).map(([k, v]) => `--${k}=${v}`),
      ...checkedArgs,
    ];

    try {
      const res = await fetch("/api/admin/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.id, args }),
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
          const exitMatch = line.match(/__EXIT__:(-?\d+)/);
          if (exitMatch) {
            const code = parseInt(exitMatch[1], 10);
            setExitCode(code);
            setState(code === 0 ? "done" : "error");
          } else if (line) {
            setLogs((prev) => [...prev, line]);
          }
        }
      }

      if (buffer) {
        const exitMatch = buffer.match(/__EXIT__:(-?\d+)/);
        if (exitMatch) {
          const code = parseInt(exitMatch[1], 10);
          setExitCode(code);
          setState(code === 0 ? "done" : "error");
        } else if (buffer) {
          setLogs((prev) => [...prev, buffer]);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setLogs((prev) => [...prev, `오류: ${(err as Error).message}`]);
        setState("error");
      } else {
        setState("idle");
        return;
      }
    }

    // 자동 재실행
    if (autoRetry) {
      startCountdown(retryIntervalSec, run);
    }
  }, [script.id, checkedArgs, autoRetry, retryIntervalSec, startCountdown]);

  const stop = () => {
    abortRef.current?.abort();
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(0);
    setState("idle");
  };

  const stateColor: Record<RunState, string> = {
    idle: "text-muted",
    running: "text-yellow-500",
    done: "text-green-500",
    error: "text-red-500",
  };
  const stateLabel: Record<RunState, string> = {
    idle: "대기",
    running: "실행 중",
    done: "완료",
    error: "오류",
  };

  return (
    <div className="rounded-md border border-border bg-surface">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{script.label}</h3>
            <span className={`text-xs font-semibold ${stateColor[state]}`}>
              {state === "running" ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
                  실행 중
                </span>
              ) : stateLabel[state]}
            </span>
            {exitCode !== null && state !== "running" && (
              <span className={`text-xs ${exitCode === 0 ? "text-green-500" : "text-red-500"}`}>
                (exit {exitCode})
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">{script.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {state === "running" ? (
            <button
              type="button"
              onClick={stop}
              className="rounded border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/20"
            >
              중지
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              disabled={countdown > 0}
              className="rounded bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50 hover:opacity-80"
            >
              {countdown > 0 ? `${countdown}초 후 재실행` : "실행"}
            </button>
          )}
          {countdown > 0 && (
            <button
              type="button"
              onClick={stop}
              className="rounded border border-border px-2 py-1.5 text-xs text-muted hover:bg-surface-muted"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {/* 옵션 */}
      <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-2">
        {script.args?.map((arg) => {
          if (arg.type === "input") {
            return (
              <div key={arg.name} className="flex items-center gap-1.5 text-xs">
                <span className="text-muted">{arg.label}</span>
                <input
                  type={arg.inputType ?? "text"}
                  min={arg.min}
                  max={arg.max}
                  value={inputArgs[arg.name] ?? arg.default}
                  onChange={(e) =>
                    setInputArgs((prev) => ({ ...prev, [arg.name]: e.target.value }))
                  }
                  className="w-20 rounded border border-border bg-background px-2 py-0.5 text-center text-xs"
                />
              </div>
            );
          }
          const flag = (arg as ScriptArgFlag).flag;
          return (
            <label key={flag} className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={checkedArgs.has(flag)}
                onChange={(e) => {
                  setCheckedArgs((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(flag);
                    else next.delete(flag);
                    return next;
                  });
                }}
                className="rounded"
              />
              <span>{arg.label}</span>
            </label>
          );
        })}

        {/* 자동 재실행 */}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={autoRetry}
            onChange={(e) => setAutoRetry(e.target.checked)}
            className="rounded"
          />
          <span>자동 재실행</span>
        </label>
        {autoRetry && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted">간격</span>
            <input
              type="number"
              min={10}
              max={3600}
              value={retryIntervalSec}
              onChange={(e) => setRetryIntervalSec(Math.max(10, parseInt(e.target.value) || 60))}
              className="w-16 rounded border border-border bg-background px-2 py-0.5 text-center text-xs"
            />
            <span className="text-muted">초</span>
          </div>
        )}
      </div>

      {/* 로그 */}
      {logs.length > 0 && (
        <div className="border-t border-border">
          <div className="max-h-48 overflow-y-auto bg-background p-3 font-mono text-[11px] leading-relaxed">
            {logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap text-foreground/80">{line}</div>
            ))}
            <div ref={logEndRef} />
          </div>
          <div className="flex justify-end border-t border-border px-3 py-1">
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-[10px] text-muted hover:text-foreground"
            >
              로그 지우기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 컴포넌트 ──────────────────────────────────────

export function ScriptsRunner() {
  return (
    <div className="flex flex-col gap-3">
      {SCRIPTS.map((script) => (
        <ScriptPanel key={script.id} script={script} />
      ))}
    </div>
  );
}
