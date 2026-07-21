import Link from "next/link";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { boardLabel } from "@/lib/community/boards";
import { AI_MODERATOR_NAME } from "@/lib/community/moderation-labels";
import {
  listCommunitySettings,
  listModeratedPosts,
  listPendingReportGroups,
  type AdminPostSummary,
  type AdminReportGroup,
} from "@/lib/data/community-admin";
import {
  confirmReportsAction,
  dismissReportsAction,
  setCommentBlindedAction,
  setPostBlindedAction,
  setPostDeletedAction,
  softDeleteCommentAction,
  updateCommunitySettingsAction,
} from "./actions";

export const dynamic = "force-dynamic";

const SCOPE_LABELS = { hub: "허브 커뮤니티", team: "팀 팬 커뮤니티" } as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function postHref(post: AdminPostSummary) {
  // 팀 스코프 글도 어드민은 허브 상세 경로로 열람하지 않으므로 항상 스코프에 맞춰 연결하지 않고
  // 허브 글만 링크한다(팀 글은 slug 를 모르면 경로를 만들 수 없음).
  return post.siteScope === "hub" ? `/community/post/${post.id}` : null;
}

export default async function AdminCommunityPage() {
  const [reportGroups, moderatedPosts, settings] = await Promise.all([
    listPendingReportGroups(),
    listModeratedPosts(),
    listCommunitySettings(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "커뮤니티 관리" }]} />
        <SectionHeader title="커뮤니티 관리" />
      </div>

      {/* ── 운영 설정 ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">운영 설정</h2>
        <p className="text-sm text-neutral-500">
          인기글 컷: 명예 − 싫어요가 이 값 이상이면 인기글로 등재됩니다(등재 후 유지). 자동 블라인드:
          서로 다른 이용자의 미처리 신고가 이 수에 도달하면 글/댓글이 자동으로 가려집니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["hub", "team"] as const).map((scope) => (
            <form
              key={scope}
              action={updateCommunitySettingsAction}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
            >
              <input type="hidden" name="scope" value={scope} />
              <h3 className="font-semibold">{SCOPE_LABELS[scope]}</h3>
              <label className="flex items-center justify-between gap-3 text-sm">
                인기글 컷(명예 − 싫어요)
                <input
                  type="number"
                  name="hot_cut"
                  defaultValue={settings[scope].hotCut}
                  min={1}
                  max={1000}
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-right dark:border-neutral-600 dark:bg-transparent"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                자동 블라인드 신고 수
                <input
                  type="number"
                  name="blind_report_count"
                  defaultValue={settings[scope].blindReportCount}
                  min={1}
                  max={100}
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-right dark:border-neutral-600 dark:bg-transparent"
                />
              </label>
              <button
                type="submit"
                className="self-end rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-85 dark:bg-white dark:text-neutral-900"
              >
                저장
              </button>
            </form>
          ))}
        </div>
      </section>

      {/* ── 신고함 ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">
          신고함 <span className="text-red-500">{reportGroups.length}</span>
        </h2>
        <p className="text-sm text-neutral-500">
          제재 확정 시 대상은 블라인드로 유지되고 작성자 LP가 차감됩니다. 기각 시 신고가 종결되고
          블라인드가 해제됩니다.
        </p>
        {reportGroups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
            미처리 신고가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reportGroups.map((group) => (
              <ReportGroupCard key={`${group.targetType}:${group.post?.id ?? group.comment?.id}`} group={group} />
            ))}
          </ul>
        )}
      </section>

      {/* ── 블라인드/삭제 글 ─────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">블라인드·삭제 글</h2>
        {moderatedPosts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
            블라인드 또는 삭제 상태의 글이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
            {moderatedPosts.map((post) => (
              <li key={post.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <PostMeta post={post} />
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {post.blindedAt ? (
                    <form action={setPostBlindedAction}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input type="hidden" name="blinded" value="false" />
                      <SmallButton>블라인드 해제</SmallButton>
                    </form>
                  ) : null}
                  {post.deletedAt ? (
                    <form action={setPostDeletedAction}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input type="hidden" name="deleted" value="false" />
                      <SmallButton>복구</SmallButton>
                    </form>
                  ) : (
                    <form action={setPostDeletedAction}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input type="hidden" name="deleted" value="true" />
                      <SmallButton tone="danger">삭제</SmallButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>
  );
}

function ReportGroupCard({ group }: { group: AdminReportGroup }) {
  const post = group.post;
  const comment = group.comment;
  const href = post ? postHref(post) : null;
  const title = post ? post.title : comment?.excerpt || "(내용 없음)";
  const author = post?.authorName ?? comment?.authorName ?? "알 수 없음";
  const blinded = Boolean(post?.blindedAt ?? comment?.blindedAt);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={group.targetType === "post" ? "default" : "muted"}>
          {group.targetType === "post" ? "글" : "댓글"}
        </Badge>
        {post ? <Badge tone="muted">{SCOPE_LABELS[post.siteScope]} · {boardLabel(post.siteScope, post.boardType)}</Badge> : null}
        {blinded ? <Badge tone="warn">블라인드됨</Badge> : null}
        {group.reports.some((report) => report.source === "ai") ? <Badge tone="warn">{AI_MODERATOR_NAME}</Badge> : null}
        <Badge tone="danger">신고 {group.reports.length}건</Badge>
      </div>

      <div className="min-w-0">
        {href ? (
          <Link href={href} className="line-clamp-1 font-semibold underline-offset-2 hover:underline">
            {title}
          </Link>
        ) : (
          <p className="line-clamp-1 font-semibold">{title}</p>
        )}
        {post?.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{post.excerpt}</p> : null}
        <p className="mt-1 text-[13px] text-neutral-500">
          작성자 {author} · {formatDate((post ?? comment!).createdAt)}
        </p>
      </div>

      <ul className="flex flex-col gap-1 rounded-lg bg-neutral-50 p-3 text-[13px] text-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-300">
        {group.reports.map((report, index) => (
          <li key={index}>
            <b>{report.source === "ai" ? AI_MODERATOR_NAME : report.reporterName ?? "익명"}</b> · {formatDate(report.createdAt)}
            {report.reason ? ` — ${report.reason}` : " — (사유 없음)"}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <form action={confirmReportsAction}>
          {post ? <input type="hidden" name="post_id" value={post.id} /> : null}
          {comment ? <input type="hidden" name="comment_id" value={comment.id} /> : null}
          <SmallButton tone="danger">제재 확정 (블라인드 + LP 차감)</SmallButton>
        </form>
        <form action={dismissReportsAction}>
          {post ? <input type="hidden" name="post_id" value={post.id} /> : null}
          {comment ? <input type="hidden" name="comment_id" value={comment.id} /> : null}
          <SmallButton>기각 (블라인드 해제)</SmallButton>
        </form>
        {comment ? (
          <>
            <form action={setCommentBlindedAction}>
              <input type="hidden" name="comment_id" value={comment.id} />
              <input type="hidden" name="blinded" value={blinded ? "false" : "true"} />
              <SmallButton>{blinded ? "블라인드 해제" : "블라인드"}</SmallButton>
            </form>
            <form action={softDeleteCommentAction}>
              <input type="hidden" name="comment_id" value={comment.id} />
              <SmallButton tone="danger">댓글 삭제</SmallButton>
            </form>
          </>
        ) : null}
      </div>
    </li>
  );
}

function PostMeta({ post }: { post: AdminPostSummary }) {
  const href = postHref(post);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <Badge tone="muted">{SCOPE_LABELS[post.siteScope]} · {boardLabel(post.siteScope, post.boardType)}</Badge>
        {post.isNotice ? <Badge tone="default">공지</Badge> : null}
        {post.hotAt ? <Badge tone="default">인기</Badge> : null}
        {post.blindedAt ? <Badge tone="warn">블라인드</Badge> : null}
        {post.deletedAt ? <Badge tone="danger">삭제됨</Badge> : null}
      </div>
      <div className="mt-1 min-w-0">
        {href && !post.deletedAt ? (
          <Link href={href} className="line-clamp-1 text-sm font-semibold underline-offset-2 hover:underline">
            {post.title}
          </Link>
        ) : (
          <p className="line-clamp-1 text-sm font-semibold">{post.title}</p>
        )}
        <p className="mt-0.5 text-[13px] text-neutral-500">
          {post.authorName ?? "알 수 없음"} · {formatDate(post.createdAt)} · 명예 {post.likeCount} · 싫어요 {post.dislikeCount} · 댓글 {post.commentCount} · 신고 {post.reportCount}
        </p>
      </div>
    </div>
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "muted" | "warn" | "danger" }) {
  const tones = {
    default: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
    muted: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  } as const;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function SmallButton({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <button
      type="submit"
      className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        tone === "danger"
          ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
