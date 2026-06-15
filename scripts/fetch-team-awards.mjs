/**
 * Leaguepedia Cargo API에서 LCK 팀 수상 내역을 가져와 Supabase에 저장한다.
 *
 * 수집 항목:
 *   - LCK Spring/Summer/Season Playoffs 1위(우승), 2위(준우승)
 *   - Worlds / MSI 1위(우승), 2위(준우승) — 한국 팀만
 *   - LCK Finals MVP, All-LCK 1·2팀, 신인상 (Awards 테이블)
 *
 * 실행: node scripts/fetch-team-awards.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const LEAGUEPEDIA_API = "https://lol.fandom.com/api.php";
const USER_AGENT = "LCKHubMinion/0.1";

// ─── 팀명 → slug 매핑 (현재 + 역대) ──────────────────────────────────────
const NAME_TO_SLUG = new Map([
  // 현재 팀명
  ["T1", "t1"],
  ["Gen.G", "geng"],
  ["Gen.G Esports", "geng"],
  ["Hanwha Life Esports", "hle"],
  ["HLE", "hle"],
  ["Dplus KIA", "dk"],
  ["Dplus Kia", "dk"],
  ["DWG KIA", "dk"],
  ["DAMWON KIA", "dk"],
  ["KT Rolster", "kt"],
  ["DRX", "drx"],
  ["Kiwoom DRX", "drx"],
  ["KIWOOM DRX", "drx"],
  ["Nongshim RedForce", "ns"],
  ["NongShim RedForce", "ns"],
  ["NongShim RedForce Esports", "ns"],
  ["BRION", "bro"],
  ["Fredit BRION", "bro"],
  ["Hanjin Brion", "bro"],
  ["HANJIN BRION", "bro"],
  ["OK Savings Bank BRION", "bro"],
  ["OKSavingsBank BRION", "bro"],
  ["BNK FearX", "fox"],
  ["BNK FEARX", "fox"],
  ["DN SOOPers", "soop"],
  ["DN Soopers", "soop"],
  ["DN VIPER", "soop"],
  // 역대 팀명
  ["SK Telecom T1", "t1"],
  ["SK Telecom T1 K", "t1"],
  ["SK Telecom T1 2", "t1"],
  ["SK Telecom T1 S", "t1"],
  ["SKT T1 K", "t1"],
  ["SKT T1 S", "t1"],
  ["SKT T1", "t1"],
  ["Samsung Galaxy Blue", "geng"],
  ["Samsung Galaxy White", "geng"],
  ["Samsung Galaxy", "geng"],
  ["KSV eSports", "geng"],
  ["KSV", "geng"],
  ["Damwon Gaming", "dk"],
  ["DAMWON Gaming", "dk"],
  ["Longzhu Gaming", "drx"],
  ["Kingzone DragonX", "drx"],
  ["Afreeca Freecs", "soop"],
  ["SOOP", "soop"],
  ["KT Rolster Bullets", "kt"],
  ["KT Rolster Arrows", "kt"],
]);

// award_type 변환 ─ Leaguepedia Award 문자열 → DB enum
const AWARD_TEXT_TO_TYPE = new Map([
  ["finals mvp", "lck_finals_mvp"],
  ["mvp", "lck_finals_mvp"],
  ["spring mvp", "lck_finals_mvp"],
  ["summer mvp", "lck_finals_mvp"],
  ["season mvp", "lck_finals_mvp"],
  ["all-lck first team", "all_lck_first"],
  ["all-lck 1st team", "all_lck_first"],
  ["all lck first team", "all_lck_first"],
  ["all-lck second team", "all_lck_second"],
  ["all-lck 2nd team", "all_lck_second"],
  ["all lck second team", "all_lck_second"],
  ["rookie of the year", "rookie_of_year"],
  ["rookie", "rookie_of_year"],
]);

// ─── 환경변수 ──────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [key, ...rest] = t.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=");
    }
  } catch {}
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractYear(tournament) {
  const m = tournament.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

/** Leaguepedia OverviewPage → 표시용 토너먼트명 */
function formatTournamentName(overviewPage) {
  // "LCK/2022 Season/Summer Playoffs" → "LCK 2022 Summer"
  // "LCK/2025 Season/Season Playoffs" → "LCK 2025 Season"
  // "2023 Season World Championship"  → "Worlds 2023"
  // "2024 Mid-Season Invitational"    → "MSI 2024"
  if (/World\s*Championship/i.test(overviewPage)) {
    const year = extractYear(overviewPage);
    return `Worlds ${year}`;
  }
  if (/Mid.Season\s*Invitational/i.test(overviewPage)) {
    const year = extractYear(overviewPage);
    return `MSI ${year}`;
  }
  if (/^LCK\//i.test(overviewPage)) {
    const year = extractYear(overviewPage);
    if (/Summer\s*Playoffs/i.test(overviewPage)) return `LCK ${year} Summer`;
    if (/Spring\s*Playoffs/i.test(overviewPage)) return `LCK ${year} Spring`;
    if (/Season\s*Playoffs/i.test(overviewPage)) return `LCK ${year} Season`;
    if (/Road\s*to\s*MSI/i.test(overviewPage)) return `LCK ${year} Road to MSI`;
    if (/Cup/i.test(overviewPage)) return `LCK ${year} Cup`;
    return `LCK ${year}`;
  }
  return overviewPage.split("/").pop() ?? overviewPage;
}

// ─── Leaguepedia Cargo API ────────────────────────────────────────────────

async function cargoQuery(params, retries = 6) {
  const url = new URL(LEAGUEPEDIA_API);
  url.searchParams.set("action", "cargoquery");
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`Leaguepedia HTTP ${res.status}`);

    const json = await res.json();

    if (json.error) {
      if (json.error.code === "ratelimited" && attempt < retries) {
        const wait = Math.min(attempt * 20_000, 120_000);
        console.warn(`  [rate limit] ${wait / 1000}s 대기 중... (${attempt}/${retries})`);
        await sleep(wait);
        continue;
      }
      if ((json.error.code === "internal_api_error" || json.error.code?.includes("Exception")) && attempt < retries) {
        await sleep(5_000);
        continue;
      }
      throw new Error(`Leaguepedia [${json.error.code}]: ${json.error.info}`);
    }

    await sleep(3_000);
    return (json.cargoquery ?? []).map((row) => row.title);
  }
  throw new Error("Leaguepedia 요청 최대 재시도 초과");
}

// ─── 데이터 수집 함수 ──────────────────────────────────────────────────────

/** LCK Playoffs 1·2위 결과 */
async function fetchLCKPlayoffResults() {
  console.log("📋 LCK Playoffs 결과 조회 중...");
  const rows = await cargoQuery({
    tables: "TournamentResults",
    fields: "Tournament,Team,Place",
    where: `Tournament LIKE "LCK/%" AND (Tournament LIKE "%Playoffs%" OR Tournament LIKE "%Season_Playoffs%") AND (Place="1" OR Place="2")`,
    order_by: "Tournament ASC",
    limit: "500",
  });
  console.log(`  → ${rows.length}건`);
  return rows;
}

/** Worlds 1·2위 결과 (전체) */
async function fetchWorldsResults() {
  console.log("🌍 Worlds 결과 조회 중...");
  const rows = await cargoQuery({
    tables: "TournamentResults",
    fields: "Tournament,Team,Place",
    where: `Tournament LIKE "%World Championship%" AND (Place="1" OR Place="2")`,
    order_by: "Tournament ASC",
    limit: "200",
  });
  console.log(`  → ${rows.length}건`);
  return rows;
}

/** MSI 1·2위 결과 (전체) */
async function fetchMSIResults() {
  console.log("🏆 MSI 결과 조회 중...");
  const rows = await cargoQuery({
    tables: "TournamentResults",
    fields: "Tournament,Team,Place",
    where: `Tournament LIKE "%Mid-Season Invitational%" AND (Place="1" OR Place="2")`,
    order_by: "Tournament ASC",
    limit: "100",
  });
  console.log(`  → ${rows.length}건`);
  return rows;
}

/** LCK 개인 수상 (Awards 테이블) */
async function fetchLCKIndividualAwards() {
  console.log("🎖️  LCK 개인 수상 조회 중...");
  try {
    const rows = await cargoQuery({
      tables: "Awards",
      fields: "Award,AwardWinner,Team,Tournament,Date",
      where: `Tournament LIKE "LCK/%" OR Award LIKE "%LCK%"`,
      order_by: "Date ASC",
      limit: "500",
    });
    console.log(`  → ${rows.length}건`);
    return rows;
  } catch (e) {
    console.warn(`  Awards 테이블 조회 실패 (무시): ${e.message}`);
    return [];
  }
}

// ─── 변환 & DB 삽입 ───────────────────────────────────────────────────────

function mapTeamToSlug(teamName) {
  if (!teamName) return null;
  return NAME_TO_SLUG.get(teamName) ?? null;
}

function mapPlaceToAwardType(place, category) {
  const p = String(place).trim();
  if (p === "1") {
    if (category === "worlds") return "worlds_champion";
    if (category === "msi") return "msi_champion";
    return "lck_champion";
  }
  if (p === "2") {
    if (category === "worlds") return "worlds_runner_up";
    if (category === "msi") return "msi_runner_up";
    return "lck_runner_up";
  }
  return null;
}

function mapAwardText(rawAward) {
  if (!rawAward) return null;
  const lower = rawAward.toLowerCase().trim();
  for (const [key, type] of AWARD_TEXT_TO_TYPE) {
    if (lower.includes(key)) return type;
  }
  return null;
}

async function buildAwardRows(results, category, slugToId) {
  const rows = [];
  for (const r of results) {
    const slug = mapTeamToSlug(r.Team);
    if (!slug) continue; // 한국 팀이 아닌 경우 건너뜀

    const teamId = slugToId.get(slug);
    if (!teamId) continue;

    const awardType = mapPlaceToAwardType(r.Place, category);
    if (!awardType) continue;

    const year = extractYear(r.Tournament);
    if (!year) continue;

    rows.push({
      team_id: teamId,
      year,
      tournament_name: formatTournamentName(r.Tournament),
      award_type: awardType,
      player_id: null,
      player_name: null,
      notes: null,
      source: "leaguepedia",
      leaguepedia_page: r.Tournament,
    });
  }
  return rows;
}

async function buildIndividualAwardRows(awards, slugToId, playerNameToId) {
  const rows = [];
  for (const a of awards) {
    const awardType = mapAwardText(a.Award);
    if (!awardType) continue;

    const slug = mapTeamToSlug(a.Team);
    const teamId = slug ? slugToId.get(slug) : null;

    const year = extractYear(a.Date ?? a.Tournament ?? "");

    rows.push({
      team_id: teamId ?? null,
      year: year ?? 0,
      tournament_name: formatTournamentName(a.Tournament ?? a.Award),
      award_type: awardType,
      player_id: playerNameToId.get(a.AwardWinner) ?? null,
      player_name: a.AwardWinner ?? null,
      notes: a.Award,
      source: "leaguepedia",
      leaguepedia_page: a.Tournament ?? null,
    });
  }
  return rows;
}

// ─── 메인 ─────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  // DB에서 팀 slug → id 맵 구성
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, fan_site_host");
  if (teamsErr) throw teamsErr;

  const slugToId = new Map(teams.map((t) => [t.fan_site_host, t.id]));
  console.log(`팀 ${teams.length}개 로드됨`);

  // DB에서 선수명 → id 맵 구성 (개인 수상 연결용)
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, name");
  if (playersErr) throw playersErr;

  const playerNameToId = new Map(players.map((p) => [p.name, p.id]));

  // 수상 데이터 수집 (순차 실행 — 병렬 시 레이트 리밋 발생)
  const lckResults = await fetchLCKPlayoffResults();
  const worldsResults = await fetchWorldsResults();
  const msiResults = await fetchMSIResults();
  const individualAwards = await fetchLCKIndividualAwards();

  // 변환
  const lckRows = await buildAwardRows(lckResults, "lck", slugToId);
  const worldsRows = await buildAwardRows(worldsResults, "worlds", slugToId);
  const msiRows = await buildAwardRows(msiResults, "msi", slugToId);
  const individualRows = await buildIndividualAwardRows(
    individualAwards,
    slugToId,
    playerNameToId
  );

  const allRows = [...lckRows, ...worldsRows, ...msiRows, ...individualRows];

  console.log(`\n총 ${allRows.length}건 수상 데이터:`);
  console.log(`  LCK: ${lckRows.length}건`);
  console.log(`  Worlds: ${worldsRows.length}건`);
  console.log(`  MSI: ${msiRows.length}건`);
  console.log(`  개인 수상: ${individualRows.length}건`);

  if (allRows.length === 0) {
    console.log("수집된 데이터가 없습니다.");
    return;
  }

  // 기존 데이터 삭제 후 재삽입 (leaguepedia 소스만)
  const { error: delErr } = await supabase
    .from("team_awards")
    .delete()
    .eq("source", "leaguepedia");
  if (delErr) throw delErr;

  // 배치 삽입 (100건씩)
  let inserted = 0;
  for (let i = 0; i < allRows.length; i += 100) {
    const batch = allRows.slice(i, i + 100);
    const { error } = await supabase.from("team_awards").insert(batch);
    if (error) {
      console.error(`배치 삽입 오류 (${i}~${i + batch.length}):`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\n✅ ${inserted}건 삽입 완료`);

  // 결과 미리보기
  const { data: preview } = await supabase
    .from("team_awards")
    .select("year, tournament_name, award_type, player_name, teams(short_name)")
    .order("year", { ascending: false })
    .limit(20);

  if (preview?.length) {
    console.log("\n📊 최근 수상 내역 (20건):");
    for (const row of preview) {
      const team = row.teams?.short_name ?? "-";
      const player = row.player_name ? ` (${row.player_name})` : "";
      console.log(`  ${row.year} | ${row.tournament_name} | ${row.award_type} | ${team}${player}`);
    }
  }
}

main().catch((e) => {
  console.error("오류:", e.message);
  process.exit(1);
});
