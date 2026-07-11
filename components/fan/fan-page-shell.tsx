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

export function FanSubpageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header>
      <h1 className="text-[32px] font-black leading-tight tracking-[-0.035em] text-[var(--ui-ink)]">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ui-muted)]">{description}</p> : null}
    </header>
  );
}
