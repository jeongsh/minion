"use client";

import { useEffect, useState } from "react";
import { NewsCard } from "@/components/news/news-card";
import { NewsThumbnail } from "@/components/news/news-thumbnail";
import { useNewsThumbnail } from "@/components/news/use-news-thumbnail";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatNewsDate, hasHomeLeadThumbnail, type NewsArticle } from "@/lib/data/news";

function isOsenArticle(article: NewsArticle) {
  if (article.source.trim().toLocaleLowerCase("ko-KR") === "osen") return true;

  try {
    const hostname = new URL(article.url).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "osen.co.kr" || hostname.endsWith(".osen.co.kr");
  } catch {
    return false;
  }
}

function LeadNewsCard({ article }: { article: NewsArticle }) {
  const { pending, src } = useNewsThumbnail(article.url, article.thumbnailUrl);
  const [errored, setErrored] = useState(false);
  const showThumbnail = !errored && (pending || Boolean(src));
  const thumbClassName = "aspect-[16/9] max-h-[300px] w-full rounded-lg sm:rounded-xl md:max-h-[260px] lg:max-h-[250px] xl:max-h-[300px]";

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block min-w-0"
    >
      {showThumbnail ? (
        src
          ? <NewsThumbnail article={article} src={src} priority onError={() => setErrored(true)} className={thumbClassName} />
          : <div className={`animate-pulse bg-[var(--ui-card-bg)] ${thumbClassName}`} />
      ) : null}
      <div className={showThumbnail ? "mt-2.5 sm:mt-3.5" : ""}>
        <h3 className="font-paperozi line-clamp-2 text-[14px] !font-bold leading-[1.4] tracking-[-0.035em] text-[var(--ui-ink)] group-hover:underline sm:text-[19px]">
          {article.title}
        </h3>
        <p className="mt-2 hidden line-clamp-2 text-[12px] leading-[1.65] text-[var(--ui-muted)] lg:block lg:text-[13px]">
          {article.summary}
        </p>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--ui-muted)] min-[390px]:mt-2 min-[390px]:gap-1.5 min-[390px]:text-[12px]">
          <span className="text-[var(--ui-ink)]">{article.source}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
        </div>
      </div>
    </a>
  );
}

export function NewsFeedLayout({
  articles,
  cardSize = "home",
  compact = false,
  featured = true,
}: {
  articles: NewsArticle[];
  cardSize?: "home" | "news";
  compact?: boolean;
  featured?: boolean;
}) {
  if (articles.length === 0) return null;

  const lead = featured
    ? articles.find((article) => !isOsenArticle(article) && hasHomeLeadThumbnail(article))
    : undefined;
  const secondary = lead
    ? articles.filter((article) => article.id !== lead.id)
    : articles;

  return (
    <div className={`grid gap-4 min-[390px]:gap-5 ${lead ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] lg:gap-8" : ""}`}>
      {lead ? <LeadNewsCard article={lead} /> : null}
      <div className="grid content-start lg:py-1">
        {secondary.map((article, index) => (
          <div
            key={article.id}
            className={`${compact && index >= 3 ? "hidden lg:block" : "block"} ${compact && index >= 4 ? "lg:hidden xl:block" : ""} border-b border-[var(--ui-card-divider)] py-2.5 first:pt-0 min-[390px]:py-3 ${compact && index === 2 ? "border-b-0 pb-0 lg:border-b lg:pb-3" : ""} ${index === secondary.length - 1 ? "border-b-0 pb-0" : ""}`}
          >
            <NewsCard article={article} size={cardSize} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactHomeNewsCard({ article }: { article: NewsArticle }) {
  const { pending, src } = useNewsThumbnail(article.url, article.thumbnailUrl);
  const [errored, setErrored] = useState(false);
  const [originalTitle, setOriginalTitle] = useState<{ url: string; title: string } | null>(null);
  const title = originalTitle?.url === article.url ? originalTitle.title : article.title;

  useEffect(() => {
    if (!/(?:\.{3}|…)\s*$/.test(article.title)) return;
    const controller = new AbortController();
    void fetch(`/api/news/title?url=${encodeURIComponent(article.url)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`News title request failed: ${response.status}`);
        return response.json() as Promise<{ title: string | null }>;
      })
      .then(({ title }) => {
        if (title && title.length > article.title.replace(/(?:\.{3}|…)\s*$/, "").length) {
          setOriginalTitle({ url: article.url, title });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("[news-title] Original title unavailable", error);
      });
    return () => controller.abort();
  }, [article.url, article.title]);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-[76px] min-w-0 items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ui-ink)]"
    >
      {src && !errored ? (
        <NewsThumbnail
          article={article}
          src={src}
          onError={() => setErrored(true)}
          className="h-[60px] w-20 shrink-0 rounded-md sm:w-24"
        />
      ) : pending ? (
        <div className="h-[60px] w-20 shrink-0 animate-pulse rounded-md bg-[var(--ui-card-bg)] sm:w-24" />
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold leading-[1.45] text-[var(--ui-ink)] group-hover:underline">
          {title}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
          <span className="truncate">{article.source}</span>
          <time className="shrink-0" dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
        </div>
      </div>
    </a>
  );
}

export function HomeNewsSection({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="home-news-heading" className="mt-10">
      <SectionHeading href="/news">
        <span id="home-news-heading">LCK 뉴스</span>
      </SectionHeading>
      <ul className="grid gap-x-8 md:grid-cols-2">
        {articles.slice(0, 6).map((article) => (
          <li key={article.id} className="min-w-0">
            <CompactHomeNewsCard article={article} />
          </li>
        ))}
      </ul>
    </section>
  );
}
