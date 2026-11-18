"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { dialogBodyClassName, ControlledDialog, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteUserCommentAction, deleteUserPostAction, getUserCommentsPageAction, getUserPostsPageAction } from "../actions";

type PostRow = { id: string; title: string; content: string; createdAt: string; deleted: boolean; blinded: boolean };
type CommentRow = { id: string; postId: string; content: string; createdAt: string; deleted: boolean; blinded: boolean };

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function PageControls({ page, totalPages, totalCount, pending, onChange }: {
  page: number; totalPages: number; totalCount: number; pending: boolean; onChange: (page: number) => void;
}) {
  return <nav aria-label="목록 페이지" className="flex items-center justify-center gap-4 text-sm font-medium" aria-busy={pending}>
    <button type="button" disabled={pending || page <= 1} onClick={() => onChange(page - 1)} className="disabled:opacity-40">이전</button>
    <span className="text-muted">{pending ? "불러오는 중… " : ""}{page} / {totalPages} 페이지 (총 {totalCount.toLocaleString()}건)</span>
    <button type="button" disabled={pending || page >= totalPages} onClick={() => onChange(page + 1)} className="disabled:opacity-40">다음</button>
  </nav>;
}

export function UserContentLists({
  userId,
  initialPosts,
  initialPostPage,
  postCount,
  initialComments,
  initialCommentPage,
  commentCount,
}: {
  userId: string;
  initialPosts: PostRow[];
  initialPostPage: number;
  postCount: number;
  initialComments: CommentRow[];
  initialCommentPage: number;
  commentCount: number;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [postPage, setPostPage] = useState(initialPostPage);
  const [comments, setComments] = useState(initialComments);
  const [commentPage, setCommentPage] = useState(initialCommentPage);
  const [isPending, startTransition] = useTransition();
  const [loadingList, setLoadingList] = useState<"posts" | "comments" | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedContent, setSelectedContent] = useState<{ title: string; content: string; createdAt: string } | null>(null);
  const postPages = Math.max(1, Math.ceil(postCount / 10));
  const commentPages = Math.max(1, Math.ceil(commentCount / 10));

  function changePostsPage(page: number) {
    setLoadingList("posts");
    startTransition(async () => {
      setLoadError(false);
      try {
        const result = await getUserPostsPageAction(userId, page);
        setPosts(result.rows);
        setPostPage(result.page);
      } catch {
        setLoadError(true);
      } finally {
        setLoadingList(null);
      }
    });
  }

  function changeCommentsPage(page: number) {
    setLoadingList("comments");
    startTransition(async () => {
      setLoadError(false);
      try {
        const result = await getUserCommentsPageAction(userId, page);
        setComments(result.rows);
        setCommentPage(result.page);
      } catch {
        setLoadError(true);
      } finally {
        setLoadingList(null);
      }
    });
  }

  return <>
    {loadError ? <p role="alert" className="text-sm text-red-600">목록을 불러오지 못했습니다. 다시 시도해 주세요.</p> : null}
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">작성 글 <span className="text-muted">{postCount.toLocaleString()}</span></h2>
      <div className={loadingList === "posts" ? "opacity-60 transition-opacity" : undefined}>
        <Table><TableHeader><TableRow><TableHead>제목 및 내용</TableHead><TableHead>작성일</TableHead><TableHead>상태</TableHead><TableHead>관리</TableHead></TableRow></TableHeader><TableBody>
          {posts.map((post) => <TableRow key={post.id}><TableCell><button type="button" onClick={() => setSelectedContent({ title: post.title, content: post.content || "본문 없음", createdAt: post.createdAt })} aria-label={`게시글 보기: ${post.title}`} className="block max-w-2xl truncate text-left text-sm font-medium text-accent hover:underline">{post.title}{post.content ? ` · ${post.content}` : ""}</button></TableCell><TableCell>{formatDate(post.createdAt)}</TableCell><TableCell>{post.deleted ? "삭제됨" : post.blinded ? "블라인드" : "게시 중"}</TableCell><TableCell>{post.deleted ? "—" : <form action={deleteUserPostAction}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="user_id" value={userId} /><button className="text-sm font-medium text-red-700">삭제</button></form>}</TableCell></TableRow>)}
          {posts.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted">작성한 글이 없습니다.</TableCell></TableRow> : null}
        </TableBody></Table>
      </div>
      <PageControls page={postPage} totalPages={postPages} totalCount={postCount} pending={isPending} onChange={changePostsPage} />
    </section>
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">작성 댓글 <span className="text-muted">{commentCount.toLocaleString()}</span></h2>
      <div className={loadingList === "comments" ? "opacity-60 transition-opacity" : undefined}>
        <Table><TableHeader><TableRow><TableHead>댓글 내용</TableHead><TableHead>게시글</TableHead><TableHead>작성일</TableHead><TableHead>상태</TableHead><TableHead>관리</TableHead></TableRow></TableHeader><TableBody>
          {comments.map((comment) => <TableRow key={comment.id}><TableCell><button type="button" onClick={() => setSelectedContent({ title: "댓글 내용", content: comment.content, createdAt: comment.createdAt })} aria-label="댓글 내용 전체 보기" className="block max-w-xl truncate text-left text-sm text-accent hover:underline">{comment.content}</button></TableCell><TableCell><Link className="text-accent hover:underline" href={`/community/post/${comment.postId}`}>게시글 보기</Link></TableCell><TableCell>{formatDate(comment.createdAt)}</TableCell><TableCell>{comment.deleted ? "삭제됨" : comment.blinded ? "블라인드" : "게시 중"}</TableCell><TableCell>{comment.deleted ? "—" : <form action={deleteUserCommentAction}><input type="hidden" name="id" value={comment.id} /><input type="hidden" name="user_id" value={userId} /><button className="text-sm font-medium text-red-700">삭제</button></form>}</TableCell></TableRow>)}
          {comments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted">작성한 댓글이 없습니다.</TableCell></TableRow> : null}
        </TableBody></Table>
      </div>
      <PageControls page={commentPage} totalPages={commentPages} totalCount={commentCount} pending={isPending} onChange={changeCommentsPage} />
    </section>
    <ControlledDialog open={Boolean(selectedContent)} onClose={() => setSelectedContent(null)} labelledBy="user-content-detail-title" panelClassName="sm:max-w-2xl">
      {selectedContent ? <>
        <DialogSheetHeader onClose={() => setSelectedContent(null)} title={selectedContent.title} titleId="user-content-detail-title" />
        <div className={dialogBodyClassName}>
          <p className="mb-4 text-sm text-muted">{formatDate(selectedContent.createdAt)}</p>
          <p className="whitespace-pre-wrap break-words text-base leading-7 text-[var(--ui-text)]">{selectedContent.content}</p>
        </div>
      </> : null}
    </ControlledDialog>
  </>;
}
