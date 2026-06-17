import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

type ChampionRow = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  ddragon_id: string | null;
  ddragon_key: string | null;
  ddragon_version: string | null;
};

type ChampionFix = {
  canonicalId: string;
  slug: string;
  name: string;
  aliases: string[];
};

const CHAMPION_FIXES: ChampionFix[] = [
  {
    canonicalId: "Renata",
    slug: "renata",
    name: "레나타 글라스크",
    aliases: ["RenataGlasc", "Renata Glasc", "renata-glasc"],
  },
  {
    canonicalId: "MonkeyKing",
    slug: "monkey-king",
    name: "오공",
    aliases: ["Wukong", "wukong"],
  },
  {
    canonicalId: "Kaisa",
    slug: "kai-sa",
    name: "카이사",
    aliases: ["Kai'Sa", "kai sa", "kai-sa"],
  },
  {
    canonicalId: "Khazix",
    slug: "kha-zix",
    name: "카직스",
    aliases: ["Kha'Zix", "kha zix", "kha-zix"],
  },
  {
    canonicalId: "Leblanc",
    slug: "leblanc",
    name: "르블랑",
    aliases: ["LeBlanc", "le blanc"],
  },
  {
    canonicalId: "Fiddlesticks",
    slug: "fiddlesticks",
    name: "피들스틱",
    aliases: ["fiddle sticks"],
  },
  {
    canonicalId: "Yunara",
    slug: "yunara",
    name: "유나라",
    aliases: [],
  },
  {
    canonicalId: "Zaahen",
    slug: "zaahen",
    name: "자헨",
    aliases: ["Zaehen", "zaehen"],
  },
];

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
    // optional
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
}

function championImageUrl(canonicalId: string) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${canonicalId}_0.jpg`;
}

function canonicalIdForRow(row: ChampionRow, aliasToCanonicalId: Map<string, string>) {
  const key = normalizeKey(row.ddragon_id || row.slug || row.name);
  return aliasToCanonicalId.get(key) ?? key;
}

function scoreRow(row: ChampionRow, fix: ChampionFix) {
  let score = 0;

  if (row.ddragon_id === fix.canonicalId) score += 8;
  if (normalizeKey(row.slug) === normalizeKey(fix.slug)) score += 4;
  if (row.name === fix.name) score += 2;
  if (row.image_url) score += 1;
  if (row.ddragon_version) score += 1;

  return score;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

async function updateTableChampionIds(
  supabase: any,
  tableName: "set_picks_bans" | "set_player_stats" | "soloq_matches" | "community_posts",
  fromChampionId: string,
  toChampionId: string,
) {
  const { error } = await supabase
    .from(tableName)
    .update({ champion_id: toChampionId })
    .eq("champion_id", fromChampionId);

  if (error) {
    throw new Error(`${tableName}: ${error.message}`);
  }
}

async function main() {
  loadEnvFile();
  const apply = process.argv.includes("--apply");

  const supabase: any = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase
    .from("champions")
    .select("id, slug, name, image_url, ddragon_id, ddragon_key, ddragon_version")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const champions = (data ?? []) as ChampionRow[];
  const aliasToCanonicalId = new Map<string, string>();
  const fixByCanonicalId = new Map<string, ChampionFix>();

  for (const fix of CHAMPION_FIXES) {
    fixByCanonicalId.set(fix.canonicalId, fix);
    for (const alias of unique([fix.canonicalId, fix.slug, fix.name, ...fix.aliases])) {
      aliasToCanonicalId.set(normalizeKey(alias), fix.canonicalId);
    }
  }

  const groups = new Map<string, ChampionRow[]>();
  for (const champion of champions) {
    const canonicalId = canonicalIdForRow(champion, aliasToCanonicalId);
    const rows = groups.get(canonicalId) ?? [];
    rows.push(champion);
    groups.set(canonicalId, rows);
  }

  const plannedUpdates: Array<{
    row: ChampionRow;
    fix: ChampionFix;
    next: Partial<ChampionRow>;
  }> = [];
  const plannedDeletes: Array<{ row: ChampionRow; keeper: ChampionRow; fix: ChampionFix }> = [];
  const plannedTransfers: Array<{ from: ChampionRow; to: ChampionRow; fix: ChampionFix }> = [];

  for (const fix of CHAMPION_FIXES) {
    const group = groups.get(fix.canonicalId) ?? [];
    if (group.length === 0) {
      console.log(`missing: ${fix.canonicalId} (${fix.name})`);
      continue;
    }

    const keeper = [...group].sort((a, b) => scoreRow(b, fix) - scoreRow(a, fix))[0];
    const desired: Partial<ChampionRow> = {
      slug: fix.slug,
      name: fix.name,
      ddragon_id: fix.canonicalId,
      image_url: championImageUrl(fix.canonicalId),
    };

    const needsUpdate =
      keeper.slug !== desired.slug ||
      keeper.name !== desired.name ||
      keeper.ddragon_id !== desired.ddragon_id ||
      keeper.image_url !== desired.image_url;

    if (needsUpdate) {
      plannedUpdates.push({ row: keeper, fix, next: desired });
    }

    for (const row of group) {
      if (row.id === keeper.id) continue;
      plannedTransfers.push({ from: row, to: keeper, fix });
      plannedDeletes.push({ row, keeper, fix });
    }
  }

  console.log(`champions loaded: ${champions.length}`);
  console.log(`row updates: ${plannedUpdates.length}`);
  console.log(`row transfers: ${plannedTransfers.length}`);
  console.log(`row deletes: ${plannedDeletes.length}`);

  for (const item of plannedUpdates) {
    console.log(
      `update ${item.fix.canonicalId}: ${item.row.slug} -> ${item.next.slug}, ${item.row.name} -> ${item.next.name}`,
    );
  }

  for (const item of plannedTransfers) {
    console.log(`transfer ${item.fix.canonicalId}: ${item.from.id} -> ${item.to.id}`);
  }

  if (!apply) {
    console.log("dry run only; pass --apply to write changes");
    return;
  }

  for (const item of plannedUpdates) {
    const { error: updateError } = await supabase
      .from("champions")
      .update({
        slug: item.next.slug,
        name: item.next.name,
        ddragon_id: item.next.ddragon_id,
        image_url: item.next.image_url,
      })
      .eq("id", item.row.id);

    if (updateError) {
      throw new Error(`champions/${item.fix.canonicalId}: ${updateError.message}`);
    }
  }

  for (const item of plannedTransfers) {
    await updateTableChampionIds(supabase, "set_picks_bans", item.from.id, item.to.id);
    await updateTableChampionIds(supabase, "set_player_stats", item.from.id, item.to.id);
    await updateTableChampionIds(supabase, "soloq_matches", item.from.id, item.to.id);
    await updateTableChampionIds(supabase, "community_posts", item.from.id, item.to.id);

    const { error: statsError } = await supabase
      .from("champion_stats_pro")
      .update({ champion_id: item.to.id })
      .eq("champion_id", item.from.id);

    if (statsError) {
      throw new Error(`champion_stats_pro: ${statsError.message}`);
    }
  }

  for (const item of plannedDeletes) {
    const { error: deleteError } = await supabase.from("champions").delete().eq("id", item.row.id);
    if (deleteError) {
      throw new Error(`champions delete ${item.row.id}: ${deleteError.message}`);
    }
  }

  console.log("champion cleanup complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
