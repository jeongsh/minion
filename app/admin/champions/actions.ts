"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function textOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = textOrNull(formData.get(key));

  if (!value) {
    throw new Error(`${label} 값은 필수입니다.`);
  }

  return value;
}

export async function updateChampionMappingAction(formData: FormData) {
  const championId = requiredText(formData, "championId", "챔피언 ID");
  const name = requiredText(formData, "name", "챔피언명");
  const imageUrl = textOrNull(formData.get("imageUrl"));

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("champions")
    .update({
      name,
      image_url: imageUrl,
    })
    .eq("id", championId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/champions");
  revalidatePath("/stats/champions");
  revalidatePath("/community/draft");
}
