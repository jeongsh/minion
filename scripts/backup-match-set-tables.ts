import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

// PostgREST가 기본적으로 한 번에 1000행까지만 돌려주므로 range로 전부 페이지네이션한다.
async function fetchAllRows(supabase: SupabaseClient, table: string) {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as Record<string, unknown>[]));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
}

/**
 * matches/sets/set_picks_bans/set_player_stats 전체를 읽어 backups/에
 * 타임스탬프가 붙은 JSON으로 저장한다. 읽기 전용 — 아무것도 쓰지 않는다.
 * DB 브랜치(스테이징)가 없는 프로젝트라, 실제 데이터 복구 적용 전 수동
 * 복구 참고용 스냅샷으로 쓴다.
 *
 * 사용법: npm run backup:match-set-tables
 */

const TABLES = ["matches", "sets", "set_picks_bans", "set_player_stats"] as const;

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = valueParts.join("=");
      }
    }
  } catch {
    // .env.local is optional when env vars are already set.
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function main() {
  loadEnvFile();

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(process.cwd(), "backups", timestamp);
  mkdirSync(backupDir, { recursive: true });

  const summary: Record<string, number> = {};

  for (const table of TABLES) {
    const rows = await fetchAllRows(supabase, table);
    const filePath = resolve(backupDir, `${table}.json`);
    writeFileSync(filePath, JSON.stringify(rows, null, 2), "utf8");
    summary[table] = rows.length;
    console.log(`${table}: ${rows.length}건 저장 -> ${filePath}`);
  }

  console.log("");
  console.log(`백업 완료: ${backupDir}`);
  console.log(JSON.stringify(summary, null, 2));

  if (!existsSync(backupDir)) {
    throw new Error("백업 디렉터리 생성에 실패했습니다.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
