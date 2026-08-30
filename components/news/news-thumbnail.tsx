import type { NewsArticle } from "@/lib/data/news";

export function NewsThumbnail({
  article,
  src,
  className = "",
  priority = false,
  onError,
}: {
  article: NewsArticle;
  src?: string | null;
  className?: string;
  priority?: boolean;
  onError?: () => void;
}) {
  const resolvedSrc = src ?? article.thumbnailUrl;
  if (!resolvedSrc) return null;

  return (
    <figure className={`overflow-hidden bg-[var(--ui-card-bg)] ${className}`}>
      {/* 외부 언론사 이미지라 호스트가 매번 달라 Next Image allowlist를 사용할 수 없다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedSrc}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={onError}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none"
      />
    </figure>
  );
}
