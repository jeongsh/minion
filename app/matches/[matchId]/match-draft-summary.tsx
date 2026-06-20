import Image from "next/image";
import Link from "next/link";

import { championImage, championLabel } from "@/lib/champions";
import type { Champion, Match, SetPickBan, SetResult, Team } from "@/lib/types";
import { durationLabel, setHref, teamLabel } from "@/lib/view-data";

function DraftIcon({
  champion,
  ban = false,
}: {
  champion?: Champion;
  ban?: boolean;
}) {
  const image = championImage(champion);

  return (
    <div
      className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-background"
      title={championLabel(champion)}
    >
      {image ? (
        <Image
          src={image}
          alt={championLabel(champion)}
          fill
          sizes="40px"
          className={`object-cover ${ban ? "grayscale opacity-65" : ""}`}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[10px] text-muted">-</div>
      )}
      {ban ? <div className="absolute inset-x-1 top-1/2 h-px rotate-[-18deg] bg-white/75" /> : null}
    </div>
  );
}

function DraftList({
  items,
  champions,
  ban = false,
}: {
  items: SetPickBan[];
  champions: Champion[];
  ban?: boolean;
}) {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const item = sorted[index];
        return (
          <DraftIcon
            key={item?.id ?? `${ban ? "ban" : "pick"}-${index}`}
            champion={champions.find((champion) => champion.id === item?.championId)}
            ban={ban}
          />
        );
      })}
    </div>
  );
}

function TeamDraftSummary({
  label,
  bans,
  picks,
  champions,
  align = "left",
}: {
  label: string;
  bans: SetPickBan[];
  picks: SetPickBan[];
  champions: Champion[];
  align?: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${align === "right" ? "items-end text-right" : ""}`}>
      <p className="truncate text-sm font-semibold">{label}</p>
      <div className={`flex flex-col gap-1.5 ${align === "right" ? "items-end" : ""}`}>
        <div className="flex items-center gap-2">
          {align === "left" ? <span className="w-8 text-[10px] font-semibold text-muted">BAN</span> : null}
          <DraftList items={bans} champions={champions} ban />
          {align === "right" ? <span className="w-8 text-[10px] font-semibold text-muted">BAN</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {align === "left" ? <span className="w-8 text-[10px] font-semibold text-muted">PICK</span> : null}
          <DraftList items={picks} champions={champions} />
          {align === "right" ? <span className="w-8 text-[10px] font-semibold text-muted">PICK</span> : null}
        </div>
      </div>
    </div>
  );
}

export function MatchDraftSummary({
  match,
  sets,
  picksBans,
  champions,
  teams,
}: {
  match: Match;
  sets: SetResult[];
  picksBans: SetPickBan[];
  champions: Champion[];
  teams: Team[];
}) {
  if (sets.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface p-4 text-sm text-muted">
        밴픽 데이터가 아직 연결되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sets.map((set) => {
        const setPicksBans = picksBans.filter((item) => item.setId === set.id);
        const blueBans = setPicksBans.filter((item) => item.side === "blue" && item.actionType === "ban");
        const bluePicks = setPicksBans.filter((item) => item.side === "blue" && item.actionType === "pick");
        const redBans = setPicksBans.filter((item) => item.side === "red" && item.actionType === "ban");
        const redPicks = setPicksBans.filter((item) => item.side === "red" && item.actionType === "pick");
        const hasPickBan = setPicksBans.length > 0;

        return (
          <Link
            key={set.id}
            href={setHref(match, set)}
            className="grid gap-4 rounded-md border border-border bg-surface p-4 hover:bg-surface-muted lg:grid-cols-[9rem_1fr_1fr_auto] lg:items-center"
          >
            <div>
              <p className="text-sm font-semibold">{set.setNumber}세트</p>
              <p className="mt-1 text-xs text-muted">{durationLabel(set.durationSeconds)}</p>
              {!hasPickBan ? <p className="mt-2 text-xs text-muted">밴픽 데이터 없음</p> : null}
            </div>

            <TeamDraftSummary
              label={teamLabel(teams, set.blueTeamId)}
              bans={blueBans}
              picks={bluePicks}
              champions={champions}
            />
            <TeamDraftSummary
              label={teamLabel(teams, set.redTeamId)}
              bans={redBans}
              picks={redPicks}
              champions={champions}
              align="right"
            />

            <span className="text-sm font-semibold text-accent lg:text-right">세트 상세</span>
          </Link>
        );
      })}
    </div>
  );
}
