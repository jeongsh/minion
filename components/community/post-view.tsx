import { CommentForm } from "@/components/community/comment-form";
import { CommentList } from "@/components/community/comment-list";
import { PostContentViewer } from "@/components/community/editor/post-content-viewer";
import { formatRelativeOrDate } from "@/components/community/format";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import { SectionHeading } from "@/components/layout/section-heading";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import type {
  CommunityCommentItem,
  CommunityPostDetail,
  ReactionState,
} from "@/lib/community/types";

// 글 상세 — 핸드오프 2d. 단일 컬럼 본문 + 추천 + 댓글.
export function PostView({
  post,
  comments,
  reaction,
  commentReactions,
  scope,
  teamSlug,
}: {
  post: CommunityPostDetail;
  comments: CommunityCommentItem[];
  reaction: ReactionState;
  commentReactions: Record<string, ReactionState>;
  scope: BoardScope;
  teamSlug?: string;
}) {
  const boardHref =
    scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : `/community`;
  const label = boardLabel(scope, post.boardType);
  const initial = (post.authorName ?? "글").trim().charAt(0) || "글";

  return (
    <article
      className={
        scope === "team"
          ? "w-full"
          : "mx-auto w-full max-w-[1240px] px-10 py-8 max-md:px-5"
      }
      style={{ ["--acc" as string]: "var(--tp, var(--team-primary, #6158ff))" }}
    >
      <Breadcrumb
        items={[{ label: "커뮤니티", href: boardHref }, { label }, { label: "글 보기" }]}
        className="mb-4"
      />

      {/* 글 헤더 */}
      <header className="section-rule pb-5">
        <span className="inline-flex rounded-[4px] px-2 py-[3px] text-[12px] font-bold text-[var(--acc)] [background:color-mix(in_oklab,var(--acc)_9%,#fff)]">
          {label}
        </span>
        <h1 className="mt-3 text-[24px] font-black leading-[1.35] text-[#16151b]">{post.title}</h1>

        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[13px] font-bold text-[var(--acc)] [background:color-mix(in_oklab,var(--acc)_10%,#fff)]">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-[#16151b]">{post.authorName ?? "작성자"}</div>
            <div className="mt-0.5 text-[12px] text-[#9c9aa3]">
              {formatRelativeOrDate(post.createdAt)} · 조회 {post.viewCount.toLocaleString()} · 추천 {post.likeCount}
            </div>
          </div>
          <div className="ml-auto">
            <ReportButton target="post" postId={post.id} scope={scope} teamSlug={teamSlug} />
          </div>
        </div>
      </header>

      {/* 본문 */}
      <div className="community-prose py-7 text-[16px] leading-[1.75] text-[#33323b]">
        <PostContentViewer content={post.content} />
      </div>

      {/* 추천 */}
      <div className="flex flex-col items-center gap-2 border-y border-[var(--hairline,#ebecef)] py-7">
        <ReactionButtons
          target="post"
          targetId={post.id}
          postId={post.id}
          scope={scope}
          teamSlug={teamSlug}
          initialState={reaction}
          initialHonorCount={post.likeCount}
          initialDislikeCount={post.dislikeCount}
        />
        <p className="text-[12px] text-[#b6b4bd]">이 글이 좋았다면 명예를, 별로였다면 싫어요를 눌러주세요</p>
      </div>

      {/* 댓글 */}
      <section className="pt-8" aria-label="댓글">
        <SectionHeading title="COMMENTS" caption={`${post.commentCount}개`} className="mb-5" />
        <CommentList
          comments={comments}
          commentReactions={commentReactions}
          scope={scope}
          teamSlug={teamSlug}
        />
        <div className="mt-6">
          <CommentForm postId={post.id} scope={scope} teamSlug={teamSlug} />
        </div>
      </section>
    </article>
  );
}
