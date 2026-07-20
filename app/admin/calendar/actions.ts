"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createSupabaseAdminActionClient, createSupabaseAdminClient } from "@/lib/auth/admin";
import { HOME_PUBLIC_DATA_TAG } from "@/lib/data/home-cache";

function revalidate() {
  revalidatePath("/admin/calendar");
  revalidatePath("/");
  updateTag(HOME_PUBLIC_DATA_TAG);
}

function parseFields(formData: FormData) {
  const eventType = String(formData.get("event_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const teamId = (formData.get("team_id") as string | null)?.trim() || null;
  const playerId = (formData.get("player_id") as string | null)?.trim() || null;
  const isRecurring = formData.has("is_recurring");
  return { eventType, title, eventDate, teamId, playerId, isRecurring };
}

export async function createCalendarEventAction(formData: FormData) {
  const { eventType, title, eventDate, teamId, playerId, isRecurring } = parseFields(formData);
  if (!eventType || !title || !eventDate) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase.from("fan_calendar_events").insert({
    event_type: eventType,
    title,
    event_date: eventDate,
    team_id: teamId,
    player_id: playerId,
    is_recurring: isRecurring,
  });

  revalidate();
}

export async function updateCalendarEventAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const { eventType, title, eventDate, teamId, playerId, isRecurring } = parseFields(formData);
  if (!id || !eventType || !title || !eventDate) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase
    .from("fan_calendar_events")
    .update({
      event_type: eventType,
      title,
      event_date: eventDate,
      team_id: teamId,
      player_id: playerId,
      is_recurring: isRecurring,
    })
    .eq("id", id);

  revalidate();
}

export async function deleteCalendarEventAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase.from("fan_calendar_events").delete().eq("id", id);

  revalidate();
}
