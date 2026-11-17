"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, isAdminUser } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { siteBaseUrl } from "@/lib/site";
import { liftCommunityUserSanction, sanctionCommunityUser, setPostDeleted, softDeleteComment } from "@/lib/data/community-admin";
import { extractPlainText } from "@/lib/community/extract-thumbnail";

const USER_CONTENT_PAGE_SIZE = 10;

function normalizePage(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 200_000_000) : 1;
}

export async function getUserPostsPageAction(userId: string, requestedPage: number) {
  await requireAdmin();
  const page = normalizePage(requestedPage);
  const { data, count, error } = await createSupabaseAdminClient()
    .from("community_posts")
    .select("id, title, content, created_at, deleted_at, blinded_at", { count: "exact" })
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * USER_CONTENT_PAGE_SIZE, page * USER_CONTENT_PAGE_SIZE - 1);
  if (error) throw error;
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / USER_CONTENT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  return {
    rows: (data ?? []).map((post) => ({
      id: post.id,
      title: post.title,
      content: extractPlainText(post.content, 20_000),
      createdAt: post.created_at,
      deleted: Boolean(post.deleted_at),
      blinded: Boolean(post.blinded_at),
    })),
    totalCount,
    totalPages,
    page: safePage,
  };
}

export async function getUserCommentsPageAction(userId: string, requestedPage: number) {
  await requireAdmin();
  const page = normalizePage(requestedPage);
  const { data, count, error } = await createSupabaseAdminClient()
    .from("community_comments")
    .select("id, post_id, content, created_at, deleted_at, blinded_at", { count: "exact" })
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * USER_CONTENT_PAGE_SIZE, page * USER_CONTENT_PAGE_SIZE - 1);
  if (error) throw error;
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / USER_CONTENT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  return {
    rows: (data ?? []).map((comment) => ({
      id: comment.id,
      postId: comment.post_id,
      content: comment.content,
      createdAt: comment.created_at,
      deleted: Boolean(comment.deleted_at),
      blinded: Boolean(comment.blinded_at),
    })),
    totalCount,
    totalPages,
    page: safePage,
  };
}


function nicknameIsValid(nickname: string) {
  return nickname.length >= 2 && nickname.length <= 16;
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nickname = String(formData.get("nickname") ?? "").trim();
  if (!email || !nicknameIsValid(nickname)) redirect("/admin/users/new?error=입력값을 확인해주세요");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { nickname },
    redirectTo: `${siteBaseUrl()}/auth/callback`,
  });
  if (error) redirect(`/admin/users/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/users");
  redirect("/admin/users?created=1");
}

export async function updateUserAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!id || !email || !nicknameIsValid(nickname) || (password && password.length < 8)) {
    redirect(`/admin/users/${id}?error=${encodeURIComponent("입력값을 확인해주세요. 비밀번호는 8자 이상이어야 합니다.")}`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: target, error: targetError } = await supabase.auth.admin.getUserById(id);
  if (targetError || !target.user) redirect("/admin/users?error=사용자를 찾을 수 없습니다");
  const attributes: { email: string; user_metadata: Record<string, unknown>; password?: string; email_confirm?: boolean } = {
    email,
    user_metadata: { ...target.user.user_metadata, nickname },
  };
  if (password) attributes.password = password;
  if (email !== target.user.email) attributes.email_confirm = true;
  const { error } = await supabase.auth.admin.updateUserById(id, attributes);
  if (error) redirect(`/admin/users/${id}?error=${encodeURIComponent(error.message)}`);

  const { error: profileError } = await supabase.from("profiles").update({ nickname }).eq("id", id);
  if (profileError) redirect(`/admin/users/${id}?error=${encodeURIComponent(profileError.message)}`);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  redirect(`/admin/users/${id}?saved=1`);
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === admin.id) redirect("/admin/users?error=현재 로그인한 관리자 계정은 삭제할 수 없습니다");
  const supabase = createSupabaseAdminClient();
  const { data, error: lookupError } = await supabase.auth.admin.getUserById(id);
  if (lookupError || !data.user) redirect("/admin/users?error=사용자를 찾을 수 없습니다");
  if (isAdminUser(data.user)) redirect("/admin/users?error=관리자 계정은 삭제할 수 없습니다");
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) redirect(`/admin/users/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/community");
  redirect("/admin/users?deleted=1");
}

export async function deleteUserPostAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!id || !userId) return;
  await setPostDeleted(id, true);
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/community");
  revalidatePath("/community");
}

export async function deleteUserCommentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!id || !userId) return;
  await softDeleteComment(id);
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/community");
  revalidatePath("/community");
}

export async function grantUserLpAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId || !Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000 || reason.length < 2 || reason.length > 200) {
    redirect(`/admin/users/${userId}?error=${encodeURIComponent("LP 지급 액수(1~1,000,000)와 사유(2~200자)를 확인해주세요.")}`);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("record_lp_event", {
    p_user_id: userId,
    p_reason: `관리자 지급: ${reason}`,
    p_delta: amount,
    p_post_id: null,
    p_comment_id: null,
  });
  if (error) redirect(`/admin/users/${userId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/rankings");
  redirect(`/admin/users/${userId}?lpGranted=${amount}`);
}

export async function sanctionUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId || !reason || reason.length > 1000) {
    redirect(`/admin/users/${userId}?error=${encodeURIComponent("제재 사유를 1~1,000자로 입력해주세요.")}`);
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) redirect("/admin/users?error=사용자를 찾을 수 없습니다");
  if (userId === admin.id || isAdminUser(data.user)) {
    redirect(`/admin/users/${userId}?error=${encodeURIComponent("관리자 계정에는 제재를 적용할 수 없습니다.")}`);
  }
  try {
    await sanctionCommunityUser({ userId, reason, adminId: admin.id });
  } catch (sanctionError) {
    const message = sanctionError instanceof Error && "code" in sanctionError && sanctionError.code === "23505"
      ? "이미 제재 중인 유저입니다."
      : "제재를 적용하지 못했습니다.";
    redirect(`/admin/users/${userId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/community");
  redirect(`/admin/users/${userId}?sanctioned=1`);
}

export async function liftUserSanctionAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const sanctionId = String(formData.get("sanction_id") ?? "");
  if (!userId || !sanctionId) return;
  await liftCommunityUserSanction(sanctionId, admin.id);
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/community");
  redirect(`/admin/users/${userId}?sanctionLifted=1`);
}
