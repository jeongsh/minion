import Link from "next/link";

export type MiniModalRow = {
  label: string;
  value: React.ReactNode;
};

export function MiniModalLink({
  href,
  label,
  eyebrow,
  title,
  rows,
  cta = "상세 보기",
}: {
  href: string;
  label: React.ReactNode;
  eyebrow: string;
  title: string;
  rows: MiniModalRow[];
  cta?: string;
}) {
  return (
    <span className="group relative inline-flex">
      <Link href={href} className="font-semibold text-accent underline-offset-4 hover:underline">
        {label}
      </Link>
      <span className="pointer-events-none absolute left-0 top-full z-20 hidden w-72 pt-2 group-hover:block group-focus-within:block">
        <span className="block rounded-md border border-border bg-surface p-4 text-left shadow-lg">
          <span className="text-xs font-semibold text-muted">{eyebrow}</span>
          <span className="mt-1 block text-base font-semibold text-foreground">{title}</span>
          <span className="mt-3 grid gap-2">
            {rows.map((row) => (
              <span key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{row.label}</span>
                <span className="font-semibold text-foreground">{row.value}</span>
              </span>
            ))}
          </span>
          <span className="mt-3 block text-xs font-semibold text-accent">{cta}</span>
        </span>
      </span>
    </span>
  );
}
