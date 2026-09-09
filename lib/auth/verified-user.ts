import "server-only";

import { cache } from "react";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

/** Share the Auth server's verified user only within the current React request. */
export const getVerifiedAuth = cache(async function getVerifiedAuth() {
  let supabase: Awaited<ReturnType<typeof createSupabaseAuthClient>>;
  try {
    supabase = await createSupabaseAuthClient();
  } catch {
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
});
