import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { getHomeHeroSlides } from "@/lib/data/lck";
import type { HomeHeroSlide } from "@/lib/types";
import { deleteHomeHeroSlideAction } from "./actions";
import { SlideFormModal } from "./slide-form-modal";

function SlidePreview({ slide }: { slide: HomeHeroSlide }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-muted">
      <img src={slide.imageUrl} alt={slide.title} className="aspect-[16/7] w-full object-cover" />
    </div>
  );
}

export default async function AdminHomeSliderPage() {
  const slides = await getHomeHeroSlides({ activeOnly: false });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader eyebrow="관리자" title="홈 상단 슬라이더 관리" />
        <div className="flex flex-wrap items-center gap-2">
          <SlideFormModal mode="create" />
          <Link
            href="/"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-muted transition hover:text-foreground"
          >
            홈에서 보기
          </Link>
        </div>
      </div>

      <section className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-black text-foreground">등록된 슬라이드</h2>
          <p className="text-sm font-semibold text-muted">총 {slides.length}개</p>
        </div>

        {slides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm font-semibold text-muted">
            등록된 홈 슬라이드가 없습니다. 상단의 슬라이드 등록 버튼으로 추가하세요.
          </div>
        ) : (
          <div className="grid gap-4">
            {slides.map((slide) => (
              <article key={slide.id} className="grid gap-4 rounded-2xl border border-border bg-surface p-4 xl:grid-cols-[360px_1fr]">
                <SlidePreview slide={slide} />
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-foreground">{slide.title}</h3>
                    <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-black text-muted">
                      순서 {slide.orderIndex}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        slide.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {slide.isActive ? "노출 중" : "숨김"}
                    </span>
                  </div>
                  {slide.linkUrl ? (
                    <p className="text-sm font-semibold text-muted">
                      링크: <span className="text-foreground">{slide.linkUrl}</span>
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap justify-end gap-2">
                    <SlideFormModal mode="edit" slide={slide} />
                    <form action={deleteHomeHeroSlideAction}>
                      <input type="hidden" name="id" value={slide.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
