import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type MobileAuthContext = { supabase: SupabaseClient; user: User };

export async function getMobileAuth(request: Request): Promise<MobileAuthContext | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : { supabase, user };
}
