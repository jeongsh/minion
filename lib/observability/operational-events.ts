import type { SupabaseClient } from "@supabase/supabase-js";

export type OperationalEventInput = {
  eventType: string;
  actorUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordOperationalEvent(supabase: SupabaseClient, input: OperationalEventInput) {
  const { error } = await supabase.from("admin_audit_logs").insert({
    event_type: input.eventType,
    actor_user_id: input.actorUserId ?? null,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error && process.env.NODE_ENV !== "production") {
    console.warn("[operational-event]", error.message);
  }
}
