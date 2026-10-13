"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { FilterDropdown } from "@/components/match-filter-dropdown";
import { findTransferTeam, marketEvents, namuTransferUrl, TRANSFER_KIND_LABELS, TRANSFER_ROLES, type TransferEvent, type TransferMarket, type TransferTeam } from "@/lib/transfers/types";
import { removeTransferOverrideAction, saveTransferEventAction, setTransferAutoSyncAction, syncTransfersAction } from "./actions";

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-base font-normal";
const buttonClass = "min-h-10 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2 text-sm font-medium disabled:opacity-50";

export function TransferManager({ market, season, teams }: { market: TransferMarket | null; season: number; teams: TransferTeam[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<TransferEvent | null>(null);
  const [toTeamId, setToTeamId] = useState("");
  const [kind, setKind] = useState("transfer"), [role, setRole] = useState("TOP"), [provenance, setProvenance] = useState("official");
  const formRef = useRef<HTMLFormElement>(null);
  const events = market ? marketEvents(market) : [];
  const noDestination = ["leave", "retire", "inactive"].includes(kind);
  const selectedTeam = teams.find((team) => team.id === toTeamId);
  const legacyDestination = toTeamId === "legacy" ? editing?.to ?? "" : "";
  const teamOptions = [{ value: "", label: "선택 안 함" },
    ...(legacyDestination ? [{ value: "legacy", label: legacyDestination }] : []),
    ...teams.map((team) => ({ value: team.id, label: team.name })),
  ];

  function run(task: () => Promise<string>) {
    setMessage(""); setFailed(false);
    startTransition(async () => {
      try { setMessage(await task()); router.refresh(); }
      catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "작업하지 못했습니다. 다시 시도해 주세요."); router.refresh(); }
    });
  }
  function edit(event: TransferEvent | null) {
    setEditing(event); setKind(event?.kind ?? "transfer"); setRole(event?.role ?? "TOP"); setProvenance(event?.provenance ?? "official");
    setToTeamId(event?.to ? findTransferTeam(event.to, teams)?.id ?? "legacy" : "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="space-y-8">
    <section className="rounded-2xl bg-[var(--ui-card-bg)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="home-section-title text-xl font-normal">{season} 스토브리그</h2><button type="button" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => run(async () => {
        const result = await syncTransfersAction(season);
        if (result.error) throw new Error(result.error);
        return result.message;
      })}><RefreshCw size={16} className={pending ? "animate-spin" : ""} />동기화</button></div>
      <a href={namuTransferUrl(season)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">연결된 나무위키 문서</a>
      <p className="mt-3 text-base font-normal leading-7 text-[var(--ui-muted)]">문서에서 로스터와 변동 기록을 가져옵니다. 수동으로 등록하거나 수정한 기록은 유지됩니다.</p>
      {market && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-10 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={market.auto_sync} disabled={pending} onChange={(e) => { const enabled = e.target.checked; run(async () => { await setTransferAutoSyncAction(season, enabled); return enabled ? "자동 동기화를 허용했습니다." : "자동 동기화를 중지했습니다."; }); }} />자동 동기화 허용</label><span className="text-[13px] font-normal text-[var(--ui-muted)]">최근 확인 {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(market.checked_at))}</span></div>}
      <p className="mt-2 text-[13px] font-normal leading-5 text-[var(--ui-muted)]">배포된 스케줄이 9~2월에 매시간 확인합니다. 수집 실패 시 기존 데이터를 유지합니다.</p>
    </section>
    {message && <p role={failed ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-base font-normal ${failed ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-[var(--ui-card-bg)]"}`}>{message}</p>}
    {market && <>
      <form key={editing?.id ?? "new"} ref={formRef} className="scroll-mt-24 space-y-4" action={(form) => run(async () => {
        const result = await saveTransferEventAction(form);
        if (result.error) throw new Error(result.error);
        edit(null); formRef.current?.reset(); return "변동 기록을 저장했습니다.";
      })}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="home-section-title text-xl font-normal">{editing ? "변동 기록 수정" : "변동 기록 추가"}</h2>{editing && <button type="button" onClick={() => edit(null)} className={buttonClass}>수정 취소</button>}</div>
        <input type="hidden" name="season" value={season} /><input type="hidden" name="id" value={editing?.id ?? ""} />
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="role" value={role} /><input type="hidden" name="provenance" value={provenance} />
        <input type="hidden" name="toTeamId" value={noDestination ? "" : selectedTeam?.id ?? ""} /><input type="hidden" name="to" value={noDestination ? "" : selectedTeam?.name ?? legacyDestination} />
        <div className="flex flex-wrap gap-3"><FilterDropdown ariaLabel="변동 종류" selected={kind} onSelect={setKind} options={Object.entries(TRANSFER_KIND_LABELS).map(([value, label]) => ({ value, label }))} triggerTypography="ui" /><FilterDropdown ariaLabel="포지션" selected={role} onSelect={setRole} options={[...TRANSFER_ROLES, "COACH"].map((value) => ({ value, label: value === "COACH" ? "감독 / 코치" : value }))} triggerTypography="ui" /><FilterDropdown ariaLabel="확인 상태" selected={provenance} onSelect={setProvenance} options={[{ value: "official", label: "공식 발표" }, { value: "report", label: "보도" }, { value: "namuwiki", label: "나무위키" }]} triggerTypography="ui" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">선수 닉네임<input name="player" required maxLength={50} defaultValue={editing?.player} className={inputClass} /></label>
          <label className="text-sm font-medium">발표일<input name="date" type="date" required defaultValue={editing?.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())} className={inputClass} /></label>
          <label className="text-sm font-medium">이전 팀<input name="from" required maxLength={100} placeholder="T1 또는 FA" defaultValue={editing?.from} className={inputClass} /></label>
          <div className="min-w-0 text-sm font-medium"><span>새 팀</span><FilterDropdown ariaLabel="새 팀" selected={noDestination ? "" : toTeamId} onSelect={setToTeamId} options={teamOptions} disabled={pending || noDestination} triggerTypography="ui" rootClassName="mt-1" triggerClassName="min-h-11 w-full justify-between bg-[var(--ui-surface)] px-3 py-2" /></div>
          <label className="text-sm font-medium">출처 링크<input name="sourceUrl" type="url" required placeholder="https://" defaultValue={editing?.references[0] ?? editing?.sourceUrl} className={inputClass} /></label>
          <label className="text-sm font-medium">계약 종료일 (선택)<input name="contractUntil" type="date" defaultValue={editing?.contractUntil ?? ""} className={inputClass} /></label>
        </div>
        <button type="submit" disabled={pending} className={buttonClass}>변동 기록 저장</button>
      </form>
      <section><h2 className="home-section-title mb-3 text-xl font-normal">등록된 변동</h2><div className="divide-y divide-[var(--ui-card-divider)]">{events.map((event) => <article key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-base font-bold">{event.player}</span><span className="text-sm font-medium">{TRANSFER_KIND_LABELS[event.kind]}</span><span className="text-[13px] font-normal text-[var(--ui-muted)]">{event.provenance === "official" ? "공식" : event.provenance === "report" ? "보도" : "나무위키"}</span></div><p className="mt-1 text-sm font-normal text-[var(--ui-muted)]">{event.date ?? "날짜 미상"} / {event.from}{event.to && event.from !== event.to ? ` → ${event.to}` : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={pending} onClick={() => edit(event)}>수정</button>{market.manual_events.some((e) => e.id === event.id) && <button type="button" className={buttonClass} disabled={pending} onClick={() => run(async () => { await removeTransferOverrideAction(season, event.id); if (editing?.id === event.id) edit(null); return "수동 기록을 제거했습니다. 원문 기록이 있으면 다시 표시됩니다."; })}>{event.id.startsWith("wiki:") ? "원문으로 복원" : "삭제"}</button>}</div></article>)}</div>{!events.length && <p className="text-base font-normal text-[var(--ui-muted)]">등록된 변동이 없습니다.</p>}</section>
    </>}
  </div>;
}
