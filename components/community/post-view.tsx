import Link from "next/link";

import { CommentForm } from "@/components/community/comment-form";
import { CommentList } from "@/components/community/comment-list";
import { PostContentViewer } from "@/components/community/editor/post-content-viewer";
import { formatRelativeOrDate } from "@/components/community/format";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
import type {
  CommunityCommentItem,
  CommunityPostDetail,
  ReactionState,
} from "@/lib/community/types";

// 글 상세 — 시안 2a. 정확값 동기화 버전.
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

  return (
    <article className="overflow-hidden rounded-[14px] border border-[#e4e8ef] bg-white shadow-[0_6px_24px_-12px_rgba(20,30,60,0.18),0_1px_2px_rgba(20,30,60,0.04)]">
      <header className="px-9 pt-[30px]">
        <div className="mb-[14px] flex items-center gap-[9px] text-[12.5px] text-[#9aa3b5]">
          <Link href={boardHref} className="font-semibold text-accent hover:underline">
            커뮤니티
          </Link>
          <span aria-hidden>›</span>
          <span className="rounded-[6px] bg-[#f1f4f9] px-[9px] py-[5px] text-[11px] font-bold text-[#56607a]">
            {boardLabel(scope, post.boardType)}
          </span>
          {isHotPost(post) && (
            <span className="rounded-[6px] bg-accent px-[9px] py-[5px] text-[11px] font-bold text-accent-foreground">
              인기
            </span>
          )}
        </div>

        <h1 className="text-[25px] font-extrabold leading-[1.32] tracking-[-0.01em] text-[#111827] md:text-[28px]">
          {post.title}
        </h1>

        <div className="mt-[18px] flex items-center gap-3 border-b border-[#eef1f6] pb-5">
          {/* TODO: 작성자 표시명/아바타 join 시 실제 데이터로 교체 */}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9edf4] text-[11px] font-bold text-[#6b7488]">
            글
          </span>
          <div>
            <div className="text-[14px] font-bold text-[#28324a]">작성자</div>
            <div className="mt-[6px] text-[12.5px] text-[#9aa3b5]">
              {formatRelativeOrDate(post.createdAt)} · 조회 {post.viewCount}
            </div>
          </div>
          <div className="ml-auto">
            <ReportButton target="post" postId={post.id} scope={scope} teamSlug={teamSlug} />
          </div>
        </div>
      </header>

      <div className="px-9 pb-2 pt-6 text-[15.5px] leading-[1.85] text-[#28324a]">
        <PostContentViewer content={post.content} />
      </div>

      <div className="flex flex-col items-center gap-[9px] border-b border-[#eef1f6] px-9 py-6">
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
        <p className="text-[12px] text-[#aab2c2]">이 글이 좋았다면 명예를, 별로였다면 싫어요를 눌러주세요</p>
      </div>

      <section className="px-9 py-6" aria-label="댓글">
        <h2 className="mb-4 text-[15px] font-extrabold text-[#111827]">
          댓글 <span className="text-accent">{post.commentCount}</span>
        </h2>
        <CommentList
          comments={comments}
          commentReactions={commentReactions}
          scope={scope}
          teamSlug={teamSlug}
        />
        <div className="mt-5">
          <CommentForm postId={post.id} scope={scope} teamSlug={teamSlug} />
        </div>
      </section>
    </article>
  );
}
