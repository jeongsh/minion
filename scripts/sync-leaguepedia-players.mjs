/**
 * LCK 10팀 선수 정보를 Leaguepedia Cargo API로 수집해 Supabase에 저장한다.
 *
 * 실행: node scripts/sync-leaguepedia-players.mjs
 *
 * 데이터 수집 전략 (순서대로 시도, 팀별 데이터가 없을 때 다음 단계로):
 * 1) TournamentRosters – LCK 2026 토너먼트 후보들을 순서대로 시도
 * 2) TournamentPlayers – 토너먼트별 선수 목록
 * 3) Players (Team 필터) – 현재 팀 기준 직접 조회
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const LEAGUEPEDIA_API = "https://lol.fandom.com/api.php";
const USER_AGENT = "LCKHubMinion/0.1";

/** 시도할 LCK 2026 토너먼트 OverviewPage 후보 (최신순) */
const LCK_2026_TOURNAMENT_CANDIDATES = [
  "LCK/2026 Season/Road to MSI",
  "LCK/2026 Season/Summer Split",
  "LCK/2026 Season/Split 2",
  "LCK/2026 Season/Split 1",
  "LCK/2026 Season/Spring Split",
  "LCK/2026 Season/LCK Cup",
  "LCK/2026 Season/Winter Split",
  "LCK/2026 Season/LCK Cup 2026",
  "LCK 2026 Season/Split 1",
  "LCK 2026 Season/Road to MSI",
  "LCK/2026 Season",
];

/**
 * Players 테이블 직접 조회 시 사용할 Leaguepedia 팀 이름 (메인 팀만, Academy/Challengers 제외).
 * 실제 Leaguepedia에서 확인된 정확한 이름을 사용한다.
 */
const LCK_TEAM_NAMES_FOR_PLAYERS_TABLE = [
  // 현재 확인된 정확한 이름
  "T1",
  "Gen.G",
  "Hanwha Life Esports",
  "Dplus Kia",          // 주의: "Kia" 소문자 (Leaguepedia 기준)
  "KT Rolster",
  "DRX",
  "Nongshim RedForce",  // 주의: "shim" 소문자 (Leaguepedia 기준)
  "HANJIN BRION",       // 주의: 전체 대문자
  "BNK FEARX",          // 주의: 전체 대문자
  "DN SOOPers",         // 주의: "SOOPers" 혼합 대소문자
  // 이전 이름 (이직 선수가 있을 경우 커버)
  "Gen.G Esports",
  "Kiwoom DRX",
  "Dplus KIA",
  "DAMWON KIA",
  "NongShim RedForce",
  "NongShim RedForce Esports",
  "BRION",
  "OK Savings Bank BRION",
  "BNK FearX",
  "DN Soopers",
];

/** Leaguepedia 팀명 → DB slug (Leaguepedia에서 실제 확인된 이름 포함) */
const LEAGUEPEDIA_NAME_TO_SLUG = new Map([
  // 현재 확인된 정확한 이름
  ["T1", "t1"],
  ["Gen.G", "geng"],
  ["Gen.G Esports", "geng"],
  ["Hanwha Life Esports", "hle"],
  ["Dplus Kia", "dk"],        // 확인된 실제 이름
  ["Dplus KIA", "dk"],
  ["Dplus", "dk"],
  ["DAMWON KIA", "dk"],
  ["KT Rolster", "kt"],
  ["DRX", "drx"],
  ["Kiwoom DRX", "drx"],
  ["Nongshim RedForce", "ns"], // 확인된 실제 이름
  ["NongShim RedForce", "ns"],
  ["NongShim RedForce Esports", "ns"],
  ["HANJIN BRION", "bro"],     // 확인된 실제 이름
  ["BRION", "bro"],
  ["OK Savings Bank BRION", "bro"],
  ["Hanjin Brion", "bro"],
  ["BNK FEARX", "fox"],        // 확인된 실제 이름
  ["BNK FearX", "fox"],
  ["BNK1337", "fox"],
  ["Freecs", "fox"],
  ["DN SOOPers", "soop"],      // 확인된 실제 이름
  ["DN Soopers", "soop"],
  ["Nongshim DNS", "soop"],
]);

/** Leaguepedia 역할 → DB position */
const ROLE_MAP = {
  top: "TOP",
  jungle: "JGL",
  jgl: "JGL",
  mid: "MID",
  middle: "MID",
  bot: "BOT",
  bottom: "BOT",
  adc: "BOT",
  support: "SUP",
  sup: "SUP",
};

/** 선수가 아닌 역할 (코치, 분석가 등) */
const NON_PLAYER_ROLES = new Set([
  "analyst",
  "coach",
  "head coach",
  "assistant coach",
  "manager",
  "general manager",
  "team manager",
  "strategic coach",
  "content",
  "translator",
]);

// ─── 유틸 ─────────────────────────────────────────────

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch {
    // .env.local optional
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} environment variable is required`);
  return v;
}

function normalizeRole(role) {
  return ROLE_MAP[role?.toLowerCase()?.trim()] ?? null;
}

function isNonPlayerRole(role) {
  return NON_PLAYER_ROLES.has(role?.toLowerCase()?.trim() ?? "");
}

function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function displayNameFromLeaguepediaPage(pageName) {
  return String(pageName ?? "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

async function findExistingPlayerId(supabase, { slug, leaguepediaPage, displayName }) {
  const { data: byPage, error: byPageError } = await supabase
    .from("players")
    .select("id")
    .eq("leaguepedia_page", leaguepediaPage)
    .maybeSingle();
  if (byPageError) throw byPageError;
  if (byPage?.id) return byPage.id;

  const { data: bySlug, error: bySlugError } = await supabase
    .from("players")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (bySlugError) throw bySlugError;
  if (bySlug?.id) return bySlug.id;

  const { data: byName, error: byNameError } = await supabase
    .from("players")
    .select("id")
    .eq("name", displayName)
    .maybeSingle();
  if (byNameError) throw byNameError;
  return byName?.id ?? null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * RosterLinks / Roles 문자열 파싱.
 * Leaguepedia는 ",," 구분자를 사용한다.
 */
function parseRosterField(raw) {
  if (!raw) return [];
  const sep = raw.includes(",,") ? ",," : ",";
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Leaguepedia Cargo API ────────────────────────────

async function cargoQuery(params, retries = 6) {
  const url = new URL(LEAGUEPEDIA_API);
  url.searchParams.set("action", "cargoquery");
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) throw new Error(`Leaguepedia HTTP ${response.status}`);

    const json = await response.json();

    if (json.error) {
      if (json.error.code === "ratelimited" && attempt < retries) {
        const wait = Math.min(attempt * 20_000, 120_000);
        console.warn(`  [rate limit] waiting ${wait / 1000}s (attempt ${attempt}/${retries})...`);
        await sleep(wait);
        continue;
      }
      // MWException 등 서버 내부 에러: 재시도
      if (json.error.code?.startsWith("internal") && attempt < retries) {
        const wait = 5_000;
        console.warn(`  [server error] retrying in ${wait / 1000}s... (${json.error.code})`);
        await sleep(wait);
        continue;
      }
      throw new Error(`Leaguepedia [${json.error.code}]: ${json.error.info}`);
    }

    await sleep(2000);
    return (json.cargoquery ?? []).map((row) => row.title);
  }

  throw new Error("Leaguepedia: max retries exceeded");
}

/** TournamentRosters 테이블 조회 (최소 필드만 사용) */
async function fetchTournamentRosters(tournament) {
  return cargoQuery({
    tables: "TournamentRosters",
    fields: "Team,RosterLinks,Roles",
    where: `Tournament='${tournament.replace(/'/g, "\\'")}'`,
    limit: "20",
  });
}

/** TournamentPlayers 테이블 조회 (폴백 1) */
async function fetchTournamentPlayers(tournament) {
  return cargoQuery({
    tables: "TournamentPlayers",
    fields: "Player,Team,Role",
    where: `Tournament='${tournament.replace(/'/g, "\\'")}'`,
    limit: "200",
  });
}

/** Leaguepedia Image 필드(파일명)를 실제 URL로 변환한다. */
async function resolveImageUrls(filenames) {
  const result = new Map();
  const toResolve = [...new Set(
    filenames
      .map((value) => value?.trim())
      .filter(Boolean)
      .map((value) => value.replace(/^File:/i, ""))
      .filter((value) => !/^https?:\/\//i.test(value)),
  )];

  for (const value of filenames) {
    const trimmed = value?.trim();
    if (trimmed && /^https?:\/\//i.test(trimmed)) {
      result.set(trimmed, trimmed);
    }
  }

  const CHUNK = 40;
  for (let i = 0; i < toResolve.length; i += CHUNK) {
    const chunk = toResolve.slice(i, i + CHUNK);
    const titles = chunk.map((name) => `File:${name}`).join("|");
    const url = new URL(LEAGUEPEDIA_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url");
    url.searchParams.set("titles", titles);

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) throw new Error(`Leaguepedia image HTTP ${response.status}`);

    const json = await response.json();
    if (json.error) {
      throw new Error(`Leaguepedia image [${json.error.code}]: ${json.error.info}`);
    }

    for (const page of Object.values(json.query?.pages ?? {})) {
      const imageUrl = page.imageinfo?.[0]?.url?.trim();
      if (!imageUrl || !page.title) continue;
      result.set(page.title.replace(/^File:/i, ""), imageUrl);
    }

    await sleep(2000);
  }

  return result;
}

const PLAYER_IMAGE_PLACEHOLDER = "Unknown Infobox Image - Player.png";
const PLAYER_IMAGE_FIELDS = "PI.Link,PI.FileName,PI.IsProfileImage,PI.SortDate,PI.Tournament";

function isValidPlayerImageFilename(filename) {
  const normalized = filename?.trim();
  return !!normalized && normalized !== PLAYER_IMAGE_PLACEHOLDER;
}

function imageYearFromFilename(filename) {
  const years = [...filename.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  return years.length > 0 ? Math.max(...years) : 0;
}

function imageSplitFromFilename(filename) {
  const split = filename.match(/Split\s*(\d+)/i);
  if (split) return Number(split[1]);
  if (/\b(Worlds|World Championship|WC|MSI|Cup|Road to MSI)\b/i.test(filename)) return 99;
  return 0;
}

function comparePlayerImageCandidates(left, right) {
  const profileDelta = Number(right.IsProfileImage === "1") - Number(left.IsProfileImage === "1");
  if (profileDelta !== 0) return profileDelta;

  const leftName = left.FileName?.trim() ?? "";
  const rightName = right.FileName?.trim() ?? "";
  const yearDelta = imageYearFromFilename(rightName) - imageYearFromFilename(leftName);
  if (yearDelta !== 0) return yearDelta;

  const splitDelta = imageSplitFromFilename(rightName) - imageSplitFromFilename(leftName);
  if (splitDelta !== 0) return splitDelta;

  const sortDateDelta = (right.SortDate?.trim() ?? "").localeCompare(left.SortDate?.trim() ?? "");
  if (sortDateDelta !== 0) return sortDateDelta;

  return rightName.localeCompare(leftName);
}

function pickBestPlayerImage(rows) {
  const valid = rows.filter((row) => isValidPlayerImageFilename(row.FileName));
  if (valid.length === 0) return null;
  valid.sort(comparePlayerImageCandidates);
  return valid[0]?.FileName?.trim() ?? null;
}

function pickBestImageForLinks(rows, links) {
  const linkSet = new Set(links.map((link) => link.trim()).filter(Boolean));
  return pickBestPlayerImage(rows.filter((row) => linkSet.has(row.Link?.trim() ?? "")));
}

function pickProfileImageFilename(playersImage, imageRows, links) {
  const bestFromImages = pickBestImageForLinks(imageRows, links);
  const normalizedPlayersImage = playersImage?.trim();

  if (!isValidPlayerImageFilename(normalizedPlayersImage)) {
    return bestFromImages;
  }
  if (!bestFromImages) {
    return normalizedPlayersImage;
  }

  const left = { FileName: normalizedPlayersImage, IsProfileImage: "1" };
  const right = { FileName: bestFromImages, IsProfileImage: "1" };
  return comparePlayerImageCandidates(left, right) >= 0 ? bestFromImages : normalizedPlayersImage;
}

/** PlayerImages / PlayerRedirects / Players.Image 순으로 최신 프로필 이미지 파일명을 조회한다. */
async function fetchPlayerImagesByPages(pageNames) {
  const result = new Map();
  const CHUNK = 40;

  for (let i = 0; i < pageNames.length; i += CHUNK) {
    const chunk = pageNames.slice(i, i + CHUNK);
    const escaped = chunk.map((name) => name.replace(/'/g, "\\'"));

    const playerRows = await cargoQuery({
      tables: "Players",
      fields: "ID,Image",
      where: `ID IN ('${escaped.join("','")}')`,
      limit: String(CHUNK + 10),
    });
    const playerImageByPage = new Map(
      playerRows
        .map((row) => [row.ID?.trim(), row.Image?.trim()])
        .filter(([page, image]) => page && isValidPlayerImageFilename(image)),
    );

    const imageRows = await cargoQuery({
      tables: "PlayerImages=PI",
      fields: PLAYER_IMAGE_FIELDS,
      where: `PI.Link IN ('${escaped.join("','")}')`,
      limit: "500",
    });

    for (const page of chunk) {
      const best = pickProfileImageFilename(playerImageByPage.get(page), imageRows, [page]);
      if (best) result.set(page, best);
    }

    const missing = chunk.filter((name) => !result.has(name));
    if (missing.length > 0) {
      const missingEscaped = missing.map((name) => name.replace(/'/g, "\\'"));
      const redirectRows = await cargoQuery({
        tables: "PlayerRedirects=PR",
        fields: "PR.OverviewPage,PR.AllName",
        where: `PR.OverviewPage IN ('${missingEscaped.join("','")}')`,
        limit: "500",
      });

      const redirectNamesByOverview = new Map();
      for (const redirect of redirectRows) {
        const overviewPage = redirect.OverviewPage?.trim();
        const allName = redirect.AllName?.trim();
        if (!overviewPage || !allName) continue;
        const names = redirectNamesByOverview.get(overviewPage) ?? [];
        names.push(allName);
        redirectNamesByOverview.set(overviewPage, names);
      }

      const redirectNames = [...new Set([...redirectNamesByOverview.values()].flat())];
      if (redirectNames.length > 0) {
        const redirectEscaped = redirectNames.map((name) => name.replace(/'/g, "\\'"));
        const redirectImages = await cargoQuery({
          tables: "PlayerImages=PI",
          fields: PLAYER_IMAGE_FIELDS,
          where: `PI.Link IN ('${redirectEscaped.join("','")}')`,
          limit: "500",
        });

        for (const [overviewPage, names] of redirectNamesByOverview) {
          const best = pickProfileImageFilename(
            playerImageByPage.get(overviewPage),
            redirectImages,
            names,
          );
          if (best) result.set(overviewPage, best);
        }
      }
    }
  }

  return result;
}

function profileImageUrlFor(page, imageByPage, imageUrls) {
  const rawImage = imageByPage.get(page)?.trim();
  if (!rawImage) return null;
  if (/^https?:\/\//i.test(rawImage)) return rawImage;
  const filename = rawImage.replace(/^File:/i, "");
  return imageUrls.get(filename) ?? null;
}

/** Players 테이블에서 팀별 직접 조회 (폴백 2) */
async function fetchPlayersByTeamNames(teamNames) {
  const escaped = teamNames.map((n) => n.replace(/'/g, "\\'"));
  return cargoQuery({
    tables: "Players",
    fields: "ID,Name,NationalityPrimary,Birthdate,Role,Team,Image",
    where: `Team IN ('${escaped.join("','")}')`,
    order_by: "Team,Role",
    limit: "300",
  });
}

/**
 * Players 테이블에서 팀 이름 LIKE 패턴으로 조회 (폴백 3)
 * 팀 이름이 정확히 매칭되지 않을 때 사용
 */
async function fetchPlayersByTeamLike(patterns) {
  const conditions = patterns.map((p) => `Team LIKE '%${p.replace(/'/g, "\\'")}%'`);
  return cargoQuery({
    tables: "Players",
    fields: "ID,Name,NationalityPrimary,Birthdate,Role,Team,Image",
    where: conditions.join(" OR "),
    order_by: "Team,Role",
    limit: "200",
  });
}

/** 선수 ID 목록으로 Players 상세 일괄 조회 */
async function fetchPlayerDetailsByIds(pageNames) {
  if (pageNames.length === 0) return new Map();

  const CHUNK = 40;
  const result = new Map();

  for (let i = 0; i < pageNames.length; i += CHUNK) {
    const chunk = pageNames.slice(i, i + CHUNK);
    const escaped = chunk.map((n) => n.replace(/'/g, "\\'"));
    const rows = await cargoQuery({
      tables: "Players",
      fields: "ID,Name,NationalityPrimary,Birthdate,Role,Team,Image",
      where: `ID IN ('${escaped.join("','")}')`,
      limit: String(CHUNK + 10),
    });
    for (const row of rows) {
      if (row.ID) result.set(row.ID, row);
    }
  }

  return result;
}

// ─── 메인 ─────────────────────────────────────────────

async function sync() {
  loadEnvFile();

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1. Supabase 팀 목록 로드
  const { data: teamRows, error: teamError } = await supabase
    .from("teams")
    .select("id, slug, name, leaguepedia_page");
  if (teamError) throw teamError;

  const slugToTeam = new Map(teamRows.map((t) => [t.slug, t]));
  const lpPageToTeam = new Map(
    teamRows.filter((t) => t.leaguepedia_page).map((t) => [t.leaguepedia_page, t]),
  );

  function resolveTeam(lpTeamName) {
    if (!lpTeamName) return null;
    if (lpPageToTeam.has(lpTeamName)) return lpPageToTeam.get(lpTeamName);
    const slug = LEAGUEPEDIA_NAME_TO_SLUG.get(lpTeamName);
    return slug ? slugToTeam.get(slug) : null;
  }

  console.log(`Loaded ${teamRows.length} teams from Supabase.`);

  // teamSlug → { teamId, players: [{page, role, isSub}] }
  const teamRosters = new Map();

  // ── 1차: TournamentRosters ──
  console.log("\n[1차] TournamentRosters 조회...");
  for (const tournament of LCK_2026_TOURNAMENT_CANDIDATES) {
    if (teamRosters.size >= 10) break;

    process.stdout.write(`  → ${tournament} ... `);
    let rosters;
    try {
      rosters = await fetchTournamentRosters(tournament);
    } catch (err) {
      console.log(`Error: ${err.message}`);
      continue;
    }

    if (rosters.length === 0) {
      console.log("(no data)");
      continue;
    }
    console.log(`${rosters.length} team(s)`);

    for (const roster of rosters) {
      const team = resolveTeam(roster.Team);
      if (!team || teamRosters.has(team.slug)) continue;

      const pages = parseRosterField(roster.RosterLinks);
      const roles = parseRosterField(roster.Roles);
      const players = pages
        .map((page, i) => ({ page, role: roles[i] ?? "", isSub: false }))
        .filter((p) => p.page);

      if (players.length > 0) {
        teamRosters.set(team.slug, { teamId: team.id, players });
        console.log(`    ${team.slug}: ${players.map((p) => p.page).join(", ")}`);
      }
    }
  }

  // ── 2차: TournamentPlayers (1차에서 빠진 팀) ──
  const missingAfterStep1 = teamRows.map((t) => t.slug).filter((s) => !teamRosters.has(s));
  if (missingAfterStep1.length > 0) {
    console.log(`\n[2차] TournamentPlayers 조회 (missing: ${missingAfterStep1.join(", ")})...`);

    for (const tournament of LCK_2026_TOURNAMENT_CANDIDATES) {
      if (missingAfterStep1.every((s) => teamRosters.has(s))) break;

      process.stdout.write(`  → ${tournament} ... `);
      let tPlayers;
      try {
        tPlayers = await fetchTournamentPlayers(tournament);
      } catch (err) {
        console.log(`Error: ${err.message}`);
        continue;
      }

      if (tPlayers.length === 0) {
        console.log("(no data)");
        continue;
      }
      console.log(`${tPlayers.length} player entries`);

      for (const entry of tPlayers) {
        const team = resolveTeam(entry.Team);
        if (!team || teamRosters.has(team.slug)) continue;
        if (isNonPlayerRole(entry.Role)) continue;

        if (!teamRosters.has(team.slug)) {
          teamRosters.set(team.slug, { teamId: team.id, players: [] });
        }
        const existing = teamRosters.get(team.slug).players;
        if (!existing.find((p) => p.page === entry.Player)) {
          existing.push({ page: entry.Player, role: entry.Role ?? "", isSub: false });
        }
      }

      for (const slug of missingAfterStep1) {
        if (teamRosters.has(slug)) {
          const { players } = teamRosters.get(slug);
          console.log(`    ${slug}: ${players.map((p) => p.page).join(", ")}`);
        }
      }
    }
  }

  // ── 3차: Players 테이블 직접 조회 (여전히 빠진 팀) ──
  const missingAfterStep2 = teamRows.map((t) => t.slug).filter((s) => !teamRosters.has(s));
  if (missingAfterStep2.length > 0) {
    console.log(`\n[3차] Players 테이블 직접 조회 (missing: ${missingAfterStep2.join(", ")})...`);

    const alreadyCollected = new Set(teamRosters.keys());

    function addPlayersFromDirectQuery(directPlayers) {
      for (const player of directPlayers) {
        const team = resolveTeam(player.Team);
        if (!team) continue;
        if (alreadyCollected.has(team.slug)) continue;
        if (isNonPlayerRole(player.Role)) continue;
        if (!normalizeRole(player.Role)) continue;

        if (!teamRosters.has(team.slug)) {
          teamRosters.set(team.slug, { teamId: team.id, players: [] });
        }
        const existing = teamRosters.get(team.slug).players;
        if (!existing.find((p) => p.page === player.ID)) {
          existing.push({ page: player.ID, role: player.Role ?? "", isSub: false });
        }
      }
    }

    // 3-A: 정확한 팀 이름 목록으로 조회
    try {
      const directPlayers = await fetchPlayersByTeamNames(LCK_TEAM_NAMES_FOR_PLAYERS_TABLE);
      console.log(`  [3-A] ${directPlayers.length}명 조회됨`);
      addPlayersFromDirectQuery(directPlayers);
    } catch (err) {
      console.error(`  [3-A] 실패: ${err.message}`);
    }

    // 3-B: 여전히 없는 팀을 위해 LIKE 패턴으로 추가 시도
    const stillMissing = missingAfterStep2.filter((s) => !teamRosters.has(s));
    if (stillMissing.length > 0) {
      console.log(`  [3-B] LIKE 패턴 조회 (${stillMissing.join(", ")})...`);
      const patterns = {
        dk: ["Dplus", "KIA"],
        fox: ["FearX", "BNK"],
        ns: ["NongShim", "RedForce"],
        soop: ["Soopers", "Soop"],
        bro: ["BRION", "Brion"],
      };
      const activePatterns = stillMissing.flatMap((s) => patterns[s] ?? []);
      if (activePatterns.length > 0) {
        try {
          const likePlayers = await fetchPlayersByTeamLike(activePatterns);
          console.log(`  [3-B] ${likePlayers.length}명 조회됨`);
          // 디버그: 어떤 팀 이름들이 나왔는지 출력
          const foundTeamNames = [...new Set(likePlayers.map((p) => p.Team))];
          if (foundTeamNames.length > 0) {
            console.log(`  [3-B] 발견된 팀 이름: ${foundTeamNames.join(", ")}`);
            // 발견된 팀 이름을 LEAGUEPEDIA_NAME_TO_SLUG 에 추가
            for (const tName of foundTeamNames) {
              for (const slug of stillMissing) {
                const team = slugToTeam.get(slug);
                if (team && !LEAGUEPEDIA_NAME_TO_SLUG.has(tName)) {
                  const lower = tName.toLowerCase();
                  const patList = patterns[slug] ?? [];
                  if (patList.some((p) => lower.includes(p.toLowerCase()))) {
                    LEAGUEPEDIA_NAME_TO_SLUG.set(tName, slug);
                    console.log(`  [3-B] 자동 매핑: "${tName}" → ${slug}`);
                  }
                }
              }
            }
          }
          addPlayersFromDirectQuery(likePlayers);
        } catch (err) {
          console.error(`  [3-B] 실패: ${err.message}`);
        }
      }
    }

    for (const slug of missingAfterStep2) {
      if (teamRosters.has(slug)) {
        const { players } = teamRosters.get(slug);
        console.log(`  ${slug}: ${players.map((p) => p.page).join(", ")}`);
      } else {
        console.warn(`  ${slug}: 데이터 없음 (Leaguepedia 팀 이름 확인 필요)`);
      }
    }
  }

  const totalTeams = teamRosters.size;
  const totalPlayers = [...teamRosters.values()].reduce((s, { players }) => s + players.length, 0);
  console.log(`\nRoster data: ${totalTeams}/10 teams, ${totalPlayers} players total.`);

  if (totalTeams === 0) {
    console.error("No player data collected. Exiting.");
    process.exit(1);
  }

  // 4. 선수 상세 정보 일괄 조회
  const allPageNames = [...teamRosters.values()].flatMap(({ players }) =>
    players.map((p) => p.page),
  );

  console.log(`\nFetching details for ${allPageNames.length} player(s)...`);
  const playerDetails = await fetchPlayerDetailsByIds(allPageNames);
  console.log(`  Details fetched: ${playerDetails.size}`);

  console.log(`\nFetching profile images for ${allPageNames.length} player(s)...`);
  const imageByPage = await fetchPlayerImagesByPages(allPageNames);
  console.log(`  Image filenames fetched: ${imageByPage.size}`);

  const imageFilenames = [...imageByPage.values()];
  console.log(`\nResolving ${imageFilenames.length} profile image(s)...`);
  const imageUrls = await resolveImageUrls(imageFilenames);
  console.log(`  Image URLs resolved: ${imageUrls.size}`);

  // 5. Supabase upsert
  const summary = { created: 0, updated: 0, skipped: [] };

  for (const [teamSlug, { teamId, players }] of teamRosters) {
    console.log(`\nUpserting ${teamSlug} (${players.length})...`);

    for (const playerRef of players) {
      const details = playerDetails.get(playerRef.page);
      const position =
        normalizeRole(playerRef.role) ?? normalizeRole(details?.Role);

      if (!position) {
        summary.skipped.push({
          page: playerRef.page,
          role: playerRef.role,
          detailsRole: details?.Role,
        });
        console.warn(`  Skip ${playerRef.page}: unknown role "${playerRef.role}" / "${details?.Role}"`);
        continue;
      }

      const displayName = displayNameFromLeaguepediaPage(playerRef.page);
      const slug = makeSlug(displayName);

      const rawDate = details?.Birthdate?.trim();
      const birthDate =
        rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;

      const payload = {
        slug,
        name: displayName,
        real_name: details?.Name?.trim() || null,
        team_id: teamId,
        position,
        nationality: details?.NationalityPrimary?.trim() || null,
        birth_date: birthDate,
        leaguepedia_page: playerRef.page,
        source_player_id: `lp:${playerRef.page}`,
        profile_image_url: profileImageUrlFor(playerRef.page, imageByPage, imageUrls),
      };

      const existingId = await findExistingPlayerId(supabase, {
        slug,
        leaguepediaPage: playerRef.page,
        displayName,
      });

      if (existingId) {
        const { error } = await supabase
          .from("players")
          .update(payload)
          .eq("id", existingId);
        if (error) throw error;
        summary.updated++;
        console.log(`  Updated: ${displayName} (${playerRef.page}) [${position}]`);
      } else {
        const { error } = await supabase.from("players").insert(payload);
        if (error) throw error;
        summary.created++;
        console.log(`  Created: ${displayName} (${playerRef.page}) [${position}]`);
      }
    }
  }

  console.log("\n=== Sync Complete ===");
  console.log(
    `Created: ${summary.created}, Updated: ${summary.updated}, Skipped: ${summary.skipped.length}`,
  );
  if (summary.skipped.length > 0) {
    console.log("Skipped details:", JSON.stringify(summary.skipped, null, 2));
  }
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
