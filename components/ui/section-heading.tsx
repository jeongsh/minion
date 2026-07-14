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
    <Link href={href} className="ml-auto flex items-center text-[12px] font-bold text-[var(--ui-muted)] sm:text-[13px]">
      전체보기
      <ChevronRight size={14} />
    </Link>
  ) : caption ? (
    <span className="pb-0.5 text-[12px] font-semibold text-[var(--ui-muted)] sm:text-[13px]">{caption}</span>
  ) : null);

  return (
    <div className={`mb-2.5 flex items-end justify-between gap-3 sm:mb-5 sm:gap-4 ${className}`}>
      <h2 className="home-section-title text-[18px] leading-tight text-[var(--ui-ink)] sm:text-[length:var(--ui-title-size)]">{children}</h2>
      {trailing}
    </div>
  );
}
