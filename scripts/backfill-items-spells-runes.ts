/**
 * 기존 set_player_stats 행의 item/spell/rune 컬럼만 Leaguepedia에서 채우는 백필 스크립트.
 * 다른 통계 컬럼(kills, deaths, cs, dpm 등)은 건드리지 않습니다.
 *
 * 실행:
 *   npx tsx scripts/backfill-items-spells-runes.ts [--force]
 *
 * --force 없이 실행하면 item0, rune0, rune1 중 하나가 null인 행만 업데이트합니다.
 * --force 로 실행하면 이미 아이템이 있는 행도 덮어씁니다.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ddragonVersionFromPatch, uniqueDdragonVersionsForPatches } from "../lib/ddragon";

// ─── 환경 변수 ──────────────────────────────────────────────────

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch {
    // 환경 변수가 이미 설정된 경우 무시
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseSegmentArg() {
  const arg = process.argv.find((a) => a.startsWith("--segment="));
  return arg ? arg.split("=")[1]?.trim() || null : null;
}

async function tournamentIdsForSegment(
  supabase: SupabaseClient,
  segment: string,
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from("tournaments").select("id");
  switch (segment) {
    case "lck":           q = q.eq("league", "LCK"); break;
    case "lck-cup":       q = q.eq("league", "LCK").eq("split", "Cup"); break;
    case "first-stand":   q = q.eq("league", "First Stand"); break;
    case "msi":           q = q.eq("league", "MSI"); break;
    case "ewc":           q = q.eq("league", "EWC"); break;
    case "worlds":        q = q.eq("league", "Worlds"); break;
    case "enc":           q = q.eq("league", "ENC"); break;
    case "international": q = q.eq("category", "international"); break;
    default:
      console.warn(`알 수 없는 세그먼트: ${segment}, 전체 처리`);
      return [];
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((t: { id: string }) => t.id);
}

// ─── 타입 ───────────────────────────────────────────────────────

type SetRow = {
  id: string;
  leaguepedia_game_id: string | null;
  set_number: number;
  match_id: string;
  blue_team_id: string | null;
  red_team_id: string | null;
  patch: string | null;
};

type StatRow = {
  id: string;
  set_id: string;
  player_id: string;
  team_id: string;
  position: string;
  item0: number | null;
  rune0: number | null;
  rune1: number | null;
};


type PlayerRow = {
  id: string;
  slug: string;
  name: string;
  leaguepedia_page: string | null;
};

type MatchRow = {
  id: string;
  leaguepedia_match_id: string | null;
};

type CargoPlayerRow = {
  GameId?: string;
  Link?: string;
  Items?: string;
  SummonerSpells?: string;
  Trinket?: string;
  RoleBoundItem?: string;
  KeystoneRune?: string;
  SecondaryTree?: string;
  Role?: string;
  Side?: string;
  Team?: string;
};

type GameSpell = { id: number; name: string; imageName: string };
type GameItem = { id: number; name: string };

// ─── Cargo API ──────────────────────────────────────────────────

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 3500;
const MAX_RETRIES = 8;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeCargoValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function cargoQuery(query: Record<string, string>): Promise<Record<string, string>[]> {
  const params = new URLSearchParams({ action: "cargoquery", format: "json", limit: "500" });
  for (const [key, value] of Object.entries(query)) params.set(key, value);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(`${CARGO_API}?${params.toString()}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (backfill items/spells/runes)" },
    });

    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }
    if (!response.ok) throw new Error(`Leaguepedia 요청 실패: ${response.status}`);

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: Record<string, string> }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }
    if (body.error) throw new Error(`Leaguepedia 오류: ${body.error.info ?? body.error.code}`);

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia 요청 한도 초과");
}

async function fetchPlayerRows(leaguepediaMatchId: string): Promise<CargoPlayerRow[]> {
  return cargoQuery({
    tables: "ScoreboardPlayers=SP",
    fields: [
      "SP.GameId=GameId",
      "SP.Link=Link",
      "SP.Items=Items",
      "SP.SummonerSpells=SummonerSpells",
      "SP.Trinket=Trinket",
      "SP.RoleBoundItem=RoleBoundItem",
      "SP.KeystoneRune=KeystoneRune",
      "SP.SecondaryTree=SecondaryTree",
      "SP.Role=Role",
      "SP.Side=Side",
      "SP.Team=Team",
    ].join(","),
    where: `SP.MatchId="${escapeCargoValue(leaguepediaMatchId)}"`,
    order_by: "SP.GameId ASC, SP.Side ASC, SP.Role_Number ASC",
  });
}

// ─── DDragon 카탈로그 ────────────────────────────────────────────

type DdragonRuneTree = { id: number; name: string; slots: { runes: { id: number; name: string }[] }[] };

async function fetchRuneNameToIdMap(version: string): Promise<Map<string, number>> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`,
  );
  if (!res.ok) return new Map();
  const json = (await res.json()) as DdragonRuneTree[];
  const map = new Map<string, number>();
  for (const tree of json) {
    map.set(tree.name.toLowerCase(), tree.id);
    for (const slot of tree.slots) {
      for (const rune of slot.runes) {
        map.set(rune.name.toLowerCase(), rune.id);
      }
    }
  }
  return map;
}

type DdragonItemEntry = {
  id: number;
  name: string;
  maps?: Record<string, boolean>;
};

function itemPreference(item: DdragonItemEntry) {
  const isSummonersRift = item.maps?.["11"] === true;
  const isModeVariant = item.id >= 100000;

  return [
    isSummonersRift ? 0 : 1,
    isModeVariant ? 1 : 0,
    item.id,
  ] as const;
}

function compareItemPreference(a: DdragonItemEntry, b: DdragonItemEntry) {
  const left = itemPreference(a);
  const right = itemPreference(b);

  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }

  return 0;
}

async function fetchItemNameToIdMap(version: string): Promise<Map<string, number>> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`,
  );
  if (!res.ok) return new Map();
  const json = (await res.json()) as { data: Record<string, { name: string; maps?: Record<string, boolean> }> };
  const byName = new Map<string, DdragonItemEntry>();

  for (const [id, item] of Object.entries(json.data)) {
    const entry = { id: Number(id), name: item.name, maps: item.maps };
    if (!Number.isFinite(entry.id) || entry.id <= 0 || entry.name.length === 0) continue;

    const key = entry.name.toLowerCase();
    const current = byName.get(key);
    if (!current || compareItemPreference(entry, current) < 0) {
      byName.set(key, entry);
    }
  }

  return new Map([...byName.entries()].map(([name, item]) => [name, item.id]));
}

async function fetchSpellCatalog(version: string): Promise<GameSpell[]> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/summoner.json`,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data: Record<string, { key: string; name: string; image: { full: string }; modes?: string[] }>;
  };
  return Object.values(json.data)
    .filter((spell) => !spell.modes || spell.modes.includes("CLASSIC"))
    .map((spell) => ({ id: Number(spell.key), name: spell.name, imageName: spell.image.full }))
    .filter((spell) => Number.isFinite(spell.id) && spell.id > 0);
}


function buildSpellKeyToIdMap(spells: GameSpell[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const spell of spells) {
    map.set(spell.name.toLowerCase(), spell.id);
    const key = spell.imageName.replace(/\.png$/i, "");
    map.set(key.toLowerCase(), spell.id);
    const shortName = key.replace(/^Summoner/i, "").toLowerCase();
    if (shortName) map.set(shortName, spell.id);
  }
  return map;
}

// ─── 파싱 헬퍼 ──────────────────────────────────────────────────

function parseItems(itemsStr: string | null | undefined, nameToId: Map<string, number>): (number | null)[] {
  if (!itemsStr?.trim()) return [];
  const parts = itemsStr.split(";").map((s) => s.trim());
  const result = parts.map((name) => (name ? (nameToId.get(name.toLowerCase()) ?? null) : null));
  while (result.length < 7) result.push(null);
  return result.slice(0, 7);
}

function parseSpells(spellsStr: string | null | undefined, nameToId: Map<string, number>): (number | null)[] {
  if (!spellsStr?.trim()) return [null, null];
  const parts = spellsStr.split(",").map((s) => s.trim());
  return Array.from({ length: 2 }, (_, i) => {
    const name = parts[i];
    if (!name) return null;
    return nameToId.get(name.toLowerCase()) ?? nameToId.get(name.replace(/^Summoner/i, "").toLowerCase()) ?? null;
  });
}


function displayNameFromPage(page: string) {
  const base = page.split("(")[0].trim();
  const parts = base.split("/");
  return parts[parts.length - 1].trim();
}

// ─── 메인 ───────────────────────────────────────────────────────

async function main() {
  loadEnvFile();
  const force = process.argv.includes("--force");
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const segment = parseSegmentArg();
  let segMatchIds: string[] | null = null;
  if (segment) {
    const tIds = await tournamentIdsForSegment(supabase, segment);
    if (tIds.length === 0) {
      console.log(`세그먼트 '${segment}'에 해당하는 토너먼트가 없습니다.`);
      return;
    }
    const { data: mData } = await supabase.from("matches").select("id").in("tournament_id", tIds);
    segMatchIds = (mData ?? []).map((m: { id: string }) => m.id);
    console.log(`리그 필터: ${segment} (매치 ${segMatchIds.length}개)`);
  }

  // 모든 세트 (leaguepedia_game_id 없어도 set_number로 매칭)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let setsQuery: any = supabase
    .from("sets")
    .select("id, leaguepedia_game_id, set_number, match_id, blue_team_id, red_team_id, patch")
    .limit(5000);
  if (segMatchIds) setsQuery = setsQuery.in("match_id", segMatchIds);
  const { data: sets, error: setsError } = await setsQuery;

  if (setsError) throw setsError;
  const setRows = (sets ?? []) as SetRow[];
  console.log(`전체 세트: ${setRows.length}개`);

  // item/rune이 비어 있는 선수 통계 목록 (force면 전체)
  let statsQuery = supabase
    .from("set_player_stats")
    .select("id, set_id, player_id, team_id, position, item0, rune0, rune1")
    .limit(20000);
  if (!force) statsQuery = statsQuery.or("item0.is.null,rune0.is.null,rune1.is.null");
  const { data: statsData, error: statsError } = await statsQuery;
  if (statsError) throw statsError;
  const statsRows = (statsData ?? []) as StatRow[];
  const setsNeedingUpdate = new Set(statsRows.map((s) => s.set_id));
  console.log(`아이템 없는 세트: ${setsNeedingUpdate.size}개`);

  if (setsNeedingUpdate.size === 0) {
    console.log("업데이트할 데이터가 없습니다.");
    return;
  }

  // 플레이어 맵 구축
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, slug, name, leaguepedia_page");
  if (playersError) throw playersError;
  const playerMap = new Map<string, PlayerRow>();
  for (const player of (players ?? []) as PlayerRow[]) {
    playerMap.set(normalizeName(player.name), player);
    playerMap.set(normalizeName(player.slug), player);
    if (player.leaguepedia_page) {
      playerMap.set(normalizeName(player.leaguepedia_page), player);
      playerMap.set(normalizeName(displayNameFromPage(player.leaguepedia_page)), player);
    }
  }

  // 세트를 매치별로 그룹핑
  const setsToUpdate = setRows.filter((s) => setsNeedingUpdate.has(s.id));
  console.log("DDragon 카탈로그 로드 중...");
  const ddragonVersions = uniqueDdragonVersionsForPatches(setsToUpdate.map((set) => set.patch));
  const versionedCatalogs = await Promise.all(
    ddragonVersions.map(async (version) => {
      const [itemNameToId, spellCatalog, runeNameToId] = await Promise.all([
        fetchItemNameToIdMap(version),
        fetchSpellCatalog(version),
        fetchRuneNameToIdMap(version),
      ]);
      console.log(`${version}: 아이템 ${itemNameToId.size}개, 스펠 ${spellCatalog.length}개, 룬 ${runeNameToId.size}개 로드 완료`);
      return [
        version,
        {
          itemNameToId,
          spellKeyToId: buildSpellKeyToIdMap(spellCatalog),
          runeNameToId,
        },
      ] as const;
    }),
  );
  const catalogsByVersion = new Map(versionedCatalogs);

  const setsByMatch = new Map<string, SetRow[]>();
  for (const set of setsToUpdate) {
    const list = setsByMatch.get(set.match_id) ?? [];
    list.push(set);
    setsByMatch.set(set.match_id, list);
  }

  // 매치 leaguepedia_match_id 조회
  const matchIds = Array.from(setsByMatch.keys());
  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("id, leaguepedia_match_id")
    .in("id", matchIds);
  if (matchError) throw matchError;
  const matchMap = new Map(
    ((matchData ?? []) as MatchRow[]).map((m) => [m.id, m.leaguepedia_match_id]),
  );

  const matchesWithLeaguepedia = matchIds.filter((id) => matchMap.get(id));
  console.log(`Leaguepedia ID 있는 매치: ${matchesWithLeaguepedia.length}개`);

  let totalUpdated = 0;
  let totalItemsSet = 0;
  let totalSpellsSet = 0;
  let totalRunesSet = 0;
  let matchIndex = 0;

  for (const matchId of matchesWithLeaguepedia) {
    const leaguepediaMatchId = matchMap.get(matchId)!;
    const matchSets = setsByMatch.get(matchId) ?? [];
    matchIndex++;

    process.stdout.write(
      `[${matchIndex}/${matchesWithLeaguepedia.length}] ${leaguepediaMatchId} (${matchSets.length}세트) ... `,
    );

    try {
      await sleep(REQUEST_DELAY_MS);
      const cargoRows = await fetchPlayerRows(leaguepediaMatchId);

      if (cargoRows.length === 0) {
        console.log("데이터 없음");
        continue;
      }

      if (matchIndex === 1) {
        console.log("  [디버그 첫번째 행]", JSON.stringify(cargoRows[0]));
      }

      // stat rows가 있는 세트 우선으로 set_number → setRow 맵 구성
      // (stat rows 없는 세트가 먼저 들어가고, 있는 세트가 덮어씀)
      const setByGameNumber = new Map<number, SetRow>();
      for (const s of [...matchSets].sort((a, b) =>
        (setsNeedingUpdate.has(a.id) ? 1 : 0) - (setsNeedingUpdate.has(b.id) ? 1 : 0),
      )) {
        setByGameNumber.set(s.set_number, s);
      }
      const setByGameId = new Map(
        matchSets.filter((s) => s.leaguepedia_game_id).map((s) => [s.leaguepedia_game_id!, s]),
      );

      const updates: Array<{
        id: string;
        set_id: string;
        player_id: string;
        team_id: string;
        position: string;
        item0: number | null; item1: number | null; item2: number | null;
        item3: number | null; item4: number | null; item5: number | null; item6: number | null;
        spell0: number | null; spell1: number | null;
        rune0: number | null; rune1: number | null;
        role_bound_item: number | null;
      }> = [];

      for (const row of cargoRows) {
        const gameId = row.GameId ?? "";
        // leaguepedia_game_id로 먼저 매칭, 없으면 GameId 마지막 숫자(게임 순번)로 매칭
        const gameNumber = Number(gameId.split("_").at(-1));
        const set =
          setByGameId.get(gameId) ??
          (Number.isFinite(gameNumber) ? setByGameNumber.get(gameNumber) : undefined);
        if (!set) continue;

        const leaguepediaPage = String(row.Link ?? "").trim();
        const displayName = displayNameFromPage(leaguepediaPage);
        const player =
          playerMap.get(normalizeName(leaguepediaPage)) ??
          playerMap.get(normalizeName(displayName));
        if (!player) continue;

        // 이 세트+플레이어 통계 행 찾기
        const statRow = statsRows.find((s) => s.set_id === set.id && s.player_id === player.id);
        if (!statRow) continue;
        if (!force && statRow.item0 !== null && statRow.rune0 !== null && statRow.rune1 !== null) continue;

        const catalog = catalogsByVersion.get(ddragonVersionFromPatch(set.patch));
        const itemNameToId = catalog?.itemNameToId ?? new Map<string, number>();
        const spellKeyToId = catalog?.spellKeyToId ?? new Map<string, number>();
        const runeNameToId = catalog?.runeNameToId ?? new Map<string, number>();

        const parsedItems = parseItems(row.Items, itemNameToId);
        const trinketName = String(row.Trinket ?? "").trim().toLowerCase();
        parsedItems[6] = trinketName ? (itemNameToId.get(trinketName) ?? null) : null;
        const roleBoundName = String(row.RoleBoundItem ?? "").trim().toLowerCase();
        const parsedRoleBoundItem = roleBoundName ? (itemNameToId.get(roleBoundName) ?? null) : null;

        const parsedSpells = parseSpells(row.SummonerSpells, spellKeyToId);

        const keystoneName = String(row.KeystoneRune ?? "").trim().toLowerCase();
        const secondaryName = String(row.SecondaryTree ?? "").trim().toLowerCase();
        const parsedRune0 = keystoneName ? (runeNameToId.get(keystoneName) ?? null) : null;
        const parsedRune1 = secondaryName ? (runeNameToId.get(secondaryName) ?? null) : null;

        const hasItems = parsedItems.some((id) => id !== null);
        const hasSpells = parsedSpells.some((id) => id !== null);
        const hasRunes = parsedRune0 !== null || parsedRune1 !== null;

        if (!hasItems && !hasSpells && !hasRunes) continue;

        if (hasItems) totalItemsSet += parsedItems.filter((id) => id !== null).length;
        if (hasSpells) totalSpellsSet += parsedSpells.filter((id) => id !== null).length;
        if (parsedRune0 !== null) totalRunesSet++;
        if (parsedRune1 !== null) totalRunesSet++;

        updates.push({
          id: statRow.id,
          set_id: statRow.set_id,
          player_id: statRow.player_id,
          team_id: statRow.team_id,
          position: statRow.position,
          item0: parsedItems[0] ?? null,
          item1: parsedItems[1] ?? null,
          item2: parsedItems[2] ?? null,
          item3: parsedItems[3] ?? null,
          item4: parsedItems[4] ?? null,
          item5: parsedItems[5] ?? null,
          item6: parsedItems[6] ?? null,
          spell0: parsedSpells[0] ?? null,
          spell1: parsedSpells[1] ?? null,
          rune0: parsedRune0,
          rune1: parsedRune1,
          role_bound_item: parsedRoleBoundItem,
        });
      }

      if (updates.length > 0) {
        const { error: upsertError } = await supabase
          .from("set_player_stats")
          .upsert(updates, { onConflict: "id" });
        if (upsertError) throw new Error(`Supabase 오류: ${upsertError.message} (code: ${upsertError.code})`);
        totalUpdated += updates.length;
      }

      console.log(`${updates.length}명 업데이트`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.log(`오류: ${msg}`);
    }
  }

  console.log("\n=== 완료 ===");
  console.log(`총 업데이트: ${totalUpdated}명`);
  console.log(`아이템 ${totalItemsSet}개, 스펠 ${totalSpellsSet}개, 특성 ${totalRunesSet}개 채움`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
