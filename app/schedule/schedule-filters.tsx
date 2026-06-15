"use client";

import { useRouter, useSearchParams } from "next/navigation";

const months = Array.from({ length: 12 }, (_, index) => index + 1);

export function ScheduleFilters({
  activeYear,
  activeMonth,
}: {
  activeYear: number;
  activeMonth: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(next: { year?: number; month?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const year = next.year ?? activeYear;
    const month = next.month ?? activeMonth;

    params.set("year", String(year));
    params.set("month", String(month));
    router.push(`/schedule?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 md:justify-end">
        <button
          type="button"
          className="text-2xl text-muted"
          aria-label="이전 연도"
          onClick={() => navigate({ year: activeYear - 1 })}
        >
          ‹
        </button>
        <strong className="text-3xl font-black tracking-normal">{activeYear}</strong>
        <button
          type="button"
          className="text-2xl text-muted"
          aria-label="다음 연도"
          onClick={() => navigate({ year: activeYear + 1 })}
        >
          ›
        </button>
        <button
          type="button"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
          onClick={() => {
            const now = new Date();
            const kstMonth = Number(
              new Intl.DateTimeFormat("en-US", {
                timeZone: "Asia/Seoul",
                month: "numeric",
              }).format(now),
            );
            const kstYear = Number(
              new Intl.DateTimeFormat("en-US", {
                timeZone: "Asia/Seoul",
                year: "numeric",
              }).format(now),
            );
            navigate({ year: kstYear, month: kstMonth });
          }}
        >
          최신
        </button>
      </div>

      <div className="border-y border-border">
        <div className="grid grid-cols-6 gap-0 md:grid-cols-12">
          {months.map((month) => (
            <button
              key={month}
              type="button"
              className={`border-b-2 px-3 py-4 text-sm font-semibold ${
                month === activeMonth
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
              onClick={() => navigate({ month })}
            >
              {month}월
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
