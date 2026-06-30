export function NavigationLoadingOverlay({
  label = "페이지 데이터를 불러오는 중입니다",
}: {
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid cursor-progress place-items-center bg-white px-4"
      data-testid="navigation-loading-overlay"
    >
      <span className="navigation-progress-track" aria-hidden="true">
        <span className="navigation-progress-bar" />
      </span>
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-full border border-[#e2e6ef] bg-white px-5 py-3 text-sm font-bold text-[#172554] shadow-xl shadow-[#172554]/10"
      >
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[#d9dcff] border-t-[#6158ff]"
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
