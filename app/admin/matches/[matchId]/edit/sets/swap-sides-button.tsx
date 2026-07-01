"use client";

export function SwapSidesButton({
  blueSelectId,
  redSelectId,
}: {
  blueSelectId: string;
  redSelectId: string;
}) {
  function swap() {
    const blueSelect = document.getElementById(blueSelectId) as HTMLSelectElement | null;
    const redSelect = document.getElementById(redSelectId) as HTMLSelectElement | null;
    if (!blueSelect || !redSelect) {
      return;
    }
    const blueValue = blueSelect.value;
    blueSelect.value = redSelect.value;
    redSelect.value = blueValue;
    blueSelect.dispatchEvent(new Event("change", { bubbles: true }));
    redSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <button
      type="button"
      onClick={swap}
      className="rounded-md border border-background/30 bg-background/10 px-2 py-1 text-xs font-semibold text-background hover:bg-background/20"
    >
      진영 교체
    </button>
  );
}
