import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import type { MiniconItem, MiniconPack } from "@/lib/minicons/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MiniconSettingsForm } from "./minicon-settings-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "내 미니콘 · MINION",
  robots: { index: false, follow: false },
};

type MiniconPackRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string;
  is_official: boolean;
};

type MiniconItemRow = {
  id: string;
  pack_id: string;
  name: string;
  image_url: string;
};

type UserMiniconPackRow = {
  pack_id: string;
  sort_order: number;
};

async function loadMiniconSettings(userId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: packData, error: packError }, { data: itemData, error: itemError }, { data: selectionData, error: selectionError }] = await Promise.all([
    admin
      .from("minicon_packs")
      .select("id, slug, name, description, cover_url, is_official, sort_order")
      .eq("status", "published")
      .order("is_official", { ascending: false })
      .order("sort_order", { ascending: true }),
    admin
      .from("minicon_items")
      .select("id, pack_id, name, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("user_minicon_packs")
      .select("pack_id, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
  ]);

  if (packError || itemError || selectionError) {
    throw new Error(packError?.message ?? itemError?.message ?? selectionError?.message ?? "미니콘 설정을 불러오지 못했습니다.");
  }

  const packRows = (packData ?? []) as MiniconPackRow[];
  const publishedPackIds = new Set(packRows.map((pack) => pack.id));
  const packNames = new Map(packRows.map((pack) => [pack.id, pack.name]));
  const itemsByPack = new Map<string, MiniconItem[]>();

  for (const item of (itemData ?? []) as MiniconItemRow[]) {
    const packName = packNames.get(item.pack_id);
    if (!packName || !publishedPackIds.has(item.pack_id)) continue;
    const mappedItem: MiniconItem = {
      id: item.id,
      packId: item.pack_id,
      packName,
      name: item.name,
      imageUrl: item.image_url,
    };
    itemsByPack.set(item.pack_id, [...(itemsByPack.get(item.pack_id) ?? []), mappedItem]);
  }

  const packs: MiniconPack[] = packRows.map((pack) => ({
    id: pack.id,
    slug: pack.slug,
    name: pack.name,
    description: pack.description ?? "",
    coverUrl: pack.cover_url,
    isOfficial: pack.is_official,
    items: itemsByPack.get(pack.id) ?? [],
  }));

  const persistedSelection = ((selectionData ?? []) as UserMiniconPackRow[])
    .map((row) => row.pack_id)
    .filter((packId) => publishedPackIds.has(packId));
  const defaultPack = packs.find((pack) => pack.isOfficial) ?? packs[0];
  const initialSelectedPackIds = persistedSelection.length > 0
    ? persistedSelection
    : defaultPack
      ? [defaultPack.id]
      : [];

  return {
    packs,
    initialSelectedPackIds,
    initialSelectionSaved: persistedSelection.length > 0,
  };
}

export default async function MyMiniconsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="layout-form py-10">
        <section className="mt-5 rounded-lg bg-[var(--ui-surface-muted)] p-5 text-center">
          <p className="text-[16px] font-normal text-[var(--ui-muted)]">로그인 후 사용할 미니콘을 선택할 수 있습니다.</p>
          <Link href="/login?next=/me/minicons" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-[14px] font-medium text-[var(--accent-foreground)]">로그인</Link>
        </section>
      </main>
    );
  }

  let settings: Awaited<ReturnType<typeof loadMiniconSettings>>;
  try {
    settings = await loadMiniconSettings(user.id);
  } catch (error) {
    console.error("[minicon-settings] page load failed", error);
    return (
      <main className="layout-wide max-w-6xl py-10">
        <section className="mt-5 rounded-lg bg-[var(--ui-surface-muted)] px-5 py-10 text-center">
          <p className="text-[16px] font-normal text-[var(--ui-muted)]">미니콘 설정을 불러오지 못했습니다.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="layout-wide max-w-6xl pb-12 pt-6 sm:pt-10">
      <div>
        <MiniconSettingsForm
          packs={settings.packs}
          initialSelectedPackIds={settings.initialSelectedPackIds}
          initialSelectionSaved={settings.initialSelectionSaved}
        />
      </div>
    </main>
  );
}
