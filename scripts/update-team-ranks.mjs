import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=");
    }
  } catch {}
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 네이버 e스포츠 LCK 2026 팀 순위 실제 데이터
const STANDINGS = [
  { slug: "hle",  rank: 1,  wins: 15, losses: 3,  set_diff: 21,  win_rate: 0.8333, kda: 4.43, kills: 781, deaths: 590, assists: 1834 },
  { slug: "t1",   rank: 2,  wins: 14, losses: 4,  set_diff: 20,  win_rate: 0.7778, kda: 3.96, kills: 691, deaths: 562, assists: 1535 },
  { slug: "geng", rank: 3,  wins: 14, losses: 4,  set_diff: 19,  win_rate: 0.7778, kda: 5.39, kills: 714, deaths: 457, assists: 1749 },
  { slug: "kt",   rank: 4,  wins: 13, losses: 5,  set_diff: 11,  win_rate: 0.7222, kda: 4.05, kills: 650, deaths: 539, assists: 1532 },
  { slug: "dk",   rank: 5,  wins: 11, losses: 7,  set_diff: 6,   win_rate: 0.6111, kda: 3.51, kills: 569, deaths: 515, assists: 1240 },
  { slug: "bro",  rank: 6,  wins: 6,  losses: 12, set_diff: -8,  win_rate: 0.3333, kda: 3.20, kills: 549, deaths: 549, assists: 1210 },
  { slug: "fox",  rank: 7,  wins: 6,  losses: 12, set_diff: -11, win_rate: 0.3333, kda: 2.72, kills: 526, deaths: 649, assists: 1238 },
  { slug: "drx",  rank: 8,  wins: 5,  losses: 13, set_diff: -12, win_rate: 0.2778, kda: 2.70, kills: 596, deaths: 721, assists: 1351 },
  { slug: "ns",   rank: 9,  wins: 5,  losses: 13, set_diff: -15, win_rate: 0.2778, kda: 2.51, kills: 579, deaths: 758, assists: 1324 },
  { slug: "soop", rank: 10, wins: 1,  losses: 17, set_diff: -31, win_rate: 0.0556, kda: 1.63, kills: 321, deaths: 647, assists: 733  },
];

async function getOrCreateTournament() {
  const { data: existing } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("season", 2026)
    .eq("region", "LCK")
    .maybeSingle();

  if (existing) {
    console.log(`  기존 토너먼트: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("tournaments")
    .insert({ name: "LCK 2026", season: 2026, category: "official", region: "LCK", league: "LCK" })
    .select("id, name")
    .single();

  if (error) {
    console.error("토너먼트 생성 실패:", error.message);
    process.exit(1);
  }

  console.log(`  토너먼트 생성: ${created.name} (${created.id})`);
  return created.id;
}

async function main() {
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, slug, name");

  if (teamsError) {
    console.error("팀 조회 실패:", teamsError.message);
    process.exit(1);
  }

  const slugToTeam = Object.fromEntries(teams.map((t) => [t.slug, t]));

  console.log("토너먼트 조회 중...");
  const tournamentId = await getOrCreateTournament();

  console.log("\n순위 저장 중...");
  let ok = 0;
  for (const s of STANDINGS) {
    const team = slugToTeam[s.slug];
    if (!team) {
      console.warn(`  슬러그 없음: ${s.slug}`);
      continue;
    }

    const { error } = await supabase
      .from("team_standings")
      .upsert(
        {
          tournament_id: tournamentId,
          team_id: team.id,
          rank: s.rank,
          wins: s.wins,
          losses: s.losses,
          set_diff: s.set_diff,
          win_rate: s.win_rate,
          kda: s.kda,
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
        },
        { onConflict: "tournament_id,team_id" }
      );

    if (error) {
      if (error.message.includes("team_standings") || error.code === "42P01") {
        console.error(
          "\n[오류] team_standings 테이블이 없습니다.\n" +
          "Supabase Dashboard > SQL Editor 에서 아래 파일 내용을 실행하세요:\n" +
          "  supabase/migrations/20260615000002_add_lck_rank_to_teams.sql\n"
        );
        process.exit(1);
      }
      console.error(`  ${s.slug} 실패:`, error.message);
    } else {
      console.log(`  ${s.rank}위: ${team.name} (${s.wins}W ${s.losses}L  득실 ${s.set_diff > 0 ? "+" : ""}${s.set_diff})`);
      ok++;
    }
  }

  console.log(`\n완료: ${ok}/${STANDINGS.length}팀`);
}

main();
