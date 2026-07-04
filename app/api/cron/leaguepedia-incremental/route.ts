import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncLeaguepediaLck2026 } from "@/lib/sync/leaguepedia-lck-2026";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncLeaguepediaLck2026(createSupabaseAdminClient(), {
      mode: "incremental",
    });

    revalidatePath("/");
    revalidatePath("/schedule");
    revalidatePath("/admin/matches");

    return Response.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Leaguepedia sync error";
    console.error("[leaguepedia-incremental]", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
