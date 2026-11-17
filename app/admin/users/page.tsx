import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { AdminPagination } from "@/components/admin/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
type Props = { searchParams: Promise<{ page?: string; created?: string; deleted?: string; error?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const parsed = Number(params.page);
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
  if (error) throw error;
  const users = data.users;
  const ids = users.map((user) => user.id);
  const profilesRes = ids.length
    ? await supabase.from("profiles").select("id, nickname").in("id", ids)
    : { data: [], error: null };
  if (profilesRes.error) throw profilesRes.error;
  const nicknames = new Map(((profilesRes.data ?? []) as { id: string; nickname: string | null }[]).map((p) => [p.id, p.nickname]));
  const total = data.total ?? (users.length < PAGE_SIZE ? (page - 1) * PAGE_SIZE + users.length : page * PAGE_SIZE + 1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2"><Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "유저 관리" }]} /><SectionHeader title="유저 관리" /></div>
        <Link href="/admin/users/new" className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">유저 초대</Link>
      </div>
      {params.created ? <p role="status" className="text-sm text-green-700">초대 메일을 보냈습니다.</p> : null}
      {params.deleted ? <p role="status" className="text-sm text-green-700">유저를 삭제했습니다.</p> : null}
      {params.error ? <p role="alert" className="text-sm text-red-600">{params.error}</p> : null}
      <Table>
        <TableHeader><TableRow><TableHead>닉네임</TableHead><TableHead>이메일</TableHead><TableHead>가입일</TableHead><TableHead>최근 접속</TableHead><TableHead>상태</TableHead></TableRow></TableHeader>
        <TableBody>
          {users.map((user) => <TableRow key={user.id}>
            <TableCell><Link className="font-medium text-accent hover:underline" href={`/admin/users/${user.id}`}>{nicknames.get(user.id) || user.user_metadata?.nickname || "닉네임 없음"}</Link></TableCell>
            <TableCell>{user.email ?? "이메일 없음"}</TableCell>
            <TableCell>{user.created_at ? new Date(user.created_at).toLocaleDateString("ko-KR") : "—"}</TableCell>
            <TableCell>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("ko-KR") : "접속 기록 없음"}</TableCell>
            <TableCell>{user.banned_until && new Date(user.banned_until) > new Date() ? "정지" : user.email_confirmed_at ? "정상" : "초대 대기"}</TableCell>
          </TableRow>)}
          {users.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted">유저가 없습니다.</TableCell></TableRow> : null}
        </TableBody>
      </Table>
      <AdminPagination pathname="/admin/users" page={page} totalPages={totalPages} totalCount={total} />
    </main>
  );
}
