"use server";

import { randomUUID } from "crypto";
import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseAdminActionClient, createSupabaseAdminClient } from "@/lib/auth/admin";
import { HOME_PUBLIC_DATA_TAG } from "@/lib/data/home-cache";

function revalidate() {
  revalidatePath("/");
  revalidatePath("/admin/home-slider");
  updateTag(HOME_PUBLIC_DATA_TAG);
}

function textValue(formData: FormData, key: string) {
  return ((formData.get(key) as string | null) ?? "").trim();
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : 0;
}

function slidePayload(formData: FormData) {
  const title = textValue(formData, "title");
  // The file itself is uploaded ahead of time via /api/admin/home-slider/upload,
  // so only the resulting public URL reaches this action.
  const imageUrl = textValue(formData, "image_url");
  const linkUrl = textValue(formData, "link_url");

  if (!title || !imageUrl) return null;

  return {
    title,
    image_url: imageUrl,
    link_url: linkUrl || null,
    order_index: numberValue(formData, "order_index"),
    is_active: formData.get("is_active") === "on",
  };
}

export async function createHomeHeroSlideAction(formData: FormData) {
  const id = randomUUID();
  const payload = slidePayload(formData);
  if (!payload) return;

  const supabase = await createSupabaseAdminActionClient();
  const { error } = await supabase.from("home_hero_slides").insert({ id, ...payload });
  if (error) throw error;

  revalidate();
}

export async function updateHomeHeroSlideAction(formData: FormData) {
  const id = textValue(formData, "id");
  const payload = slidePayload(formData);
  if (!id || !payload) return;

  const supabase = await createSupabaseAdminActionClient();
  const { error } = await supabase.from("home_hero_slides").update(payload).eq("id", id);
  if (error) throw error;

  revalidate();
}

export async function deleteHomeHeroSlideAction(formData: FormData) {
  const id = textValue(formData, "id");
  if (!id) return;

  const supabase = await createSupabaseAdminActionClient();
  const { error } = await supabase.from("home_hero_slides").delete().eq("id", id);
  if (error) throw error;

  revalidate();
}
