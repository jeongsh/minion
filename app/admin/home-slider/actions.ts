"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function revalidate() {
  revalidatePath("/");
  revalidatePath("/admin/home-slider");
}

function textValue(formData: FormData, key: string) {
  return ((formData.get(key) as string | null) ?? "").trim();
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : 0;
}

async function uploadSlideImage(slideId: string, file: File) {
  const supabase = createSupabaseAdminClient();
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${slideId}/${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from("home-hero-slides").upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("home-hero-slides").getPublicUrl(path);
  return data.publicUrl;
}

async function resolveImageUrl(formData: FormData, slideId: string, requireImage: boolean) {
  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    return uploadSlideImage(slideId, imageFile);
  }

  const existingUrl = textValue(formData, "image_url");
  if (existingUrl) return existingUrl;
  if (requireImage) return null;

  return null;
}

async function slidePayload(formData: FormData, slideId: string, requireImage: boolean) {
  const title = textValue(formData, "title");
  const imageUrl = await resolveImageUrl(formData, slideId, requireImage);
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
  const payload = await slidePayload(formData, id, true);
  if (!payload) return;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("home_hero_slides").insert({ id, ...payload });
  if (error) throw error;

  revalidate();
}

export async function updateHomeHeroSlideAction(formData: FormData) {
  const id = textValue(formData, "id");
  const payload = await slidePayload(formData, id, false);
  if (!id || !payload) return;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("home_hero_slides").update(payload).eq("id", id);
  if (error) throw error;

  revalidate();
}

export async function deleteHomeHeroSlideAction(formData: FormData) {
  const id = textValue(formData, "id");
  if (!id) return;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("home_hero_slides").delete().eq("id", id);
  if (error) throw error;

  revalidate();
}
