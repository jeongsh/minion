import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionHeading({ children, href }: { children: React.ReactNode; href?: string }) {
  return <div className="mb-4 flex items-center"><h2 className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">{children}</h2>{href && <Link href={href} className="ml-auto flex items-center text-sm font-bold text-[var(--ui-muted)]">전체보기<ChevronRight size={16}/></Link>}</div>;
}
