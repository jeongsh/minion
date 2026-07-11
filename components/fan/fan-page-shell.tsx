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
      <div className="fan-page-container flex flex-col gap-6 py-7 md:py-9">
        <div className={contentClassName}>{children}</div>
      </div>
    </main>
  );
}

export function FanSubpageHeader({ title, breadcrumbs }: { title: string; breadcrumbs: Crumb[] }) {
  return (
    <header className="flex flex-col gap-3">
      <Breadcrumb items={breadcrumbs} />
      <h1 className="home-section-title text-[28px] leading-tight tracking-[-0.035em] text-[var(--ui-ink)]">{title}</h1>
    </header>
  );
}
