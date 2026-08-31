import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MiniconPackForm } from "./minicon-pack-form";
import { MiniconReviewManager } from "./minicon-review-manager";
import type { AdminMiniconItem, AdminMiniconPack, AdminMiniconPackStatus } from "./types";

export const dynamic = "force-dynamic";

type MiniconPackRow = {
  id: string;
  name: string;
  description: string;
  cover_url: string;
  status: AdminMiniconPackStatus;
  is_official: boolean;
  creator_id: string | null;
  created_at: string;
  published_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type MiniconItemRow = {
  id: string;
  pack_id: string;
  name: string;
  image_url: string;
};

async function getAdminMiniconPacks(): Promise<AdminMiniconPack[]> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const [{ data: packData, error: packError }, { data: itemData, error: itemError }] = await Promise.all([
    admin
      .from("minicon_packs")
      .select("id, name, description, cover_url, status, is_official, creator_id, created_at, published_at, review_note, reviewed_at, reviewed_by")
      .order("created_at", { ascending: false }),
    admin
      .from("minicon_items")
      .select("id, pack_id, name, image_url")
      .order("sort_order", { ascending: true }),
  ]);

  if (packError) throw packError;
  if (itemError) throw itemError;

  const packs = (packData ?? []) as MiniconPackRow[];
  const items = (itemData ?? []) as MiniconItemRow[];
  const profileIds = [...new Set(
    packs.flatMap((pack) => [pack.creator_id, pack.reviewed_by]).filter((id): id is string => Boolean(id)),
  )];
  const profileResult = profileIds.length > 0
    ? await admin.from("profiles").select("id, nickname").in("id", profileIds)
    : { data: [], error: null };
  if (profileResult.error) throw profileResult.error;

  const nicknameById = new Map(
    ((profileResult.data ?? []) as { id: string; nickname: string | null }[])
      .map((profile) => [profile.id, profile.nickname] as const),
  );
  const itemsByPack = new Map<string, AdminMiniconItem[]>();
  for (const item of items) {
    itemsByPack.set(item.pack_id, [
      ...(itemsByPack.get(item.pack_id) ?? []),
      { id: item.id, name: item.name, imageUrl: item.image_url },
    ]);
  }

  return packs.map((pack) => {
    const packItems = itemsByPack.get(pack.id) ?? [];
    return {
      id: pack.id,
      name: pack.name,
      description: pack.description,
      coverUrl: pack.cover_url,
      status: pack.status,
      isOfficial: pack.is_official,
      creatorId: pack.creator_id,
      creatorName: pack.creator_id
        ? nicknameById.get(pack.creator_id) || "이름 없는 사용자"
        : pack.is_official
          ? "MINION 운영팀"
          : "탈퇴한 사용자",
      itemCount: packItems.length,
      items: packItems,
      createdAt: pack.created_at,
      publishedAt: pack.published_at,
      reviewNote: pack.review_note,
      reviewedAt: pack.reviewed_at,
      reviewerName: pack.reviewed_by
        ? nicknameById.get(pack.reviewed_by) || "관리자"
        : null,
    };
  });
}

export default async function AdminMiniconsPage() {
  const packs = await getAdminMiniconPacks();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "미니콘 관리" }]} />
        <SectionHeader title="미니콘 관리" />
        <p className="text-[16px] font-normal leading-7 text-[var(--ui-muted)]">디시콘과 같은 200×200 규격의 원본 파일을 패키지로 등록합니다.</p>
      </div>

      <section className="grid gap-4" aria-labelledby="minicon-register-title">
        <h2 id="minicon-register-title" className="text-[18px] font-bold text-[var(--ui-ink)]">새 패키지 등록</h2>
        <MiniconPackForm />
      </section>

      <section className="grid gap-4" aria-labelledby="minicon-review-title">
        <div className="flex items-end justify-between gap-4">
          <h2 id="minicon-review-title" className="text-[18px] font-bold text-[var(--ui-ink)]">사용자 신청 심사</h2>
          <span className="text-[13px] font-normal text-[var(--ui-muted)]">총 {packs.length}개</span>
        </div>
        <MiniconReviewManager packs={packs} />
      </section>
    </main>
  );
}
