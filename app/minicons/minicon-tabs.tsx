import Link from "next/link";

type MiniconTab = "catalog" | "mine" | "apply";

const tabs: Array<{ id: MiniconTab; href: string; label: string }> = [
  { id: "catalog", href: "/minicons", label: "전체 미니콘" },
  { id: "mine", href: "/me/minicons", label: "내 미니콘" },
  { id: "apply", href: "/minicons/apply", label: "미니콘 신청" },
];

export function MiniconTabs({ active }: { active: MiniconTab }) {
  return (
    <nav
      aria-label="미니콘 메뉴"
      className="mt-3 grid grid-cols-3 gap-0.5 rounded-[10px] bg-[var(--ui-card-bg)] p-[3px]"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const className = `flex h-8 min-w-0 items-center justify-center truncate rounded-lg border px-2 text-[14px] font-medium transition-colors ${
          selected
            ? "border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] dark:bg-[var(--ui-border)]"
            : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
        }`;

        return selected ? (
          <span key={tab.id} aria-current="page" className={className}>
            {tab.label}
          </span>
        ) : (
          <Link key={tab.id} href={tab.href} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
