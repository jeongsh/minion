import { Breadcrumb, type Crumb } from "@/components/layout/breadcrumb";

type FanPageShellProps = {
  children: React.ReactNode;
  contentClassName?: string;
};

export function FanPageShell({
  children,
  contentClassName = "flex flex-col gap-6",
}: FanPageShellProps) {
  return (
    <main className="fan-page-shell w-full text-[var(--ui-ink)]">
      <div className="fan-page-container flex flex-col gap-5 py-5 md:gap-6 md:py-9">
        <div className={contentClassName}>{children}</div>
      </div>
    </main>
  );
}

function fanHeaderTitle(title: string) {
  if (!/[\uAC00-\uD7A3]/.test(title) || !/[A-Za-z]/.test(title)) return title;

  return title
    .replace(/[A-Za-z][A-Za-z0-9&'._:+#/-]*/g, "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .replace(/(?:[|/:,-]|\u00B7)\s*$/g, "")
    .trim();
}

export function FanSubpageHeader({ title, breadcrumbs }: { title: string; breadcrumbs: Crumb[] }) {
  const displayTitle = fanHeaderTitle(title);

  return (
    <header className="flex flex-col gap-3">
      <Breadcrumb items={breadcrumbs} className="hidden md:flex" />
      <h1 className="home-section-title font-paperozi text-[18px] leading-tight text-[var(--ui-ink)] md:text-[24px] lg:text-[28px]">{displayTitle || title}</h1>
    </header>
  );
}
