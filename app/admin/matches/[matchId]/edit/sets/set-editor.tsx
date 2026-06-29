import Image from "next/image";
import Link from "next/link";

import { AdminDraftEditor } from "@/components/domain/admin-draft-editor";
import { ChampionPicker } from "@/components/domain/champion-picker";
import { DataTable } from "@/components/ui/data-table";
import { PlayerStatItemsEditor } from "@/components/domain/player-stat-items-editor";
import { PlayerStatRunesEditor } from "@/components/domain/player-stat-runes-editor";
import { PlayerStatSpellsEditor } from "@/components/domain/player-stat-spells-editor";
import { championImage } from "@/lib/champions";
import { draftEditorChampions } from "@/lib/draft-champions";
import { teamDraftSide } from "@/lib/draft-slots";
import { itemImageUrl, type GameItem } from "@/lib/items";
import { type RuneCatalog } from "@/lib/runes";
import { SET_STATUS_OPTIONS } from "@/lib/set-status";
import { type GameSpell } from "@/lib/spells";
import { calculatePlayerStats } from "@/lib/stats";
import type {
  Champion,
  DerivedPlayerStats,
  FanRating,
  Match,
  Player,
  PlayerStatLine,
  SetPickBan,
  SetResult,
  Team,
} from "@/lib/types";
import { durationLabel, matchHref, playerLabel, teamLabel } from "@/lib/view-data";

type PlayerStatRow = {
  line: PlayerStatLine;
  player?: Player;
  stats: DerivedPlayerStats;
  rating?: { rating: number };
};

const positions: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];

function numberValue(value: number | null | undefined) {
  return value ?? "";
}

function goldLabel(value: number | null | undefined) {
  if (!value) return "-";
  return `${(value / 1000).toFixed(1)}K`;
}

function damageLabel(value: number | null | undefined) {
  if (!value) return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString("ko-KR");
}

function numberLabel(value: number | null | undefined) {
  return value == null ? "-" : value.toLocaleString("ko-KR");
}

function itemImage(itemId: number, version: string) {
  return itemImageUrl(itemId, version);
}

function dragonText(set: SetResult, side: "blue" | "red") {
  const prefix = side === "blue" ? "blue" : "red";
  const entries = [
    ["Cloud", set[`${prefix}Clouds` as keyof SetResult]],
    ["Infernal", set[`${prefix}Infernals` as keyof SetResult]],
    ["Mountain", set[`${prefix}Mountains` as keyof SetResult]],
    ["Ocean", set[`${prefix}Oceans` as keyof SetResult]],
    ["Hextech", set[`${prefix}Hextechs` as keyof SetResult]],
    ["Chemtech", set[`${prefix}Chemtechs` as keyof SetResult]],
    ["Elder", set[`${prefix}Elders` as keyof SetResult]],
  ] as const;
  const items = entries
    .slice(0, 6)
    .map(([label, value]) => ({ label, value: typeof value === "number" ? value : 0 }))
    .filter((item) => item.value > 0);

  return items.length > 0 ? items.map((item) => `${item.label} ${item.value}`).join(" / ") : "-";
}

function kdaText(rows: Array<{ line: { kills: number; deaths: number; assists: number } }>) {
  const totals = rows.reduce(
    (acc, row) => ({
      kills: acc.kills + row.line.kills,
      deaths: acc.deaths + row.line.deaths,
      assists: acc.assists + row.line.assists,
    }),
    { kills: 0, deaths: 0, assists: 0 },
  );
  return `${totals.kills}/${totals.deaths}/${totals.assists}`;
}

function matchScoreForTeam(
  match: { teamAId: string; teamBId: string; teamAScore: number | null; teamBScore: number | null },
  teamId: string,
) {
  if (match.teamAId === teamId) return match.teamAScore;
  if (match.teamBId === teamId) return match.teamBScore;
  return null;
}

function AdminNumberInput({
  name,
  defaultValue,
  className = "",
}: {
  name: string;
  defaultValue?: number | null;
  className?: string;
}) {
  return (
    <input
      name={name}
      type="number"
      min="0"
      defaultValue={numberValue(defaultValue)}
      className={`w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground tabular-nums ${className}`}
    />
  );
}

function AdminTextInput({
  name,
  defaultValue,
  placeholder,
  className = "",
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      name={name}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      className={`w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground ${className}`}
    />
  );
}

function TeamSelect({
  name,
  teams,
  defaultValue,
  className = "",
}: {
  name: string;
  teams: Team[];
  defaultValue?: string | null;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className={`w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground ${className}`}
    >
      <option value="">Select team</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.shortName} - {team.name}
        </option>
      ))}
    </select>
  );
}

function PlayerSelect({
  name,
  players,
  defaultValue,
  className = "",
}: {
  name: string;
  players: Player[];
  defaultValue?: string | null;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className={`w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground ${className}`}
    >
      <option value="">Select player</option>
      {players.map((player) => (
        <option key={player.id} value={player.id}>
          {player.name} - {player.position}
        </option>
      ))}
    </select>
  );
}

function PositionSelect({ name, defaultValue }: { name: string; defaultValue: Player["position"] }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground"
    >
      {positions.map((position) => (
        <option key={position} value={position}>
          {position}
        </option>
      ))}
    </select>
  );
}

function AdminTeamHeader({
  teams,
  teamId,
  teamField,
  score,
  result,
  align = "left",
}: {
  teams: Team[];
  teamId: string;
  teamField: string;
  score: number | null;
  result: "WIN" | "LOSS";
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-4 bg-foreground px-5 py-4 text-background ${
        align === "right" ? "justify-end bg-accent" : ""
      }`}
    >
      {align === "left" ? (
        <TeamSelect name={teamField} teams={teams} defaultValue={teamId} className="max-w-[16rem]" />
      ) : null}
      <span className="text-4xl font-semibold">{score ?? "-"}</span>
      <span className="h-8 w-px bg-background/35" />
      <span className="text-xl font-semibold">{result}</span>
      {align === "right" ? (
        <TeamSelect name={teamField} teams={teams} defaultValue={teamId} className="max-w-[16rem]" />
      ) : null}
    </div>
  );
}

function StatRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center border-b border-border px-4 py-3 last:border-b-0">
      <strong className="text-right text-base">{left}</strong>
      <span className="text-center text-xs font-semibold text-muted">{label}</span>
      <strong className="text-base">{right}</strong>
    </div>
  );
}

function StatInputRow({
  label,
  leftName,
  rightName,
  leftDefault,
  rightDefault,
}: {
  label: string;
  leftName: string;
  rightName: string;
  leftDefault?: number | null;
  rightDefault?: number | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center border-b border-border px-4 py-3 last:border-b-0">
      <AdminNumberInput name={leftName} defaultValue={leftDefault} className="text-right" />
      <span className="text-center text-xs font-semibold text-muted">{label}</span>
      <AdminNumberInput name={rightName} defaultValue={rightDefault} />
    </div>
  );
}

function DragonInputGroup({ side, set }: { side: "blue" | "red"; set: SetResult }) {
  const prefix = side === "blue" ? "blue" : "red";
  const fields = [
    ["C", `${prefix}Clouds`, set[`${prefix}Clouds` as keyof SetResult]],
    ["I", `${prefix}Infernals`, set[`${prefix}Infernals` as keyof SetResult]],
    ["M", `${prefix}Mountains`, set[`${prefix}Mountains` as keyof SetResult]],
    ["O", `${prefix}Oceans`, set[`${prefix}Oceans` as keyof SetResult]],
    ["H", `${prefix}Hextechs`, set[`${prefix}Hextechs` as keyof SetResult]],
    ["Ch", `${prefix}Chemtechs`, set[`${prefix}Chemtechs` as keyof SetResult]],
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
      {fields.map(([label, name, value]) => (
        <label key={name} className="grid gap-1 text-xs font-semibold text-muted">
          {label}
          <AdminNumberInput
            name={name}
            defaultValue={typeof value === "number" ? value : null}
            className="text-center"
          />
        </label>
      ))}
    </div>
  );
}

function DamageRows({
  rows,
  champions,
  maxDamage,
  side,
}: {
  rows: Array<{
    line: {
      championId?: string | null;
      damageToChampions: number;
    };
    player?: Player;
  }>;
  champions: Champion[];
  maxDamage: number;
  side: "blue" | "red";
}) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => {
        const champion = champions.find((item) => item.id === row.line.championId);
        const image = championImage(champion);
        return (
          <div
            key={`${side}-${row.player?.id ?? row.line.championId}`}
            className={`grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 ${
              side === "red" ? "grid-cols-[minmax(0,1fr)_2.25rem]" : ""
            }`}
          >
            {side === "blue" && image ? (
              <Image src={image} alt="" width={36} height={36} className="h-9 w-9 rounded object-cover" />
            ) : null}
            <div className={`min-w-0 ${side === "red" ? "text-right" : ""}`}>
              <div
                className={`grid items-center gap-2 text-sm ${
                  side === "red" ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_auto]"
                }`}
              >
                {side === "red" ? (
                  <span className="shrink-0 tabular-nums">{damageLabel(row.line.damageToChampions)}</span>
                ) : null}
                <span className="truncate font-semibold">{row.player?.name ?? "-"}</span>
                {side === "blue" ? (
                  <span className="shrink-0 tabular-nums">{damageLabel(row.line.damageToChampions)}</span>
                ) : null}
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full ${side === "blue" ? "bg-accent" : "ml-auto bg-rose-500"}`}
                  style={{ width: `${Math.max(4, (row.line.damageToChampions / maxDamage) * 100)}%` }}
                />
              </div>
            </div>
            {side === "red" && image ? (
              <Image src={image} alt="" width={36} height={36} className="h-9 w-9 rounded object-cover" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PlayerStatBoard({
  blueRows,
  redRows,
  champions,
  maxDamage,
  teams,
  blueTeamId,
  redTeamId,
  winnerTeamId,
  itemVersion,
}: {
  blueRows: PlayerStatRow[];
  redRows: PlayerStatRow[];
  champions: Champion[];
  maxDamage: number;
  teams: Team[];
  blueTeamId: string;
  redTeamId: string;
  winnerTeamId: string | null;
  itemVersion: string;
}) {
  const renderTeamRows = (rows: PlayerStatRow[], side: "blue" | "red") =>
    rows.map((row) => {
      const champion = champions.find((item) => item.id === row.line.championId);
      const image = championImage(champion);
      const damageWidth = Math.max(4, (row.line.damageToChampions / maxDamage) * 100);
      const accent = side === "blue" ? "bg-accent" : "bg-rose-500";

      return (
        <div
          key={`${side}-${row.line.playerId}`}
          className="grid min-w-[58rem] grid-cols-[14rem_9rem_11rem_7rem_7rem_1fr] items-center gap-4 border-t border-border px-4 py-2.5 text-sm"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-surface-muted">
              {image ? <Image src={image} alt="" width={44} height={44} className="h-full w-full object-cover" /> : null}
              <span className="absolute bottom-0 right-0 rounded-tl bg-background/90 px-1 text-[10px] font-semibold">
                {row.line.position}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {teamLabel(teams, row.line.teamId)} {row.player?.name ?? "-"}
              </p>
              <p className="truncate text-xs text-muted">{champion?.name ?? "-"}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="font-semibold tabular-nums">
              {row.line.kills} / {row.line.deaths} / {row.line.assists}
            </p>
            <p className="text-xs font-semibold text-muted tabular-nums">{row.stats.kda.toFixed(2)}</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold tabular-nums">{numberLabel(row.line.damageToChampions)}</span>
              <span className="text-xs text-muted tabular-nums">DPM {row.stats.dpm}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div className={`h-full rounded-full ${accent}`} style={{ width: `${damageWidth}%` }} />
            </div>
          </div>

          <div className="text-center font-semibold tabular-nums">{row.line.visionScore}</div>

          <div className="text-center">
            <p className="font-semibold tabular-nums">{row.line.cs}</p>
            <p className="text-xs text-muted tabular-nums">{row.stats.csm.toFixed(1)}</p>
          </div>

          <div className="flex flex-wrap gap-1">
            {row.line.itemIds.some((itemId) => itemId && itemId > 0) ? (
              row.line.itemIds.map((itemId, index) =>
                itemId && itemId > 0 ? (
                  <Image
                    key={`${itemId}-${index}`}
                    src={itemImage(itemId, itemVersion)}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded border border-border bg-surface-muted object-cover"
                  />
                ) : (
                  <span
                    key={`empty-${index}`}
                    className="h-7 w-7 rounded border border-dashed border-border bg-surface-muted"
                    aria-hidden="true"
                  />
                ),
              )
            ) : (
              <span className="text-xs font-semibold text-muted">Riot items not synced</span>
            )}
            {row.line.roleBoundItem ? (
              <Image
                src={itemImage(row.line.roleBoundItem, itemVersion)}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 rounded border border-accent bg-surface-muted object-cover"
                title="퀘스트 아이템"
              />
            ) : null}
          </div>
        </div>
      );
    });

  const teamBlock = (teamId: string, side: "blue" | "red", rows: PlayerStatRow[]) => {
    const won = winnerTeamId === teamId;
    return (
      <div>
        <div className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <strong>{teamLabel(teams, teamId)}</strong>
            <span className={`text-xs font-semibold ${won ? "text-accent" : "text-muted"}`}>
              {won ? "Victory" : "Defeat"}
            </span>
          </div>
          <span className="text-xs font-semibold text-muted">{side === "blue" ? "Blue Side" : "Red Side"}</span>
        </div>
        {renderTeamRows(rows, side)}
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="player-stats">
      <h2 id="player-stats" className="text-xl font-semibold">
        Player stats
      </h2>
      {blueRows.length + redRows.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted">
          Player stats have not been synced yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <div className="grid min-w-[58rem] grid-cols-[14rem_9rem_11rem_7rem_7rem_1fr] gap-4 px-4 py-3 text-xs font-semibold uppercase text-muted">
            <span>Champion / Player</span>
            <span className="text-center">KDA</span>
            <span>Damage</span>
            <span className="text-center">Sight</span>
            <span className="text-center">CS</span>
            <span>Items</span>
          </div>
          {teamBlock(blueTeamId, "blue", blueRows)}
          {teamBlock(redTeamId, "red", redRows)}
        </div>
      )}
    </section>
  );
}

function AdminPlayerStatEditor({
  set,
  teams,
  players,
  champions,
  items,
  spells,
  runeCatalog,
  itemVersion,
  blueRows,
  redRows,
}: {
  set: SetResult;
  teams: Team[];
  players: Player[];
  champions: Champion[];
  items: GameItem[];
  spells: GameSpell[];
  runeCatalog: RuneCatalog;
  itemVersion: string;
  blueRows: PlayerStatRow[];
  redRows: PlayerStatRow[];
}) {
  const rowFor = (rows: PlayerStatRow[], teamId: string, position: Player["position"], side: "blue" | "red") => {
    const existing = rows.find((row) => row.line.position === position);
    if (existing) return { ...existing, side };
    const player = players.find((item) => item.teamId === teamId && item.position === position);
    return {
      side,
      player,
      line: {
        setId: set.id,
        playerId: player?.id ?? "",
        teamId,
        position,
        championId: null,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        gold: 0,
        damageToChampions: 0,
        teamKills: 0,
        teamDamage: 0,
        gameMinutes: 0,
        visionScore: 0,
        itemIds: [null, null, null, null, null, null, null],
        spellIds: [null, null],
        runeIds: [null, null],
        roleBoundItem: null,
        patch: null,
      },
      stats: calculatePlayerStats({
        setId: set.id,
        playerId: player?.id ?? "",
        teamId,
        position,
        championId: null,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        gold: 0,
        damageToChampions: 0,
        teamKills: 0,
        teamDamage: 0,
        gameMinutes: 0,
        visionScore: 0,
        itemIds: [null, null, null, null, null, null, null],
        spellIds: [null, null],
        runeIds: [null, null],
        roleBoundItem: null,
        patch: null,
      }),
    } satisfies PlayerStatRow & { side: "blue" | "red" };
  };
  const rows = [
    ...positions.map((position) => rowFor(blueRows, set.blueTeamId, position, "blue")),
    ...positions.map((position) => rowFor(redRows, set.redTeamId, position, "red")),
  ];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="player-stats-edit">
      <h2 id="player-stats-edit" className="text-xl font-semibold">
        Player stats
      </h2>
      <input type="hidden" name="playerStatCount" value={rows.length} />
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <div className="grid min-w-[86rem] grid-cols-[6rem_13rem_10rem_8rem_11rem_13rem_5rem_5rem_5rem_6rem_7rem_5rem_5rem_20rem] gap-2 px-4 py-3 text-xs font-semibold uppercase text-muted">
          <span>Side</span>
          <span>Player</span>
          <span>Team</span>
          <span>Pos</span>
          <span>Champion</span>
          <span>KDA</span>
          <span>CS</span>
          <span>Gold</span>
          <span>Damage</span>
          <span>Vision</span>
          <span>DPM</span>
          <span>Spells</span>
          <span>Runes</span>
          <span>Items 0-6</span>
        </div>
        {rows.map((row, index) => {
          return (
            <div
              key={`${row.side}-${row.line.position}`}
              className="grid min-w-[86rem] grid-cols-[6rem_13rem_10rem_8rem_11rem_13rem_5rem_5rem_5rem_6rem_7rem_5rem_5rem_20rem] items-center gap-2 border-t border-border px-4 py-2 text-sm"
            >
              <input type="hidden" name={`playerStat.${index}.side`} value={row.side} />
              <span className="text-xs font-semibold uppercase text-muted">{row.side}</span>
              <PlayerSelect name={`playerStat.${index}.playerId`} players={players} defaultValue={row.line.playerId} />
              <TeamSelect name={`playerStat.${index}.teamId`} teams={teams} defaultValue={row.line.teamId} />
              <PositionSelect name={`playerStat.${index}.position`} defaultValue={row.line.position} />
              <ChampionPicker
                name={`playerStat.${index}.championId`}
                champions={champions}
                defaultValue={row.line.championId}
                placeholder="챔피언 선택"
              />
              <div className="grid grid-cols-3 gap-1">
                <AdminNumberInput name={`playerStat.${index}.kills`} defaultValue={row.line.kills} className="px-1 text-center" />
                <AdminNumberInput name={`playerStat.${index}.deaths`} defaultValue={row.line.deaths} className="px-1 text-center" />
                <AdminNumberInput name={`playerStat.${index}.assists`} defaultValue={row.line.assists} className="px-1 text-center" />
              </div>
              <AdminNumberInput name={`playerStat.${index}.cs`} defaultValue={row.line.cs} className="px-1 text-center" />
              <AdminNumberInput name={`playerStat.${index}.gold`} defaultValue={row.line.gold} className="px-1 text-center" />
              <AdminNumberInput
                name={`playerStat.${index}.damageToChampions`}
                defaultValue={row.line.damageToChampions}
                className="px-1 text-center"
              />
              <AdminNumberInput
                name={`playerStat.${index}.visionScore`}
                defaultValue={row.line.visionScore}
                className="px-1 text-center"
              />
              <span className="text-xs font-semibold text-muted tabular-nums">{row.stats.dpm}</span>
              <PlayerStatSpellsEditor
                namePrefix={`playerStat.${index}`}
                defaultSpellIds={row.line.spellIds}
                spells={spells}
                itemVersion={itemVersion}
              />
              <PlayerStatRunesEditor
                namePrefix={`playerStat.${index}`}
                defaultRuneIds={row.line.runeIds}
                runeCatalog={runeCatalog}
              />
              <div className="flex items-center gap-1">
                <PlayerStatItemsEditor
                  namePrefix={`playerStat.${index}`}
                  defaultItemIds={row.line.itemIds}
                  items={items}
                  itemVersion={itemVersion}
                />
                {row.line.roleBoundItem ? (
                  <Image
                    src={itemImage(row.line.roleBoundItem, itemVersion)}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 shrink-0 rounded border border-accent bg-surface-muted object-cover"
                    title="퀘스트 아이템"
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AdminSetNavigation({
  match,
  sets,
  currentSetId,
}: {
  match: Match;
  sets: SetResult[];
  currentSetId: string;
}) {
  if (sets.length <= 1) return null;

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Admin set navigation">
      {sets.map((item) => {
        const active = item.id === currentSetId;
        return (
          <Link
            key={item.id}
            href={`/admin/matches/${encodeURIComponent(match.leaguepediaMatchId || match.id)}/edit/sets/${item.id}/edit`}
            aria-current={active ? "page" : undefined}
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            Set {item.setNumber}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSetEditor({
  title,
  match,
  set,
  teams,
  adminMatchPath,
  action,
  submitLabel,
  players = [],
  champions = [],
  items = [],
  spells = [],
  runeCatalog = { keystones: [], trees: [] },
  itemVersion = "16.12.1",
  picksBans = [],
  playerStatLines = [],
  fanRatings = [],
  matchSets = [],
}: {
  title: string;
  match: Match;
  set?: SetResult;
  teams: Team[];
  matches?: Match[];
  adminMatchPath: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  players?: Player[];
  champions?: Champion[];
  items?: GameItem[];
  spells?: GameSpell[];
  runeCatalog?: RuneCatalog;
  itemVersion?: string;
  picksBans?: SetPickBan[];
  playerStatLines?: PlayerStatLine[];
  fanRatings?: FanRating[];
  matchSets?: SetResult[];
}) {
  const activeSet: SetResult =
    set ??
    ({
      id: "",
      matchId: match.id,
      setNumber: 1,
      status: "scheduled",
      winnerTeamId: null,
      blueTeamId: match.teamAId,
      redTeamId: match.teamBId,
      durationSeconds: null,
      blueKills: null,
      redKills: null,
      blueGold: null,
      redGold: null,
      blueDragons: null,
      redDragons: null,
      blueRiftHeralds: null,
      redRiftHeralds: null,
      blueVoidGrubs: null,
      redVoidGrubs: null,
      blueBarons: null,
      redBarons: null,
      blueTowers: null,
      redTowers: null,
      patch: null,
      leaguepediaGameId: null,
      riotMatchId: null,
      riotPlatformGameId: null,
    } satisfies SetResult);
  const blueWon = activeSet.winnerTeamId === activeSet.blueTeamId;
  const redWon = activeSet.winnerTeamId === activeSet.redTeamId;
  const relatedRatings = fanRatings.filter((rating) => rating.setId === activeSet.id);
  const playerRows = playerStatLines.map((line) => {
    const player = players.find((item) => item.id === line.playerId);
    return {
      line,
      player,
      stats: calculatePlayerStats(line),
      rating: relatedRatings.find((rating) => rating.playerId === line.playerId),
    };
  });
  const positionOrder = new Map<Player["position"], number>(positions.map((position, index) => [position, index]));
  const byPosition = (a: PlayerStatRow, b: PlayerStatRow) =>
    (positionOrder.get(a.line.position) ?? 99) - (positionOrder.get(b.line.position) ?? 99);
  const blueRows = playerRows.filter((row) => row.line.teamId === activeSet.blueTeamId).sort(byPosition);
  const redRows = playerRows.filter((row) => row.line.teamId === activeSet.redTeamId).sort(byPosition);
  const maxDamage = Math.max(...playerRows.map((row) => row.line.damageToChampions), 1);
  const itemVersionResolved =
    itemVersion || champions.find((champion) => champion.ddragonVersion)?.ddragonVersion || "16.12.1";
  const pickerChampionsList = draftEditorChampions(champions, picksBans, playerStatLines);
  const playerByPosition = (teamId: string, position: Player["position"]) =>
    players.find((player) => player.teamId === teamId && player.position === position);
  const blueLineup = positions.map((position) => ({ position, player: playerByPosition(activeSet.blueTeamId, position) }));
  const redLineup = positions.map((position) => ({ position, player: playerByPosition(activeSet.redTeamId, position) }));
  const redirectTo = set
    ? `/admin/matches/${encodeURIComponent(match.leaguepediaMatchId || match.id)}/edit/sets/${set.id}/edit`
    : adminMatchPath;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-accent">Set edit</p>
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">{title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={adminMatchPath}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
            >
              Back to match edit
            </Link>
          </div>
        </div>
        <AdminSetNavigation match={match} sets={matchSets} currentSetId={activeSet.id} />
      </section>

      <form action={action} className="contents">
        {set ? <input type="hidden" name="setId" value={set.id} /> : null}
        <input type="hidden" name="matchId" value={match.id} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="blueKills" value={numberValue(activeSet.blueKills)} />
        <input type="hidden" name="redKills" value={numberValue(activeSet.redKills)} />

        <section className="overflow-hidden rounded-md border border-border bg-surface" aria-labelledby="set-summary">
          <div className="grid bg-foreground text-background lg:grid-cols-[1fr_15rem_1fr]">
            <AdminTeamHeader
              teams={teams}
              teamId={activeSet.blueTeamId}
              teamField="blueTeamId"
              score={matchScoreForTeam(match, activeSet.blueTeamId)}
              result={blueWon ? "WIN" : "LOSS"}
            />
            <div className="grid gap-2 border-y border-background/20 px-5 py-4 text-center lg:border-x lg:border-y-0">
              <p className="text-xs font-semibold text-background/70">GAME TIME</p>
              <AdminNumberInput name="durationSeconds" defaultValue={activeSet.durationSeconds} className="text-center text-2xl" />
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-semibold text-background/70">
                  GAME
                  <AdminNumberInput name="setNumber" defaultValue={activeSet.setNumber} className="text-center" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-background/70">
                  PATCH
                  <AdminTextInput name="patch" defaultValue={activeSet.patch} placeholder="26.10" className="text-center" />
                </label>
              </div>
              <label className="grid gap-1 text-xs font-semibold text-background/70">
                STATUS
                <select
                  name="status"
                  defaultValue={activeSet.status}
                  className="rounded-md border border-background/30 bg-background px-2 py-1 text-center text-sm font-semibold text-foreground"
                >
                  {SET_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-background/70">
                WINNER
                <TeamSelect name="winnerTeamId" teams={teams} defaultValue={activeSet.winnerTeamId} />
              </label>
            </div>
            <AdminTeamHeader
              teams={teams}
              teamId={activeSet.redTeamId}
              teamField="redTeamId"
              score={matchScoreForTeam(match, activeSet.redTeamId)}
              result={redWon ? "WIN" : "LOSS"}
              align="right"
            />
          </div>

          <div className="grid gap-6 p-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-md border border-border bg-background">
              <div className="border-b border-border px-4 py-3 text-center text-sm font-semibold">GAME STATS</div>
              <StatRow label="KDA" left={kdaText(blueRows)} right={kdaText(redRows)} />
              <StatInputRow
                label="GOLD"
                leftName="blueGold"
                rightName="redGold"
                leftDefault={activeSet.blueGold}
                rightDefault={activeSet.redGold}
              />
              <StatInputRow
                label="TOWERS"
                leftName="blueTowers"
                rightName="redTowers"
                leftDefault={activeSet.blueTowers}
                rightDefault={activeSet.redTowers}
              />
              <StatInputRow
                label="VOID GRUBS"
                leftName="blueVoidGrubs"
                rightName="redVoidGrubs"
                leftDefault={activeSet.blueVoidGrubs}
                rightDefault={activeSet.redVoidGrubs}
              />
              <StatInputRow
                label="HERALDS"
                leftName="blueRiftHeralds"
                rightName="redRiftHeralds"
                leftDefault={activeSet.blueRiftHeralds}
                rightDefault={activeSet.redRiftHeralds}
              />
              <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center gap-y-2 border-b border-border px-4 py-4">
                <DragonInputGroup side="blue" set={activeSet} />
                <span className="self-center text-center text-xs font-semibold text-muted">DRAKES</span>
                <DragonInputGroup side="red" set={activeSet} />
              </div>
              <StatInputRow
                label="ELDERS"
                leftName="blueElders"
                rightName="redElders"
                leftDefault={activeSet.blueElders}
                rightDefault={activeSet.redElders}
              />
              <StatInputRow
                label="BARONS"
                leftName="blueBarons"
                rightName="redBarons"
                leftDefault={activeSet.blueBarons}
                rightDefault={activeSet.redBarons}
              />
            </div>

            <div className="rounded-md border border-border bg-background p-4">
              <h2 id="set-summary" className="text-center text-sm font-semibold">
                Champion damage share
              </h2>
              {playerRows.length === 0 ? (
                <div className="mt-4 grid min-h-40 place-items-center rounded-md border border-dashed border-border bg-surface p-4 text-center text-sm text-muted">
                  Player stats have not been synced yet.
                </div>
              ) : (
                <div className="mt-4 grid gap-5 xl:grid-cols-2">
                  <DamageRows rows={blueRows} champions={champions} maxDamage={maxDamage} side="blue" />
                  <DamageRows rows={redRows} champions={champions} maxDamage={maxDamage} side="red" />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 border-t border-border p-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">
              Leaguepedia Game ID
              <AdminTextInput name="leaguepediaGameId" defaultValue={activeSet.leaguepediaGameId} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Riot Match ID
              <AdminTextInput name="riotMatchId" defaultValue={activeSet.riotMatchId} placeholder="KR_1234567890" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Riot Platform Game ID
              <AdminTextInput name="riotPlatformGameId" defaultValue={activeSet.riotPlatformGameId} />
            </label>
          </div>

          <div className="flex justify-end border-t border-border p-4">
            <button type="submit" className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background">
              {submitLabel}
            </button>
          </div>
        </section>

        <AdminDraftEditor
          set={activeSet}
          champions={pickerChampionsList}
          picksBans={picksBans}
          blue={teamDraftSide({
            teamId: activeSet.blueTeamId,
            teamName: teamLabel(teams, activeSet.blueTeamId),
            picksBans,
            playerStatLines,
            lineup: blueLineup,
          })}
          red={teamDraftSide({
            teamId: activeSet.redTeamId,
            teamName: teamLabel(teams, activeSet.redTeamId),
            picksBans,
            playerStatLines,
            lineup: redLineup,
          })}
        />

        <AdminPlayerStatEditor
          set={activeSet}
          teams={teams}
          players={players}
          champions={pickerChampionsList}
          items={items}
          spells={spells}
          runeCatalog={runeCatalog}
          itemVersion={itemVersionResolved}
          blueRows={blueRows}
          redRows={redRows}
        />

        <div className="flex justify-end">
          <button type="submit" className="rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
            {submitLabel}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-4" aria-labelledby="set-reviews">
        <h2 id="set-reviews" className="text-xl font-semibold">
          Set ratings / reviews
        </h2>
        <DataTable
          rows={relatedRatings}
          columns={[
            { key: "player", label: "Player", render: (row) => playerLabel(players, row.playerId) },
            { key: "rating", label: "Rating", render: (row) => row.rating.toFixed(1) },
            { key: "review", label: "Review", render: (row) => row.review },
          ]}
        />
      </section>
    </main>
  );
}
