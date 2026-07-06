export function NavigationLoadingOverlay({
  label = "페이지 데이터를 불러오는 중입니다",
}: {
  label?: string;
}) {
  return (
    <div
      className="fixed inset-y-0 right-0 top-16 z-[39] grid cursor-progress place-items-center bg-[var(--ui-surface)]/96 px-4 lg:left-[var(--shell-lnb-width,240px)]"
      data-testid="navigation-loading-overlay"
    >
      <span className="navigation-progress-track" aria-hidden="true">
        <span className="navigation-progress-bar" />
      </span>
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-3 text-sm font-bold text-[var(--ui-ink)] shadow-xl shadow-[#172554]/10 dark:shadow-black/40"
      >
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ui-border)] border-t-[var(--accent)]"
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
