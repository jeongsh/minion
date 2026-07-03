type FanPageShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  contentClassName?: string;
};

export function FanPageShell({
  children,
  contentClassName = "flex flex-col gap-6",
}: FanPageShellProps) {
  return (
    <main className="fan-page-shell w-full text-[#16151b]">
      <div className={`fan-page-container py-7 md:py-9 ${contentClassName}`}>{children}</div>
    </main>
  );
}
