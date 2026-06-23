import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { getHomeHeroSlides } from "@/lib/data/lck";
import type { HomeHeroSlide } from "@/lib/types";
import {
  createHomeHeroSlideAction,
  deleteHomeHeroSlideAction,
  updateHomeHeroSlideAction,
} from "./actions";

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground outline-none transition focus:border-primary"
      />
    </label>
  );
}

function ActiveField({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-foreground">
      <input name="is_active" type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-primary" />
      홈 노출
    </label>
  );
}

function SlidePreview({ slide }: { slide: HomeHeroSlide }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-muted">
      <img src={slide.imageUrl} alt={slide.title} className="aspect-[16/7] w-full object-cover" />
    </div>
  );
}

function SlideForm({ slide }: { slide?: HomeHeroSlide }) {
  return (
    <form
      action={slide ? updateHomeHeroSlideAction : createHomeHeroSlideAction}
      className="grid gap-3 rounded-xl border border-border bg-surface p-4"
    >
      {slide ? <input type="hidden" name="id" value={slide.id} /> : null}
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1.7fr]">
        <Field
          label="관리 제목"
          name="title"
          defaultValue={slide?.title}
          placeholder="예: T1 우승 하이라이트"
          required
        />
        <Field
          label="이미지 URL"
          name="image_url"
          defaultValue={slide?.imageUrl}
          placeholder="https://..."
          required
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.7fr_140px_120px] lg:items-end">
        <Field
          label="클릭 링크"
          name="link_url"
          defaultValue={slide?.linkUrl}
          placeholder="/matches/... 또는 https://..."
        />
        <Field label="노출 순서" name="order_index" type="number" defaultValue={slide?.orderIndex ?? 0} />
        <ActiveField defaultChecked={slide?.isActive ?? true} />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white transition hover:bg-primary-strong"
        >
          {slide ? "수정 저장" : "슬라이드 추가"}
        </button>
      </div>
    </form>
  );
}

export default async function AdminHomeSliderPage() {
  const slides = await getHomeHeroSlides({ activeOnly: false });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader eyebrow="관리자" title="홈 상단 슬라이더 관리" />
        <Link
          href="/"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-muted transition hover:text-foreground"
        >
          홈에서 보기
        </Link>
      </div>

      <section className="grid gap-4">
        <h2 className="text-lg font-black text-foreground">새 슬라이드</h2>
        <SlideForm />
      </section>

      <section className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-black text-foreground">등록된 슬라이드</h2>
          <p className="text-sm font-semibold text-muted">총 {slides.length}개</p>
        </div>

        {slides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm font-semibold text-muted">
            등록된 홈 슬라이드가 없습니다. 슬라이드가 없으면 홈은 최신 영상 썸네일을 사용합니다.
          </div>
        ) : (
          <div className="grid gap-4">
            {slides.map((slide) => (
              <article key={slide.id} className="grid gap-4 rounded-2xl border border-border bg-surface p-4 xl:grid-cols-[360px_1fr]">
                <SlidePreview slide={slide} />
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
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
                  <SlideForm slide={slide} />
                  <form action={deleteHomeHeroSlideAction} className="flex justify-end">
                    <input type="hidden" name="id" value={slide.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
