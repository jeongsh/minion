import { PageHeader } from "@/components/ui/page-header";

type FanPageShellProps = {
  children: React.ReactNode;
  contentClassName?: string;
};

export function FanPageShell({
  children,
  contentClassName = "flex flex-col gap-6",
}: FanPageShellProps) {
  return (
    <main className="fan-page-shell w-full text-[#16151b]">
      <div className="fan-page-container flex flex-col gap-6 py-7 md:py-9">
        <div className={contentClassName}>{children}</div>
      </div>
    </main>
  );
}
