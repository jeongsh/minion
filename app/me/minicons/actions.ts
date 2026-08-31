"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SELECTED_PACKS = 200;

export type SaveMiniconSettingsResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function validatePackIds(input: unknown): string[] | null {
  if (!input || typeof input !== "object" || !("packIds" in input)) return null;

  const packIds = (input as { packIds?: unknown }).packIds;
  if (!Array.isArray(packIds) || packIds.length === 0 || packIds.length > MAX_SELECTED_PACKS) return null;
  if (packIds.some((packId) => typeof packId !== "string" || !UUID_PATTERN.test(packId))) return null;

  const uniquePackIds = [...new Set(packIds)];
  return uniquePackIds.length === packIds.length ? uniquePackIds : null;
}

export async function saveMiniconSettingsAction(input: unknown): Promise<SaveMiniconSettingsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const packIds = validatePackIds(input);
  if (!packIds) {
    return { ok: false, error: "사용할 미니콘 패키지를 한 개 이상 올바르게 선택해 주세요." };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("replace_user_minicon_packs", {
      p_user_id: user.id,
      p_pack_ids: packIds,
    });

    if (error) {
      console.error("[minicon-settings] atomic selection save failed", error.message);
      if (error.message.includes("MINICON_UNAVAILABLE_SELECTION")) {
        return { ok: false, error: "현재 공개 중인 미니콘 패키지만 사용할 수 있습니다." };
      }
      return { ok: false, error: "미니콘 설정을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
    }

    revalidatePath("/me/minicons");
    revalidatePath("/community", "layout");
    return { ok: true, message: `미니콘 패키지 ${packIds.length}개를 사용할 수 있게 설정했습니다.` };
  } catch (error) {
    console.error("[minicon-settings] unexpected save failure", error);
    return { ok: false, error: "미니콘 설정을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}
