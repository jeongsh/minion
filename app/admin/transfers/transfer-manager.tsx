"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { FilterDropdown } from "@/components/match-filter-dropdown";
import { Input } from "@/components/ui/input";
import { dialogBodyClassName, ControlledDialog, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Player } from "@/lib/types";
import { findTransferTeam, marketEvents, namuTransferUrl, normalizeTransferName, TRANSFER_KIND_LABELS, TRANSFER_ROLES, type TransferEvent, type TransferMarket, type TransferTeam } from "@/lib/transfers/types";
import { manageableRosterTags } from "@/lib/transfers/view";
import { importTransferPlayerAction, removeTransferOverrideAction, saveTransferEventAction, setRosterTagVisibilityAction, setTransferAutoSyncAction, syncTransfersAction } from "./actions";

const buttonClass = "min-h-10 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2 text-sm font-medium disabled:opacity-50";

type TransferPlayerOption = Pick<Player, "name" | "position"> & { keywords: string[] };

export function TransferManager({ market, season, teams, players }: { market: TransferMarket | null; season: number; teams: TransferTeam[]; players: TransferPlayerOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<TransferEvent | null>(null);
  const [search, setSearch] = useState("");
  const editTitleId = useId();
  const events = market ? marketEvents(market) : [];
  const query = normalizeTransferName(search);
  const filteredEvents = events.filter((event) => {
    const player = players.find((player) => normalizeTransferName(player.name) === normalizeTransferName(event.player));
    return [event.player, event.realName, ...(player?.keywords ?? [])].some((name) => normalizeTransferName(name).includes(query));
  });

  function run(task: () => Promise<string>) {
    setMessage(""); setFailed(false);
    startTransition(async () => {
      try { setMessage(await task()); router.refresh(); }
      catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "작업하지 못했습니다. 다시 시도해 주세요."); router.refresh(); }
    });
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
      <RosterTagSettings market={market} pending={pending} run={run} />
      <TransferEventForm season={season} teams={teams} players={players} />
      <ControlledDialog open={!!editing} onClose={() => setEditing(null)} labelledBy={editTitleId}>
        <DialogSheetHeader title="변동 기록 수정" titleId={editTitleId} onClose={() => setEditing(null)} />
        <div className={dialogBodyClassName}>
          {editing && <TransferEventForm key={editing.id} editing={editing} season={season} teams={teams} players={players} onSaved={() => { setEditing(null); setFailed(false); setMessage("변동 기록을 저장했습니다."); }} />}
        </div>
      </ControlledDialog>
      <section><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="home-section-title text-xl font-normal">등록된 변동</h2><SearchInput aria-label="등록된 변동 선수 검색" placeholder="선수 이름 검색" value={search} onChange={(event) => setSearch(event.target.value)} containerClassName="basis-full sm:basis-auto sm:max-w-xs" /></div><div className="divide-y divide-[var(--ui-card-divider)]">{filteredEvents.map((event) => <article key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-base font-bold">{event.player}</span><span className="text-sm font-medium">{TRANSFER_KIND_LABELS[event.kind]}</span><span className="text-[13px] font-normal text-[var(--ui-muted)]">{event.provenance === "official" ? "공식" : event.provenance === "report" ? "거피셜" : event.provenance === "rumor" ? "루머" : "나무위키"}</span></div><p className="mt-1 text-sm font-normal text-[var(--ui-muted)]">{event.date ?? "날짜 미상"} / {event.from}{event.to && event.from !== event.to ? ` → ${event.to}` : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={pending} onClick={() => setEditing(event)}>수정</button>{market.manual_events.some((e) => e.id === event.id) && <button type="button" className={buttonClass} disabled={pending} onClick={() => run(async () => { const result = await removeTransferOverrideAction(season, event.id); if (result.error) throw new Error(result.error); if (editing?.id === event.id) setEditing(null); return "수동 기록을 제거했습니다. 원문 기록이 있으면 다시 표시됩니다."; })}>{event.id.startsWith("wiki:") ? "원문으로 복원" : "삭제"}</button>}</div></article>)}</div>{!filteredEvents.length && <p className="text-base font-normal text-[var(--ui-muted)]">{query ? "검색 결과가 없습니다." : "등록된 변동이 없습니다."}</p>}</section>
    </>}
  </div>;
}

function RosterTagSettings({ market, pending, run }: {
  market: TransferMarket;
  pending: boolean;
  run: (task: () => Promise<string>) => void;
}) {
  const [search, setSearch] = useState("");
  const tags = useMemo(() => manageableRosterTags(market), [market]);
  const query = normalizeTransferName(search);
  const matches = tags.filter(({ person, team, label }) =>
    [person.name, person.realName, team, label].some((value) => normalizeTransferName(value).includes(query)),
  );

  function changeVisibility(key: string | null, visible: boolean) {
    run(async () => {
      await setRosterTagVisibilityAction(market.season, key, visible);
      return visible ? "로스터 태그를 표시했습니다." : "로스터 태그를 숨겼습니다.";
    });
  }

  return <section aria-label="팀별 로스터 태그">
    <SectionHeading>팀별 로스터 태그</SectionHeading>
    {tags.length ? <>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending || tags.every((tag) => tag.hidden)} onClick={() => changeVisibility(null, false)}>전체 숨기기</Button>
        <Button variant="secondary" disabled={pending || tags.every((tag) => !tag.hidden)} onClick={() => changeVisibility(null, true)}>전체 표시</Button>
      </div>
      <details className="mt-2">
        <summary className="text-sm font-medium min-h-10 cursor-pointer py-2.5">선수별 태그 설정</summary>
        <SearchInput aria-label="로스터 태그 검색" placeholder="선수 이름 또는 팀 검색" value={search} onChange={(event) => setSearch(event.target.value)} containerClassName="my-2 sm:max-w-xs" />
        <ul className="divide-y divide-[var(--ui-card-divider)]">
          {matches.map(({ key, label, team, person, hidden }) => <li key={key}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
              <input type="checkbox" checked={!hidden} disabled={pending} onChange={(event) => changeVisibility(key, event.target.checked)} className="size-4 shrink-0 accent-[var(--accent)]" />
              <span className="text-[15px] font-bold min-w-0 break-words">{person.name}</span>
              <span className="text-[13px] leading-5 text-[var(--ui-muted)]">{team}</span>
              <span className="text-[13px] leading-5 shrink-0 text-[var(--ui-muted)]">{label}</span>
            </label>
          </li>)}
        </ul>
        {!matches.length && <p className="text-sm leading-6 md:text-base py-2 text-[var(--ui-muted)]">검색 결과가 없습니다.</p>}
      </details>
    </> : <p className="text-sm leading-6 md:text-base text-[var(--ui-muted)]">설정할 로스터 태그가 없습니다.</p>}
  </section>;
}

function TransferEventForm({ editing = null, season, teams, players, onSaved }: {
  editing?: TransferEvent | null;
  season: number;
  teams: TransferTeam[];
  players: TransferPlayerOption[];
  onSaved?: () => void;
}) {
  const inputClass = `mt-1 min-h-11 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 font-normal ${editing ? "text-sm" : "text-base"}`;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const importId = useId();
  const [playerName, setPlayerName] = useState(() => editing ? players.find((player) => normalizeTransferName(player.name) === normalizeTransferName(editing.player))?.name ?? editing.player : "");
  const [addedPlayers, setAddedPlayers] = useState<TransferPlayerOption[]>([]);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [leaguepediaInput, setLeaguepediaInput] = useState("");
  const availablePlayers = [...players.filter((player) => !addedPlayers.some((added) => normalizeTransferName(added.name) === normalizeTransferName(player.name))), ...addedPlayers];
  const [toTeamId, setToTeamId] = useState(editing?.to ? findTransferTeam(editing.to, teams)?.id ?? "legacy" : "");
  const previousTeam = editing?.kind === "return" && editing.from === "은퇴" ? "" : editing?.from ?? "";
  const [fromTeamId, setFromTeamId] = useState(previousTeam ? findTransferTeam(previousTeam, teams)?.id ?? "custom" : "");
  const [customFrom, setCustomFrom] = useState(previousTeam);
  const [kind, setKind] = useState<string>(editing?.kind ?? "transfer"), [role, setRole] = useState<string>(editing?.role ?? "TOP"), [provenance, setProvenance] = useState<string>(editing?.provenance ?? "official");
  const formRef = useRef<HTMLFormElement>(null);
  const noDestination = ["leave", "retire", "inactive"].includes(kind);
  const selectedTeam = teams.find((team) => team.id === toTeamId);
  const legacyDestination = toTeamId === "legacy" ? editing?.to ?? "" : "";
  const teamOptions = [{ value: "", label: "선택 안 함" },
    ...(legacyDestination ? [{ value: "legacy", label: legacyDestination }] : []),
    ...teams.map((team) => ({ value: team.id, label: team.name, keywords: [team.short_name, ...team.aliases] })),
  ];
  const fromOptions = [{ value: "", label: "선택 안 함" },
    ...teams.map((team) => ({ value: team.id, label: team.name, keywords: [team.short_name, ...team.aliases] })),
    { value: "custom", label: "직접 입력" },
  ];
  const fromTeam = teams.find((team) => team.id === fromTeamId);
  const playerOptions = [{ value: "", label: "선수 선택" },
    ...(editing && editing.role === role && !availablePlayers.some((player) => normalizeTransferName(player.name) === normalizeTransferName(editing.player)) ? [{ value: editing.player, label: editing.player }] : []),
    ...availablePlayers.filter((player) => player.position === role).map((player) => ({ value: player.name, label: player.name, keywords: player.keywords })),
  ];

  function selectRole(next: string) {
    setRole(next);
    if (next !== role) setPlayerName("");
    setAddingPlayer(false);
  }

  function run(task: () => Promise<string>) {
    setMessage(""); setFailed(false);
    startTransition(async () => {
      try { setMessage(await task()); router.refresh(); }
      catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "작업하지 못했습니다. 다시 시도해 주세요."); router.refresh(); }
    });
  }
  return (
      <form ref={formRef} className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        run(async () => {
          const result = await saveTransferEventAction(form);
          if (result.error) throw new Error(result.error);
          setPlayerName(""); setKind("transfer"); setRole("TOP"); setProvenance("official");
          setToTeamId(""); setFromTeamId(""); setCustomFrom(""); setAddingPlayer(false); setLeaguepediaInput("");
          formRef.current?.reset(); onSaved?.(); return "변동 기록을 저장했습니다.";
        });
      }}>
        {!editing && <h2 className="home-section-title text-xl font-normal">변동 기록 추가</h2>}
        {message && <p role={failed ? "alert" : "status"} className={`font-normal ${editing ? "text-sm" : "text-base"} ${failed ? "text-red-700 dark:text-red-300" : "text-[var(--ui-muted)]"}`}>{message}</p>}
        <input type="hidden" name="season" value={season} /><input type="hidden" name="id" value={editing?.id ?? ""} />
        <input type="hidden" name="player" value={playerName} />
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="role" value={role} /><input type="hidden" name="provenance" value={provenance} />
        <input type="hidden" name="toTeamId" value={noDestination ? "" : selectedTeam?.id ?? ""} /><input type="hidden" name="to" value={noDestination ? "" : selectedTeam?.name ?? legacyDestination} />
        {fromTeamId !== "custom" && <input type="hidden" name="from" value={fromTeam?.name ?? ""} />}
        <div className="flex flex-wrap gap-3"><FilterDropdown ariaLabel="변동 종류" selected={kind} onSelect={setKind} options={Object.entries(TRANSFER_KIND_LABELS).map(([value, label]) => ({ value, label }))} triggerTypography="ui" /><FilterDropdown ariaLabel="포지션" selected={role} onSelect={selectRole} options={[...TRANSFER_ROLES, "COACH"].map((value) => ({ value, label: value === "COACH" ? "감독 / 코치" : value }))} triggerTypography="ui" /><FilterDropdown ariaLabel="확인 상태" selected={provenance} onSelect={setProvenance} options={[{ value: "official", label: "공식 발표" }, { value: "report", label: "거피셜" }, { value: "rumor", label: "루머" }, { value: "namuwiki", label: "나무위키" }]} triggerTypography="ui" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 text-sm font-medium">
            {role === "COACH" ? <label>감독 / 코치 이름<Input aria-label="감독 / 코치 이름" value={playerName} onChange={(event) => setPlayerName(event.target.value)} required maxLength={50} disabled={pending} className="mt-1" /></label> : <>
              <span>선수 닉네임</span>
              <div className="mt-1 flex items-center gap-2">
                <FilterDropdown ariaLabel="선수 선택" selected={playerName} onSelect={setPlayerName} options={playerOptions} searchable searchPlaceholder="닉네임 또는 이름 검색" disabled={pending} triggerTypography="ui" rootClassName="min-w-0 flex-1" triggerClassName="w-full justify-between bg-[var(--ui-surface)] px-3 py-2" />
                <button type="button" aria-expanded={addingPlayer} aria-controls={importId} disabled={pending} onClick={() => setAddingPlayer(!addingPlayer)} className="min-h-10 shrink-0 text-sm font-medium underline underline-offset-4">{addingPlayer ? "추가 취소" : "새 선수 추가"}</button>
              </div>
              {addingPlayer && <div id={importId} className="mt-3 space-y-2">
                <label className="block">리그피디아 닉네임 또는 문서 링크<Input value={leaguepediaInput} onChange={(event) => setLeaguepediaInput(event.target.value)} maxLength={1000} disabled={pending} className="mt-1" onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /></label>
                <Button disabled={pending || !leaguepediaInput.trim()} onClick={() => run(async () => {
                  const result = await importTransferPlayerAction(leaguepediaInput);
                  if (!result.player) throw new Error(result.error);
                  const player = result.player;
                  setAddedPlayers((previous) => [...previous.filter((entry) => normalizeTransferName(entry.name) !== normalizeTransferName(player.name)), player]);
                  setRole(player.position); setPlayerName(player.name); setAddingPlayer(false); setLeaguepediaInput("");
                  return `${player.name} 선수 정보를 가져왔습니다.`;
                })}>{pending ? "가져오는 중…" : "가져와 추가"}</Button>
              </div>}
            </>}
          </div>
          <label className="text-sm font-medium">발표일<input name="date" type="date" required defaultValue={editing?.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())} className={inputClass} /></label>
          <div className="min-w-0 text-sm font-medium"><span>{kind === "return" ? "이전 팀 (선택)" : "이전 팀"}</span><FilterDropdown ariaLabel="이전 팀" selected={fromTeamId} onSelect={setFromTeamId} options={fromOptions} searchable searchPlaceholder="팀 검색" disabled={pending} triggerTypography="ui" rootClassName="mt-1" triggerClassName="w-full justify-between bg-[var(--ui-surface)] px-3 py-2" />{fromTeamId === "custom" && <input name="from" aria-label="이전 팀 직접 입력" required maxLength={100} placeholder="팀명 또는 FA" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} disabled={pending} className={inputClass} />}</div>
          <div className="min-w-0 text-sm font-medium"><span>새 팀</span><FilterDropdown ariaLabel="새 팀" selected={noDestination ? "" : toTeamId} onSelect={setToTeamId} options={teamOptions} searchable searchPlaceholder="팀 검색" disabled={pending || noDestination} triggerTypography="ui" rootClassName="mt-1" triggerClassName="w-full justify-between bg-[var(--ui-surface)] px-3 py-2" /></div>
          <label className="text-sm font-medium">출처 링크 (선택)<input name="sourceUrl" type="url" placeholder="https://" defaultValue={editing?.references[0] ?? editing?.sourceUrl} className={inputClass} /></label>
          <label className="text-sm font-medium">계약 종료일 (선택)<input name="contractUntil" type="date" defaultValue={editing?.contractUntil ?? ""} className={inputClass} /></label>
        </div>
        <button type="submit" disabled={pending || !playerName.trim()} className={buttonClass}>변동 기록 저장</button>
      </form>
  );
}
