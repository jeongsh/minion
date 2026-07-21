import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionHeading({
  children,
  href,
  caption,
  aside,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  caption?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  const trailing = aside ?? (href ? (
    <Link href={href} className="ml-auto flex items-center text-sm font-bold text-[var(--ui-muted)]">
      전체보기
      <ChevronRight size={16} />
    </Link>
  ) : caption ? (
    <span className="pb-0.5 text-[13px] font-semibold text-[var(--ui-muted)]">{caption}</span>
  ) : null);

  return (
    <div className={`mb-3 flex items-end justify-between gap-4 ${className}`}>
      <h2 className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">{children}</h2>
      {trailing}
    </div>
  );
}
