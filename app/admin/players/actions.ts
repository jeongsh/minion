"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function revalidate() {
  revalidatePath("/admin/players");
  revalidatePath("/players");
}

export async function updatePlayerAction(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string).trim();
  const realName = (formData.get("real_name") as string).trim();
  const teamId = formData.get("team_id") as string | null;
  const isStarter = formData.get("is_starter") === "true";
  const position = formData.get("position") as string;

  if (!id || !name) return;

  const supabase = createSupabaseAdminClient();

  // 주전 설정 시 같은 팀·포지션의 기존 주전을 서브로 내림
  if (isStarter && teamId && position) {
    await supabase
      .from("players")
      .update({ is_starter: false })
      .eq("team_id", teamId)
      .eq("position", position)
      .eq("is_starter", true)
      .neq("id", id);
  }

  await supabase
    .from("players")
    .update({ name, real_name: realName || null, team_id: teamId || null, is_starter: isStarter })
    .eq("id", id);

  revalidate();
}

export async function deletePlayerAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = createSupabaseAdminClient();
  await supabase.from("players").delete().eq("id", id);

  revalidate();
}
