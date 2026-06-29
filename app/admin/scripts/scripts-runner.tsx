"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── 데이터 정의 ──────────────────────────────────────────────

const LEAGUE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "lck", label: "LCK 전체" },
  { value: "lck-cup", label: "LCK Cup" },
  { value: "first-stand", label: "First Stand" },
  { value: "msi", label: "MSI" },
  { value: "ewc", label: "EWC" },
  { value: "worlds", label: "Worlds" },
  { value: "enc", label: "ENC" },
  { value: "international", label: "국제대회 전체" },
];

type RunState = "idle" | "running" | "done" | "error";

type ScriptEntry = {
  id: string;
  label: string;
  addYear?: boolean;
  addSegment?: boolean;
  staticArgs?: string[];
};

type GroupDef = {
  id: string;
  label: string;
  scripts: ScriptEntry[];
  sharedFlag?: string;
  showSegment?: boolean;
  showYear?: boolean;
};

const GROUPS: GroupDef[] = [
  {
    id: "tournament",
    label: "대회 동기화",
    sharedFlag: "--full",
    showYear: true,
    scripts: [
      { id: "sync-leaguepedia-lck", label: "LCK", addYear: true },
      { id: "sync-international-matches", label: "국제대회" },
    ],
  },
  {
    id: "sns",
    label: "SNS 동기화",
    scripts: [
      { id: "sync-youtube-videos", label: "유튜브 비디오" },
      { id: "subscribe-youtube-webhooks", label: "유튜브 웹훅" },
      { id: "sync-instagram", label: "인스타그램" },
    ],
  },
  {
    id: "player",
    label: "선수 동기화",
    sharedFlag: "--force",
    scripts: [
      { id: "sync-career-history", label: "경력" },
      { id: "sync-player-images", label: "이미지" },
    ],
  },
  {
    id: "misc",
    label: "기타",
    sharedFlag: "--force",
    scripts: [
      { id: "sync-staff", label: "스태프" },
      { id: "sync-pom", label: "POM" },
      { id: "sync-lck-awards", label: "팀 수상" },
    ],
  },
  {
    id: "match",
    label: "경기 동기화",
    sharedFlag: "--force",
    showSegment: true,
    scripts: [
      { id: "backfill-timeline-events", label: "타임라인", addSegment: true },
      { id: "backfill-leaguepedia-sets", label: "세트", addSegment: true },
      { id: "backfill-leaguepedia-set-ids", label: "세트 ID", addSegment: true },
    ],
  },
];

// ─── GroupPanel ────────────────────────────────────────────────

type ScriptInfo = { state: RunState; exitCode: number | null };

function GroupPanel({ group }: { group: GroupDef }) {
  const [flagChecked, setFlagChecked] = useState(false);
  const [autoRetry, setAutoRetry] = useState(false);
  const [retryIntervalSec, setRetryIntervalSec] = useState(60);
  const [segment, setSegment] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [scriptInfos, setScriptInfos] = useState<Record<string, ScriptInfo>>(() =>
    Object.fromEntries(group.scripts.map((s) => [s.id, { state: "idle", exitCode: null }])),
  );
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

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

  const stopAll = useCallback(() => {
    abortRef.current?.abort();
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(0);
    setActiveScriptId((prev) => {
      if (prev) {
        setScriptInfos((infos) => ({ ...infos, [prev]: { state: "idle", exitCode: null } }));
      }
      return null;
    });
  }, []);

  const runScript = useCallback(
    async (script: ScriptEntry) => {
      abortRef.current?.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setCountdown(0);

      const controller = new AbortController();
      abortRef.current = controller;

      setActiveScriptId(script.id);
      setLogs([]);
      setScriptInfos((prev) => ({ ...prev, [script.id]: { state: "running", exitCode: null } }));

      const args: string[] = [];
      if (group.sharedFlag && flagChecked) args.push(group.sharedFlag);
      if (script.addYear && year) args.push(`--year=${year}`);
      if (script.addSegment && segment) args.push(`--segment=${segment}`);
      if (script.staticArgs) args.push(...script.staticArgs);

      const setInfo = (state: RunState, exitCode: number | null) =>
        setScriptInfos((prev) => ({ ...prev, [script.id]: { state, exitCode } }));

      try {
        const res = await fetch("/api/admin/run-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: script.id, args }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setLogs((prev) => [...prev, `HTTP 오류: ${res.status}`]);
          setInfo("error", null);
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
            const m = line.match(/__EXIT__:(-?\d+)/);
            if (m) {
              const code = parseInt(m[1], 10);
              setInfo(code === 0 ? "done" : "error", code);
            } else if (line) {
              setLogs((prev) => [...prev, line]);
            }
          }
        }
        if (buffer) {
          const m = buffer.match(/__EXIT__:(-?\d+)/);
          if (m) {
            const code = parseInt(m[1], 10);
            setInfo(code === 0 ? "done" : "error", code);
          } else if (buffer) {
            setLogs((prev) => [...prev, buffer]);
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLogs((prev) => [...prev, `오류: ${(err as Error).message}`]);
          setInfo("error", null);
        } else {
          setInfo("idle", null);
          return;
        }
      }

      if (autoRetry) {
        startCountdown(retryIntervalSec, () => runScript(script));
      }
    },
    [group.sharedFlag, flagChecked, year, segment, autoRetry, retryIntervalSec, startCountdown],
  );

  const anyRunning = Object.values(scriptInfos).some((s) => s.state === "running");

  const flagLabel =
    group.sharedFlag === "--full" ? "전체 재동기화 (--full)" : "전체 덮어쓰기 (--force)";

  const btnClass = (state: RunState, isActive: boolean): string => {
    if (state === "running") return "border-yellow-500/40 bg-yellow-500/10 text-yellow-500";
    if (state === "done") return "border-green-500/40 bg-green-500/10 text-green-500";
    if (state === "error") return "border-red-500/40 bg-red-500/10 text-red-500";
    if (anyRunning && !isActive) return "border-border bg-surface text-muted opacity-40 cursor-not-allowed";
    return "border-border bg-surface text-foreground hover:bg-surface-muted";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-surface-muted/50 px-5 py-3">
        <h3 className="text-sm font-semibold tracking-wide">{group.label}</h3>
        {anyRunning && (
          <button
            type="button"
            onClick={stopAll}
            className="rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-500/20"
          >
            중지
          </button>
        )}
      </div>

      {/* 옵션 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-2.5 text-xs text-muted">
        {group.showSegment && (
          <div className="flex items-center gap-1.5">
            <span>리그</span>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
            >
              {LEAGUE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
        {group.showYear && (
          <div className="flex items-center gap-1.5">
            <span>연도</span>
            <input
              type="number"
              min={2020}
              max={2099}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-20 rounded border border-border bg-background px-2 py-0.5 text-center text-xs text-foreground"
            />
          </div>
        )}
        {group.sharedFlag && (
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={flagChecked}
              onChange={(e) => setFlagChecked(e.target.checked)}
              className="rounded"
            />
            <span>{flagLabel}</span>
          </label>
        )}
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={autoRetry}
            onChange={(e) => setAutoRetry(e.target.checked)}
            className="rounded"
          />
          <span>자동 재실행</span>
        </label>
        {autoRetry && (
          <div className="flex items-center gap-1.5">
            <span>간격</span>
            <input
              type="number"
              min={10}
              max={3600}
              value={retryIntervalSec}
              onChange={(e) => setRetryIntervalSec(Math.max(10, parseInt(e.target.value) || 60))}
              className="w-16 rounded border border-border bg-background px-2 py-0.5 text-center text-xs text-foreground"
            />
            <span>초</span>
          </div>
        )}
      </div>

      {/* 스크립트 버튼 */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        {group.scripts.map((script) => {
          const info = scriptInfos[script.id];
          const isActive = activeScriptId === script.id;
          return (
            <button
              key={script.id}
              type="button"
              disabled={anyRunning && !isActive}
              onClick={() => (isActive && info.state === "running" ? stopAll() : runScript(script))}
              className={`flex items-center gap-2 rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${btnClass(info.state, isActive)}`}
            >
              {info.state === "running" && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
              )}
              {script.label}
              {info.state === "done" && (
                <span className="text-[10px] opacity-60">완료</span>
              )}
              {info.state === "error" && (
                <span className="text-[10px] opacity-60">
                  오류{info.exitCode !== null ? ` (${info.exitCode})` : ""}
                </span>
              )}
            </button>
          );
        })}
        {countdown > 0 && (
          <button
            type="button"
            onClick={stopAll}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-muted"
          >
            {countdown}초 후 재실행 · 취소
          </button>
        )}
      </div>

      {/* 로그 */}
      {logs.length > 0 && (
        <div className="border-t border-border">
          <div
            ref={logContainerRef}
            className="max-h-48 overflow-y-auto bg-background p-3 font-mono text-[11px] leading-relaxed"
          >
            {logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap text-foreground/80">{line}</div>
            ))}
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

// ─── 메인 ─────────────────────────────────────────────────────

export function ScriptsRunner() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GroupPanel group={GROUPS[0]} /> {/* 대회 */}
      <GroupPanel group={GROUPS[1]} /> {/* SNS */}
      <GroupPanel group={GROUPS[2]} /> {/* 선수 */}
      <GroupPanel group={GROUPS[3]} /> {/* 기타 */}
      <div className="lg:col-span-2">
        <GroupPanel group={GROUPS[4]} /> {/* 경기 (전체 너비) */}
      </div>
    </div>
  );
}
