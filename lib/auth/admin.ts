import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

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
