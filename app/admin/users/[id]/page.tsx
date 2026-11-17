import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { requireAdmin, isAdminUser } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractPlainText } from "@/lib/community/extract-thumbnail";
import { grantUserLpAction, liftUserSanctionAction, sanctionUserAction, updateUserAction } from "../actions";
import { DeleteUserForm } from "../delete-user-form";
import { UserContentLists } from "./user-content-lists";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ posts_page?: string; comments_page?: string; error?: string; saved?: string; lpGranted?: string; sanctioned?: string; sanctionLifted?: string }> };
function pageNumber(value?: string) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : 1; }
function date(value: string) { return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }); }

export default async function AdminUserDetailPage({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = createSupabaseAdminClient();
  const [{ data: authResult, error: authError }, { data: profile, error: profileError }, { data: sanction, error: sanctionError }] = await Promise.all([
    supabase.auth.admin.getUserById(id),
    supabase.from("profiles").select("nickname, lp").eq("id", id).maybeSingle(),
    supabase.from("community_user_sanctions").select("id, reason, banned_at").eq("user_id", id).is("lifted_at", null).maybeSingle(),
  ]);
  if (authError || !authResult.user) notFound();
  if (profileError) throw profileError;
  if (sanctionError) throw sanctionError;
  const user = authResult.user;
  const postPage = pageNumber(query.posts_page);
  const commentPage = pageNumber(query.comments_page);
  const [posts, comments] = await Promise.all([
    supabase.from("community_posts").select("id, title, content, created_at, deleted_at, blinded_at", { count: "exact" }).eq("author_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).range((postPage - 1) * PAGE_SIZE, postPage * PAGE_SIZE - 1),
    supabase.from("community_comments").select("id, post_id, content, created_at, deleted_at, blinded_at", { count: "exact" }).eq("author_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).range((commentPage - 1) * PAGE_SIZE, commentPage * PAGE_SIZE - 1),
  ]);
  if (posts.error) throw posts.error;
  if (comments.error) throw comments.error;
  const postCount = posts.count ?? 0;
  const commentCount = comments.count ?? 0;
  const nickname = profile?.nickname ?? String(user.user_metadata?.nickname ?? "");
  const initialPosts = (posts.data ?? []).map((post) => ({
    id: post.id,
    title: post.title,
    content: extractPlainText(post.content, 20_000),
    createdAt: post.created_at,
    deleted: Boolean(post.deleted_at),
    blinded: Boolean(post.blinded_at),
  }));
  const initialComments = (comments.data ?? []).map((comment) => ({
    id: comment.id,
    postId: comment.post_id,
    content: comment.content,
    createdAt: comment.created_at,
    deleted: Boolean(comment.deleted_at),
    blinded: Boolean(comment.blinded_at),
  }));

  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
    <div className="flex flex-col gap-2"><Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "유저 관리", href: "/admin/users" }, { label: nickname || user.email || "유저 상세" }]} /><SectionHeader title="유저 상세" /></div>
    {query.saved ? <p role="status" className="text-sm text-green-700">유저 정보를 저장했습니다.</p> : null}
    {query.lpGranted ? <p role="status" className="text-sm text-green-700">{Number(query.lpGranted).toLocaleString()} LP를 지급했습니다.</p> : null}
    {query.sanctioned ? <p role="status" className="text-sm text-green-700">커뮤니티 이용 제한을 적용했습니다.</p> : null}
    {query.sanctionLifted ? <p role="status" className="text-sm text-green-700">커뮤니티 이용 제한을 해제했습니다.</p> : null}
    {query.error ? <p role="alert" className="text-sm text-red-600">{query.error}</p> : null}
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">계정 정보</h2>
      <form action={updateUserAction} className="grid gap-4 rounded-xl border border-[var(--ui-border)] p-5 md:grid-cols-2">
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-2 text-sm font-medium">이메일<input required type="email" name="email" defaultValue={user.email ?? ""} className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 font-normal" /></label>
        <label className="flex flex-col gap-2 text-sm font-medium">닉네임<input required name="nickname" minLength={2} maxLength={16} defaultValue={nickname} className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 font-normal" /></label>
        <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">새 비밀번호<input type="password" name="password" minLength={8} autoComplete="new-password" placeholder="변경할 때만 입력 (8자 이상)" className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 font-normal" /></label>
        <div className="flex items-center justify-between gap-3 md:col-span-2"><p className="text-sm text-muted">가입 {date(user.created_at)} · 현재 {Number(profile?.lp ?? 0).toLocaleString()} LP · {user.email_confirmed_at ? "이메일 인증 완료" : "이메일 인증 대기"}</p><button className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">변경사항 저장</button></div>
      </form>
      {!isAdminUser(user) ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 p-5"><p className="text-sm text-muted">계정 삭제 시 작성한 글과 댓글은 익명으로 보존됩니다.</p><DeleteUserForm id={id} /></div> : <p className="text-sm text-muted">관리자 계정은 이 화면에서 삭제할 수 없습니다.</p>}
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--ui-border)] p-5">
        <div><h2 className="text-lg font-semibold">LP 지급</h2><p className="mt-1 text-sm text-muted">지급한 LP와 사유가 LP 원장에 기록됩니다.</p></div>
        <form action={grantUserLpAction} className="flex flex-col gap-3">
          <input type="hidden" name="user_id" value={id} />
          <label className="flex flex-col gap-2 text-sm font-medium">지급 액수<input required type="number" name="amount" min={1} max={1000000} step={1} className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 font-normal" /></label>
          <label className="flex flex-col gap-2 text-sm font-medium">지급 사유<textarea required name="reason" minLength={2} maxLength={200} rows={3} className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 font-normal" /></label>
          <button className="self-end rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">LP 지급</button>
        </form>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--ui-border)] p-5">
        <div><h2 className="text-lg font-semibold">커뮤니티 이용 제한</h2><p className="mt-1 text-sm text-muted">제재 중에는 커뮤니티 작성과 반응 등 일부 이용이 제한됩니다.</p></div>
        {sanction ? <>
          <div className="rounded-lg bg-[var(--ui-surface-muted)] p-3"><p className="text-sm font-medium">현재 제한 중 · {date(sanction.banned_at)}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted">{sanction.reason}</p></div>
          <form action={liftUserSanctionAction}><input type="hidden" name="user_id" value={id} /><input type="hidden" name="sanction_id" value={sanction.id} /><button className="self-end rounded-lg border border-[var(--ui-border)] px-4 py-2.5 text-sm font-medium">제한 해제</button></form>
        </> : isAdminUser(user) ? <p className="text-sm text-muted">관리자 계정은 제재할 수 없습니다.</p> : <form action={sanctionUserAction} className="flex flex-col gap-3">
          <input type="hidden" name="user_id" value={id} />
          <label className="flex flex-col gap-2 text-sm font-medium">제재 사유<textarea required name="reason" minLength={1} maxLength={1000} rows={4} className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 font-normal" /></label>
          <button className="self-end rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700">커뮤니티 이용 제한 적용</button>
        </form>}
      </div>
    </section>
    <UserContentLists userId={id} initialPosts={initialPosts} initialPostPage={postPage} postCount={postCount} initialComments={initialComments} initialCommentPage={commentPage} commentCount={commentCount} />
  </main>;
}
