export function NavigationLoadingOverlay({
  label = "페이지 데이터를 불러오는 중입니다",
}: {
  label?: string;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-[39] grid cursor-progress place-items-center bg-[var(--page-background)] px-4 sm:top-16 min-[1200px]:left-[var(--shell-lnb-width,216px)]"
      data-testid="navigation-loading-overlay"
    >
      <span className="navigation-progress-track" aria-hidden="true">
        <span className="navigation-progress-bar" />
      </span>
      <div
        role="status"
        aria-live="polite"
        className="flex w-[min(100%,22rem)] items-center justify-center gap-2.5 rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2.5 text-[13px] font-bold text-[var(--ui-ink)] shadow-xl shadow-[#172554]/10 sm:w-auto sm:gap-3 sm:px-5 sm:py-3 sm:text-sm dark:shadow-black/40"
      >
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ui-border)] border-t-[var(--accent)]"
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{label}</span>
      </div>
    </div>
  );
}
