import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { getAllTeamVideos, getCommunityPosts, getAllTeams } from "@/lib/data/lck";
import { NewsSearchBar } from "./news-search-bar";
import { VideoFormModal } from "./news-video-modal";
import { PostFormModal } from "./news-post-modal";
import { NewsDeleteButton } from "./news-delete-button";

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "date_desc", label: "최신순" },
  { value: "date_asc", label: "오래된순" },
  { value: "views_desc", label: "조회수 많은순" },
  { value: "views_asc", label: "조회수 적은순" },
  { value: "title_asc", label: "제목 가나다순" },
];

type SearchParams = {
  q?: string;
  type?: string;
  sort?: string;
  page?: string;
};

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const type = params.type === "post" ? "post" : "video";
  const sort = SORT_OPTIONS.find((o) => o.value === params.sort)?.value ?? "date_desc";
  const page = Math.max(1, Number(params.page) || 1);

  const [videos, posts, teams] = await Promise.all([
    getAllTeamVideos(),
    getCommunityPosts(),
    getAllTeams(),
  ]);

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // ── 영상 목록 처리 ────────────────────────────────────────────
  type VideoRow = {
    _type: "video";
    id: string;
    title: string;
    teamId: string;
    teamName: string;
    teamLogo: string;
    platform: string;
    date: string;
    views: number;
    url: string;
    thumbnail?: string;
    videoUrl: string;
    youtubeVideoId?: string;
  };

  type PostRow = {
    _type: "post";
    id: string;
    title: string;
    content: string;
    boardType: string;
    siteScope: string;
    teamId?: string;
    date: string;
    views: number;
    likes: number;
    comments: number;
    url: string;
  };

  type Row = VideoRow | PostRow;

  let rows: Row[];

  if (type === "video") {
    rows = videos.map((v): VideoRow => {
      const team = teamMap.get(v.teamId);
      return {
        _type: "video",
        id: v.id,
        title: v.title,
        teamId: v.teamId,
        teamName: team?.shortName ?? "-",
        teamLogo: team?.logoUrl ?? "",
        platform: v.platform,
        date: v.publishedAt,
        views: v.viewCount,
        url: v.videoUrl,
        thumbnail: v.thumbnailUrl ?? undefined,
        videoUrl: v.videoUrl,
        youtubeVideoId: v.youtubeVideoId,
      };
    });
  } else {
    rows = posts.map((p): PostRow => ({
      _type: "post",
      id: p.id,
      title: p.title,
      content: p.content,
      boardType: p.boardType,
      siteScope: p.siteScope,
      teamId: p.teamId,
      date: p.createdAt,
      views: p.viewCount,
      likes: p.likeCount,
      comments: p.commentCount,
      url: `/community/${p.boardType}/${p.id}`,
    }));
  }

  // ── 검색 ──────────────────────────────────────────────────────
  if (query) {
    rows = rows.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));
  }

  // ── 정렬 ──────────────────────────────────────────────────────
  rows = [...rows].sort((a, b) => {
    switch (sort) {
      case "date_asc":
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case "views_desc":
        return b.views - a.views;
      case "views_asc":
        return a.views - b.views;
      case "title_asc":
        return a.title.localeCompare(b.title, "ko");
      default: // date_desc
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
  });

  // ── 페이지네이션 ──────────────────────────────────────────────
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function buildUrl(overrides: Partial<SearchParams>) {
    const p = new URLSearchParams();
    if ((overrides.q ?? query)) p.set("q", overrides.q ?? query);
    p.set("type", overrides.type ?? type);
    p.set("sort", overrides.sort ?? sort);
    if ((overrides.page ?? String(safePage)) !== "1")
      p.set("page", overrides.page ?? String(safePage));
    return `/admin/news?${p.toString()}`;
  }

  const formatDate = (d: string) =>
    d
      ? new Intl.DateTimeFormat("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(d))
      : "-";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader eyebrow="관리자" title="소식 관리" />
        {type === "video" ? (
          <VideoFormModal mode="create" teams={teams} />
        ) : (
          <PostFormModal mode="create" teams={teams} />
        )}
      </div>

      {/* ── 컨트롤 바 ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 탭 */}
        <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-1">
          {(["video", "post"] as const).map((t) => (
            <Link
              key={t}
              href={buildUrl({ type: t, page: "1" })}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                type === t
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t === "video" ? "영상" : "커뮤니티 글"}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <NewsSearchBar defaultQuery={query} currentType={type} currentSort={sort} />
        </div>
      </div>

      {/* ── 결과 수 ───────────────────────────────────────────── */}
      <p className="text-sm text-muted">
        총 <strong className="text-foreground">{totalCount}</strong>건
        {query && <> · &ldquo;{query}&rdquo; 검색 결과</>}
      </p>

      {/* ── 테이블 ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {pageRows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">결과가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs text-muted">
                {type === "video" ? (
                  <>
                    <th className="w-12 px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">제목</th>
                    <th className="px-4 py-3 font-semibold">팀</th>
                    <th className="px-4 py-3 text-right font-semibold">조회수</th>
                    <th className="px-4 py-3 text-right font-semibold">게시일</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </>
                ) : (
                  <>
                    <th className="w-12 px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">제목</th>
                    <th className="px-4 py-3 font-semibold">게시판</th>
                    <th className="px-4 py-3 font-semibold">범위</th>
                    <th className="px-4 py-3 text-right font-semibold">조회</th>
                    <th className="px-4 py-3 text-right font-semibold">좋아요</th>
                    <th className="px-4 py-3 text-right font-semibold">댓글</th>
                    <th className="px-4 py-3 text-right font-semibold">게시일</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((row, idx) => {
                const rowNum = (safePage - 1) * PAGE_SIZE + idx + 1;
                if (row._type === "video") {
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-surface-muted">
                      <td className="px-4 py-3 tabular-nums text-muted">{rowNum}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {row.thumbnail && (
                            <img
                              src={row.thumbnail}
                              alt=""
                              className="h-9 w-16 shrink-0 rounded object-cover"
                            />
                          )}
                          <span className="line-clamp-1 font-medium">{row.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {row.teamLogo && (
                            <img src={row.teamLogo} alt="" className="h-4 w-4 object-contain" />
                          )}
                          <span className="text-muted">{row.teamName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {row.views.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">{formatDate(row.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-surface-muted"
                          >
                            보기
                          </a>
                          <VideoFormModal
                            mode="edit"
                            teams={teams}
                            initial={{
                              id: row.id,
                              teamId: row.teamId,
                              platform: row.platform,
                              title: row.title,
                              videoUrl: row.videoUrl,
                              thumbnailUrl: row.thumbnail,
                              publishedAt: row.date,
                              viewCount: row.views,
                            }}
                          />
                          <NewsDeleteButton id={row.id} type="video" />
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.id} className="transition-colors hover:bg-surface-muted">
                    <td className="px-4 py-3 tabular-nums text-muted">{rowNum}</td>
                    <td className="px-4 py-3">
                      <span className="line-clamp-1 font-medium">{row.title}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.boardType}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.siteScope === "hub"
                            ? "bg-accent/10 text-accent"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {row.siteScope === "hub" ? "허브" : "팀"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.views.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{row.likes}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{row.comments}</td>
                    <td className="px-4 py-3 text-right text-muted">{formatDate(row.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={row.url}
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-surface-muted"
                        >
                          보기
                        </Link>
                        <PostFormModal
                          mode="edit"
                          teams={teams}
                          initial={{
                            id: row.id,
                            boardType: row.boardType,
                            siteScope: row.siteScope,
                            teamId: row.teamId,
                            title: row.title,
                            content: row.content,
                          }}
                        />
                        <NewsDeleteButton id={row.id} type="post" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 페이지네이션 ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <Link
            href={buildUrl({ page: "1" })}
            className={`flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm transition-colors hover:bg-surface-muted ${safePage === 1 ? "pointer-events-none opacity-30" : ""}`}
          >
            «
          </Link>
          <Link
            href={buildUrl({ page: String(Math.max(1, safePage - 1)) })}
            className={`flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm transition-colors hover:bg-surface-muted ${safePage === 1 ? "pointer-events-none opacity-30" : ""}`}
          >
            ‹
          </Link>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - safePage) <= 2 || p === 1 || p === totalPages)
            .reduce<(number | "…")[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "…" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="flex h-8 w-8 items-center justify-center text-sm text-muted"
                >
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={buildUrl({ page: String(p) })}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                    safePage === p
                      ? "border-accent bg-accent text-white"
                      : "border-border hover:bg-surface-muted"
                  }`}
                >
                  {p}
                </Link>
              ),
            )}

          <Link
            href={buildUrl({ page: String(Math.min(totalPages, safePage + 1)) })}
            className={`flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm transition-colors hover:bg-surface-muted ${safePage === totalPages ? "pointer-events-none opacity-30" : ""}`}
          >
            ›
          </Link>
          <Link
            href={buildUrl({ page: String(totalPages) })}
            className={`flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm transition-colors hover:bg-surface-muted ${safePage === totalPages ? "pointer-events-none opacity-30" : ""}`}
          >
            »
          </Link>
        </div>
      )}
    </main>
  );
}
