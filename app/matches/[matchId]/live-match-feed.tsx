"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sword } from "lucide-react";

import type { LiveMatchEvent, LiveMatchResponse, LiveSeriesScore } from "@/app/api/matches/[matchId]/live/route";
import { TeamLogo } from "@/components/ui/team-logo";
import { championCatalogEntries, normalizeChampionKey } from "@/lib/champions";
import { OBJECTIVE_ICONS } from "@/lib/objectives";
import type { Team } from "@/lib/types";

const POLL_INTERVAL_MS = 10_000;

const CHAMPION_IMAGE_BY_KEY = new Map(
  championCatalogEntries().map((champion) => [
    normalizeChampionKey(champion.ddragon_id),
    `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champion.ddragon_id}_0.jpg`,
  ]),
);

const DRAGON_ICON: Record<string, string> = {
  cloud: OBJECTIVE_ICONS.cloud,
  infernal: OBJECTIVE_ICONS.infernal,
  mountain: OBJECTIVE_ICONS.mountain,
  ocean: OBJECTIVE_ICONS.ocean,
  hextech: OBJECTIVE_ICONS.hextech,
  chemtech: OBJECTIVE_ICONS.chemtech,
  elder: OBJECTIVE_ICONS.elder,
};

const DRAGON_LABEL: Record<string, string> = {
  cloud: "바람 드래곤",
  infernal: "화염 드래곤",
  mountain: "대지 드래곤",
  ocean: "바다 드래곤",
  hextech: "마법공학 드래곤",
  chemtech: "화학공학 드래곤",
  elder: "장로 드래곤",
};

function fmtClock(seconds: number | null) {
  if (seconds == null) return "-:--";
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function ChampionAvatar({
  summonerName,
  championId,
  defeated = false,
}: {
  summonerName: string | null;
  championId: string | null;
  defeated?: boolean;
}) {
  const image = championId ? CHAMPION_IMAGE_BY_KEY.get(normalizeChampionKey(championId)) : null;

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--ui-card-hover)] text-xs font-medium text-[var(--ui-muted)] sm:h-10 sm:w-10">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className={`h-full w-full object-cover ${defeated ? "grayscale" : ""}`} />
      ) : (
        summonerName?.slice(0, 1) ?? "?"
      )}
    </span>
  );
}

function Participant({
  summonerName,
  championId,
  reverse = false,
  defeated = false,
}: {
  summonerName: string | null;
  championId: string | null;
  reverse?: boolean;
  defeated?: boolean;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-1 ${reverse ? "flex-row-reverse text-right" : ""}`}>
      <ChampionAvatar summonerName={summonerName} championId={championId} defeated={defeated} />
      <span className="min-w-0 truncate text-[13px] font-medium">{summonerName ?? "?"}</span>
    </span>
  );
}

function TeamAvatar({ team }: { team: Team | undefined }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white dark:bg-[var(--ui-card-hover)] sm:h-10 sm:w-10">
      <TeamLogo team={team} size="h-6 w-6 sm:h-8 sm:w-8" plain />
    </span>
  );
}

function ObjectiveIcon({ src, filled }: { src: string; filled?: boolean }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white dark:bg-[var(--ui-card-hover)] sm:h-10 sm:w-10">
      {filled ? (
      <span
        aria-hidden="true"
          className="h-6 w-6 bg-[var(--ui-muted)] sm:h-8 sm:w-8"
        style={{
          WebkitMaskImage: `url(${src})`,
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskImage: `url(${src})`,
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
        }}
      />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-6 w-6 object-contain sm:h-8 sm:w-8" />
      )}
    </span>
  );
}

function ObjectiveRow({ event, teamOf }: { event: LiveMatchEvent; teamOf: (teamId: string | null) => Team | undefined }) {
  if (event.type === "kill") {
    return (
      <div
        className="mx-auto grid w-full max-w-[22rem] min-w-0 items-center gap-1 sm:gap-2"
        style={{ gridTemplateColumns: "minmax(0, 1fr) 20px minmax(0, 1fr)" }}
      >
        <Participant summonerName={event.killerSummonerName} championId={event.killerChampionId} reverse />
        <Sword aria-hidden="true" className="mx-auto h-[18px] w-[18px] text-[var(--ui-muted)]" strokeWidth={2} />
        <Participant summonerName={event.victimSummonerName} championId={event.victimChampionId} defeated />
      </div>
    );
  }

  if (event.type === "end") {
    return <span className="min-w-0 truncate text-[13px] font-medium">경기 종료</span>;
  }

  const team = teamOf(event.teamId);
  let icon: string = OBJECTIVE_ICONS.dragon;
  let label = "드래곤";
  switch (event.type) {
    case "tower":
      icon = OBJECTIVE_ICONS.tower;
      label = "타워";
      break;
    case "baron":
      icon = OBJECTIVE_ICONS.baron;
      label = "바론";
      break;
    case "inhibitor":
      icon = OBJECTIVE_ICONS.tower;
      label = "억제기";
      break;
    case "dragon":
      icon = event.dragonType ? (DRAGON_ICON[event.dragonType] ?? OBJECTIVE_ICONS.dragon) : OBJECTIVE_ICONS.dragon;
      label = event.dragonType ? (DRAGON_LABEL[event.dragonType] ?? "드래곤") : "드래곤";
      break;
  }

  return (
    <div
      className="mx-auto grid w-full max-w-[22rem] min-w-0 items-center gap-1 sm:gap-2"
      style={{ gridTemplateColumns: "minmax(0, 1fr) 20px minmax(0, 1fr)" }}
    >
      <span className="flex min-w-0 flex-row-reverse items-center gap-1 text-right">
        <TeamAvatar team={team} />
        <span className="min-w-0 truncate text-[13px] font-medium">{team?.shortName ?? "?"}</span>
      </span>
      <Sword aria-hidden="true" className="mx-auto h-[18px] w-[18px] text-[var(--ui-muted)]" strokeWidth={2} />
      <span className="flex min-w-0 items-center gap-1">
        <ObjectiveIcon src={icon} filled={event.type === "tower" || event.type === "inhibitor"} />
        <span className="min-w-0 truncate text-[13px] font-medium">{label}</span>
      </span>
    </div>
  );
}

export function LiveMatchFeed({ matchId, teamA, teamB }: { matchId: string; teamA?: Team; teamB?: Team }) {
  const [status, setStatus] = useState<LiveMatchResponse["status"] | "loading">("loading");
  const [events, setEvents] = useState<LiveMatchEvent[]>([]);
  const [series, setSeries] = useState<LiveSeriesScore | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // 새로고침 버튼을 누르면 이 값을 올려서 아래 effect를 다시 실행시킨다 — 기존
  // 인터벌은 정리되고 즉시 한 번 다시 불러온 뒤 새 인터벌이 그 시점부터 다시 잰다.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/matches/${matchId}/live`, { cache: "no-store" });
        const data = (await res.json()) as LiveMatchResponse;
        if (cancelled) return;

        setStatus(data.status);
        // 세트 스코어는 매 폴링마다 갱신 — 세트가 끝나면 다음 폴링(최대 10초) 안에 반영된다.
        if ("series" in data && data.series) setSeries(data.series);
        // 이벤트 목록은 서버(DB)가 게임 시작부터 쌓아온 걸 그대로 내려주므로, 클라이언트는
        // diff 계산 없이 받은 그대로 반영하면 된다 — 늦게 들어온 시청자도 처음부터 보인다.
        if (data.status === "live") setClock(data.durationSeconds);
        // 세트가 끝나면 서버가 그 세트의 이벤트를 지우므로, "not_started"/"ended"로
        // 돌아왔을 때도 서버가 내려준(비어 있을 수 있는) 목록으로 그대로 갱신한다.
        if ("events" in data) setEvents(data.events);
      } catch {
        if (!cancelled) setStatus("unavailable");
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    }

    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [matchId, refreshKey]);

  // 라우트 캐싱을 꺼놨기 때문에 누르면 진짜로 즉시 최신 데이터를 가져온다. 다음
  // 자동 폴링까지 기다리지 않도록 인터벌도 이 시점부터 다시 잰다.
  const handleManualRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshKey((key) => key + 1);
  };

  const teamOf = (teamId: string | null) => {
    if (!teamId) return undefined;
    if (teamA?.id === teamId) return teamA;
    if (teamB?.id === teamId) return teamB;
    return undefined;
  };

  // 세트가 한 번이라도 끝났으면(=시리즈 스코어 합 > 0) 세트 사이 공백 문구를 다르게 보여준다.
  const seriesStarted = Boolean(series && series.teamAWins + series.teamBWins > 0);

  return (
    <section aria-label="실시간 경기 피드">
      <div className="mb-3 flex min-h-8 items-center justify-between px-1">
        {status === "live" ? (
          <span className="flex items-center gap-2 text-xs font-medium text-[var(--ui-ink)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
            LIVE
          </span>
        ) : (
          <span className="text-[13px] font-medium text-[var(--ui-muted)]">
            {status === "loading" ? "불러오는 중..." :
              status === "not_started" ? (seriesStarted ? "다음 세트 준비 중" : "경기 시작 전입니다") :
              status === "ended" ? "게임이 진행 중이지 않습니다" :
              "실시간 데이터를 가져올 수 없습니다"}
          </span>
        )}
        <div className="flex items-center gap-2">
          {status === "live" ? (
            <span className="text-xs font-medium tabular-nums text-[var(--ui-muted)]">{fmtClock(clock)}</span>
          ) : null}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="새로고침"
            title="새로고침"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--ui-muted)] transition-colors hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} strokeWidth={2} />
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="bg-[var(--ui-card-bg)] px-4 py-10 text-center text-[13px] text-[var(--ui-muted)]">
          {status === "live" ? "곧 새 소식이 올라옵니다..." : "아직 표시할 이벤트가 없습니다."}
        </p>
      ) : (
        <ol className="relative ml-1 flex flex-col gap-1 pl-5 before:absolute before:bottom-7 before:left-[5px] before:top-7 before:w-px before:bg-[var(--accent)]">
          {events.map((event, index) => (
            <li
              key={event.id}
              className="relative grid min-h-14 items-center gap-1 rounded-md bg-[var(--ui-card-bg)] px-2 py-2 sm:min-h-[60px] sm:gap-2.5 sm:px-3"
              style={{ gridTemplateColumns: "40px minmax(0, 1fr)" }}
            >
              <span
                aria-hidden="true"
                className={`absolute -left-5 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[var(--accent)] ${index === 0 ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--ui-surface)]" : ""}`}
              />
              <span className="text-xs font-medium tabular-nums text-[var(--ui-muted)] sm:text-[13px]">
                {fmtClock(event.time)}
              </span>
              <ObjectiveRow event={event} teamOf={teamOf} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
