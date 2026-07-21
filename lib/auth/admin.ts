import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminUser = {
  id: string;
  email: string | null;
};

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function allowAllAuthenticatedAdmins() {
  return process.env.ADMIN_ALLOW_ALL_USERS === "true";
}

function hasAdminClaim(appMetadata: Record<string, unknown>) {
  const role = appMetadata.role ?? appMetadata.minion_role;
  const roles = appMetadata.roles;

  if (role === "admin" || role === "owner") return true;
  if (Array.isArray(roles) && roles.some((value) => value === "admin" || value === "owner")) return true;

  return false;
}

/** 리다이렉트 없이 현재 사용자가 어드민인지만 본다. 화면에서 어드민 전용 UI를 분기할 때 쓴다. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  let supabase: Awaited<ReturnType<typeof createSupabaseAuthClient>>;
  try {
    supabase = await createSupabaseAuthClient();
  } catch {
    return false;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const email = user.email?.toLowerCase() ?? null;
  return allowAllAuthenticatedAdmins() || hasAdminClaim(user.app_metadata) || Boolean(email && adminEmails().has(email));
}

export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email?.toLowerCase() ?? null;
  if (allowAllAuthenticatedAdmins() || hasAdminClaim(user.app_metadata) || (email && adminEmails().has(email))) {
    return { id: user.id, email };
  }

  redirect("/");
}

export async function createSupabaseAdminActionClient() {
  await requireAdmin();
  return createSupabaseAdminClient();
}
