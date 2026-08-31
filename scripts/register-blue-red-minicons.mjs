import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const envSource = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").replace(/^\uFEFF/, "");
for (const line of envSource.split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator < 1 || line.trimStart().startsWith("#")) continue;
  const key = line.slice(0, separator).trim();
  const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  if (
    key === "NEXT_PUBLIC_SUPABASE_URL"
    || key === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    || key === "SUPABASE_SERVICE_ROLE_KEY"
  ) {
    process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Supabase URL, publishable key, and service role key are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicSupabase = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const slug = "blue-red-community-v1";
const oldSlug = "minion-starter";
const publicDirectory = path.join(process.cwd(), "public", "minicons", slug);
const itemDefinitions = [
  ["좋아요", "01-like.png"],
  ["싫어요", "02-dislike.png"],
  ["리폿", "03-report.png"],
  ["박제", "04-pin.png"],
  ["메모", "05-memo.png"],
  ["ㄹㅇ;", "06-for-real.png"],
  ["ㅋㅋㅋ", "07-lol.png"],
  ["뭐죠?", "08-what.png"],
  ["이건 좀", "09-this-is-a-bit.png"],
  ["긁?", "10-triggered.png"],
  ["팝콘", "11-popcorn.png"],
  ["비상", "12-emergency.png"],
  ["노관심", "13-no-interest.png"],
  ["이마짚", "14-facepalm.png"],
  ["이게 나야", "15-this-is-me.png"],
  ["해줘", "16-do-it-for-me.png"],
  ["밴픽차이", "17-draft-diff.png"],
  ["범인 찾음", "18-found-culprit.png"],
  ["또 너야?", "19-you-again.png"],
  ["팀탓 ON", "20-team-blame-on.png"],
  ["유관 행동", "21-winner-behavior.png"],
  ["무관 행동", "22-no-title-behavior.png"],
  ["빨간약", "23-red-pill.png"],
  ["긁혔누", "24-triggered-nu.png"],
];

const itemRows = itemDefinitions.map(([name, file], sortOrder) => {
  const filePath = path.join(publicDirectory, file);
  const { size } = fs.statSync(filePath);
  return {
    name,
    file_name: file,
    image_url: `/minicons/${slug}/${file}`,
    mime_type: "image/png",
    byte_size: size,
    width: 200,
    height: 200,
    sort_order: sortOrder,
    is_active: true,
  };
});

for (const item of itemRows) {
  const storagePath = `official/${slug}/${item.file_name}`;
  const { error: uploadError } = await supabase.storage
    .from("minicons")
    .upload(storagePath, fs.readFileSync(path.join(publicDirectory, item.file_name)), {
      contentType: "image/png",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from("minicons").getPublicUrl(storagePath);
  item.image_url = publicUrl.publicUrl;
  item.storage_path = storagePath;
  delete item.file_name;
}

const { data: oldPack, error: oldPackError } = await supabase
  .from("minicon_packs")
  .select("id, status")
  .eq("slug", oldSlug)
  .maybeSingle();
if (oldPackError) throw oldPackError;

const { data: pack, error: packError } = await supabase
  .from("minicon_packs")
  .upsert({
    slug,
    name: "미니콘",
    description: "커뮤니티 반응과 롤 밈을 담은 파랑·빨강 미니콘입니다.",
    status: "published",
    cover_url: itemRows[0].image_url,
    is_official: true,
    sort_order: 0,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "slug" })
  .select("id, slug, status")
  .single();
if (packError) throw packError;

const { error: itemError } = await supabase
  .from("minicon_items")
  .upsert(
    itemRows.map((item) => ({ ...item, pack_id: pack.id })),
    { onConflict: "pack_id,sort_order" },
  );
if (itemError) throw itemError;

let migratedSelections = 0;
if (oldPack) {
  const { data: selections, error: selectionError } = await supabase
    .from("user_minicon_packs")
    .select("user_id, sort_order")
    .eq("pack_id", oldPack.id);
  if (selectionError) throw selectionError;

  if (selections?.length) {
    const { error: selectionUpsertError } = await supabase
      .from("user_minicon_packs")
      .upsert(
        selections.map((selection) => ({
          user_id: selection.user_id,
          pack_id: pack.id,
          sort_order: selection.sort_order,
        })),
        { onConflict: "user_id,pack_id" },
      );
    if (selectionUpsertError) throw selectionUpsertError;
    migratedSelections = selections.length;
  }

  const { error: retireError } = await supabase
    .from("minicon_packs")
    .update({ status: "retired", updated_at: new Date().toISOString() })
    .eq("id", oldPack.id);
  if (retireError) throw retireError;
}

const { data: verifiedPack, error: verifyPackError } = await supabase
  .from("minicon_packs")
  .select("id, slug, name, status, is_official, cover_url")
  .eq("slug", slug)
  .single();
if (verifyPackError) throw verifyPackError;

const { data: verifiedItems, error: verifyItemsError } = await supabase
  .from("minicon_items")
  .select("name, image_url, width, height, sort_order, is_active")
  .eq("pack_id", pack.id)
  .order("sort_order");
if (verifyItemsError) throw verifyItemsError;

const { data: verifiedOldPack, error: verifyOldPackError } = await supabase
  .from("minicon_packs")
  .select("slug, status")
  .eq("slug", oldSlug)
  .maybeSingle();
if (verifyOldPackError) throw verifyOldPackError;

const { data: publicPacks, error: publicPackError } = await publicSupabase
  .from("minicon_packs")
  .select("id, slug");
if (publicPackError) throw publicPackError;

const publicPack = publicPacks.find((candidate) => candidate.slug === slug);
const { data: publicItems, error: publicItemError } = publicPack
  ? await publicSupabase.from("minicon_items").select("id").eq("pack_id", publicPack.id)
  : { data: [], error: null };
if (publicItemError) throw publicItemError;

console.log(JSON.stringify({
  pack: verifiedPack,
  itemCount: verifiedItems.length,
  allItemsActive: verifiedItems.every((item) => item.is_active),
  allItems200Square: verifiedItems.every((item) => item.width === 200 && item.height === 200),
  migratedSelections,
  oldPack: verifiedOldPack,
  publicVerification: {
    newPackVisible: Boolean(publicPack),
    newItemCount: publicItems.length,
    starterVisible: publicPacks.some((candidate) => candidate.slug === oldSlug),
  },
}, null, 2));
