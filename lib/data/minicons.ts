import "server-only";

import { cache } from "react";

import type { CommentMinicon, MiniconItem, MiniconPack } from "@/lib/minicons/types";
import {
  RENDERABLE_MINICON_PACK_STATUSES,
  resolveRenderableCommentMinicons,
} from "@/lib/minicons/comment-hydration";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canQuerySupabase, createSupabaseServerClient } from "@/lib/supabase/server";

type MiniconPackRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  cover_url: string;
  is_official: boolean;
  sort_order: number;
};

type MiniconItemRow = {
  id: string;
  pack_id: string;
  name: string;
  image_url: string;
  sort_order: number;
};

const starterItems = [
  ["좋아", "01-good.png"],
  ["가자", "02-go.png"],
  ["인정", "03-agree.png"],
  ["대박", "04-wow.png"],
  ["아쉽", "05-close.png"],
  ["수고", "06-good-game.png"],
  ["ㅋㅋ", "07-lol.png"],
  ["집중", "08-focus.png"],
  ["승리", "09-win.png"],
  ["파이팅", "10-fighting.png"],
] as const;

const STARTER_PACK_ID = "00000000-0000-4000-8000-000000000001";

export const STARTER_MINICON_PACK: MiniconPack = {
  id: STARTER_PACK_ID,
  slug: "minion-starter",
  name: "미니콘 스타터",
  description: "MINION 커뮤니티에서 바로 사용할 수 있는 기본 미니콘입니다.",
  coverUrl: "/minicons/minion-starter/01-good.png",
  isOfficial: true,
  items: starterItems.map(([name, file], index) => ({
    id: `00000000-0000-4000-8001-${String(index + 1).padStart(12, "0")}`,
    packId: STARTER_PACK_ID,
    packName: "미니콘 스타터",
    name,
    imageUrl: `/minicons/minion-starter/${file}`,
  })),
};

export const getPublishedMiniconPacks = cache(async function getPublishedMiniconPacks(): Promise<MiniconPack[]> {
  if (!canQuerySupabase()) return [STARTER_MINICON_PACK];

  const supabase = createSupabaseServerClient();
  const [{ data: packData, error: packError }, { data: itemData, error: itemError }] = await Promise.all([
    supabase
      .from("minicon_packs")
      .select("id, slug, name, description, cover_url, is_official, sort_order")
      .eq("status", "published")
      .order("is_official", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("minicon_items")
      .select("id, pack_id, name, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (packError || itemError) {
    console.warn("[minicons] published catalog lookup failed", packError?.message ?? itemError?.message);
    // Supabase가 연결된 환경에서는 DB에 없는 정적 UUID를 댓글 제출에 노출하지 않는다.
    return [];
  }

  const packs = (packData ?? []) as MiniconPackRow[];
  const items = (itemData ?? []) as MiniconItemRow[];
  if (packs.length === 0) return [];

  const packNames = new Map(packs.map((pack) => [pack.id, pack.name]));
  const itemsByPack = new Map<string, MiniconItem[]>();
  for (const item of items) {
    const packName = packNames.get(item.pack_id);
    if (!packName) continue;
    const mapped: MiniconItem = {
      id: item.id,
      packId: item.pack_id,
      packName,
      name: item.name,
      imageUrl: item.image_url,
    };
    itemsByPack.set(item.pack_id, [...(itemsByPack.get(item.pack_id) ?? []), mapped]);
  }

  return packs.flatMap((pack) => {
    const packItems = itemsByPack.get(pack.id) ?? [];
    return packItems.length > 0 ? [{
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      description: pack.description,
      coverUrl: pack.cover_url,
      isOfficial: pack.is_official,
      items: packItems,
    }] : [];
  });
});

function defaultSelectedPacks(packs: MiniconPack[]) {
  const starter = packs.find((pack) => pack.slug === STARTER_MINICON_PACK.slug)
    ?? packs.find((pack) => pack.isOfficial)
    ?? packs[0];
  return starter ? [starter] : [];
}

/**
 * 댓글 선택기에 노출할 사용자별 패키지를 반환한다.
 *
 * 비회원과 아직 설정을 저장하지 않은 회원은 스타터 팩 하나로 시작한다. 저장된
 * 패키지가 모두 공개 종료된 경우에도 선택기가 비지 않도록 같은 기본값을 쓴다.
 */
export async function getUserMiniconPacks(userId: string | null | undefined): Promise<MiniconPack[]> {
  const publishedPacks = await getPublishedMiniconPacks();
  const fallback = defaultSelectedPacks(publishedPacks);
  if (!userId || publishedPacks.length === 0) return fallback;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("user_minicon_packs")
      .select("pack_id, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    const selectedIds = (data ?? []).map((row: { pack_id: string }) => row.pack_id);
    if (selectedIds.length === 0) return fallback;

    const packById = new Map(publishedPacks.map((pack) => [pack.id, pack]));
    const selected = selectedIds.flatMap((packId) => {
      const pack = packById.get(packId);
      return pack ? [pack] : [];
    });
    return selected.length > 0 ? selected : fallback;
  } catch (error) {
    console.warn("[minicons] user selection lookup failed", error instanceof Error ? error.message : error);
    return fallback;
  }
}

export async function getPublishedMiniconItem(itemId: string): Promise<CommentMinicon | null> {
  const items = await getPublishedMiniconItemsById([itemId]);
  return items.get(itemId) ?? null;
}

export async function getPublishedMiniconItemsById(itemIds: string[]): Promise<Map<string, CommentMinicon>> {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (!canQuerySupabase() || uniqueIds.length === 0) return new Map();

  const supabase = createSupabaseServerClient();
  const { data: itemData, error: itemError } = await supabase
    .from("minicon_items")
    .select("id, pack_id, name, image_url, sort_order")
    .in("id", uniqueIds)
    .eq("is_active", true);
  if (itemError) return new Map();

  const items = (itemData ?? []) as MiniconItemRow[];
  const packIds = [...new Set(items.map((item) => item.pack_id))];
  if (packIds.length === 0) return new Map();

  const { data: packData, error: packError } = await supabase
    .from("minicon_packs")
    .select("id, name")
    .in("id", packIds)
    .eq("status", "published");
  if (packError) return new Map();

  const packNames = new Map(((packData ?? []) as { id: string; name: string }[]).map((pack) => [pack.id, pack.name]));
  return new Map(items.flatMap((item) => {
    const packName = packNames.get(item.pack_id);
    return packName ? [[item.id, {
      id: item.id,
      packId: item.pack_id,
      packName,
      name: item.name,
      imageUrl: item.image_url,
    } satisfies CommentMinicon] as const] : [];
  }));
}

/**
 * 이미 저장된 댓글의 미니콘을 복원한다. 신규 작성 검증과 달리 retired 패키지는
 * 보존하되, suspended를 포함한 그 밖의 비공개 상태는 서버에서 걸러낸다.
 * RLS로 숨겨진 retired 행은 이 server-only 모듈의 전용 관리자 클라이언트로만 읽는다.
 */
export async function getRenderableMiniconItemsById(itemIds: string[]): Promise<Map<string, CommentMinicon>> {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (!canQuerySupabase() || uniqueIds.length === 0) return new Map();

  try {
    const admin = createSupabaseAdminClient();
    const { data: itemData, error: itemError } = await admin
      .from("minicon_items")
      .select("id, pack_id, name, image_url")
      .in("id", uniqueIds);
    if (itemError) throw itemError;

    const items = (itemData ?? []) as Omit<MiniconItemRow, "sort_order">[];
    const packIds = [...new Set(items.map((item) => item.pack_id))];
    if (packIds.length === 0) return new Map();

    const { data: packData, error: packError } = await admin
      .from("minicon_packs")
      .select("id, name, status")
      .in("id", packIds)
      .in("status", [...RENDERABLE_MINICON_PACK_STATUSES]);
    if (packError) throw packError;

    return resolveRenderableCommentMinicons(
      items.map((item) => ({
        id: item.id,
        packId: item.pack_id,
        name: item.name,
        imageUrl: item.image_url,
      })),
      ((packData ?? []) as { id: string; name: string; status: string }[]).map((pack) => ({
        id: pack.id,
        name: pack.name,
        status: pack.status,
      })),
    );
  } catch (error) {
    console.warn("[minicons] saved comment hydration failed", error instanceof Error ? error.message : error);
    return new Map();
  }
}

export type AdminMiniconPack = {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  status: string;
  isOfficial: boolean;
  itemCount: number;
  createdAt: string;
};

export async function getAdminMiniconPacks(): Promise<AdminMiniconPack[]> {
  const admin = createSupabaseAdminClient();
  const [{ data: packs, error: packError }, { data: items, error: itemError }] = await Promise.all([
    admin
      .from("minicon_packs")
      .select("id, name, description, cover_url, status, is_official, created_at")
      .order("created_at", { ascending: false }),
    admin.from("minicon_items").select("pack_id"),
  ]);
  if (packError) throw packError;
  if (itemError) throw itemError;

  const counts = new Map<string, number>();
  for (const item of (items ?? []) as { pack_id: string }[]) {
    counts.set(item.pack_id, (counts.get(item.pack_id) ?? 0) + 1);
  }
  return ((packs ?? []) as {
    id: string;
    name: string;
    description: string;
    cover_url: string;
    status: string;
    is_official: boolean;
    created_at: string;
  }[]).map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    coverUrl: pack.cover_url,
    status: pack.status,
    isOfficial: pack.is_official,
    itemCount: counts.get(pack.id) ?? 0,
    createdAt: pack.created_at,
  }));
}
