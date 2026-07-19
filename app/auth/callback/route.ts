import { NextResponse } from "next/server";

import { siteBaseUrl } from "@/lib/site";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/me";

  if (code) {
    const supabase = await createSupabaseAuthClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/me", siteBaseUrl()));
}
