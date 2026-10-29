import type { SupabaseClient } from "@supabase/supabase-js";

// A device or browser can be shared by multiple accounts. Its guest key must
// never grant access to a follow owned by an account, including legacy rows.
export function teamFanIdentityFilters(userId: string | null | undefined, voterKey: string | null): string[] {
  if (userId) return [`user_id.eq.${userId}`];
  return voterKey ? [`and(user_id.is.null,voter_key.eq.${voterKey})`] : [];
}

export async function insertTeamFan(supabase: SupabaseClient, teamId: string, userId: string | null | undefined, voterKey: string | null) {
  if (!userId && voterKey) {
    // Older account follows also stored a guest key. Release that key before
    // a guest reuses it, preserving the account's follow and creation date.
    const { error } = await supabase.from("team_fans")
      .update({ voter_key: null })
      .eq("team_id", teamId)
      .eq("voter_key", voterKey)
      .not("user_id", "is", null);
    if (error) return { data: null, error };
  }

  return supabase.from("team_fans")
    .insert({ team_id: teamId, user_id: userId ?? null, voter_key: userId ? null : voterKey })
    .select("id")
    .single();
}
