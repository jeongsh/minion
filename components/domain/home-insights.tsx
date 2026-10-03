"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { SectionHeading } from "@/components/ui/section-heading";
import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";
import { useSwiperResize } from "@/components/ui/use-swiper-resize";
import type { HomeInsights } from "@/lib/data/home-insights";

const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
const card = "flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-[var(--ui-card-bg)] text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]";


function CardCarousel({ cards }: { cards: { id: string; content: ReactNode }[] }) {
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
  const setSwiper = useSwiperResize();
  return <div className="relative">
    <Swiper modules={[Navigation]} {...navigationProps} onSwiper={setSwiper} spaceBetween={12} slidesPerView={2.2}
      breakpoints={{ 520: { slidesPerView: 3.2, spaceBetween: 12 }, 768: { slidesPerView: 4.2, spaceBetween: 14 }, 1024: { slidesPerView: 5.2, spaceBetween: 16 }, 1280: { slidesPerView: 6, spaceBetween: 16 } }}>
      {cards.map(({ id, content }) => <SwiperSlide key={id} className="!h-auto">{content}</SwiperSlide>)}
    </Swiper>
    <div className="hidden sm:block"><SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} /></div>
  </div>;
}

function PresenceRing({ value }: { value: number | null }) {
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, value ?? 0));
  return <div className="relative size-[60px] rounded-full @[180px]:size-[72px] @[220px]:size-[88px] bg-black/75 text-white" aria-label={`픽밴률 ${percent(value)}`}>
    <svg viewBox="0 0 88 88" className="size-full -rotate-90" aria-hidden>
      <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-white/15" />
      <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)} />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[12px] font-medium leading-4 tabular-nums @[180px]:text-[14px] @[180px]:leading-5">{percent(value)}</span><span className="mt-0 text-[12px] font-normal leading-4 text-white/75 @[180px]:mt-0.5 @[180px]:text-[13px]">픽밴률</span></div>
  </div>;
}

function ChampionArt({ src }: { src: string }) {
  return src ? <Image src={src} alt="" fill sizes="(max-width: 519px) 45vw, (max-width: 767px) 31vw, (max-width: 1279px) 24vw, 220px" className="object-cover object-[center_25%]" /> : null;
}

export function HomeMetaSection({ data }: { data: HomeInsights | null }) {
  return <section aria-label="대회 메타">
    <SectionHeading href={data?.href ?? "/champions"}>대회 메타</SectionHeading>
    {data?.champions.length ? <CardCarousel cards={data.champions.map(champion => ({ id: champion.id, content:
      <Link href={champion.href} className={card}>
        <div className="relative @container aspect-[3/4] overflow-hidden bg-[var(--ui-surface)]">
          <ChampionArt src={champion.artwork} />
          <div aria-hidden className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/65 to-transparent" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
          <h3 className="absolute inset-x-2 top-2 truncate text-[14px] font-medium leading-5 text-white @[180px]:inset-x-3 @[180px]:top-3 @[180px]:text-[15px] @[180px]:font-bold @[200px]:text-[16px] @[200px]:leading-6 @[220px]:inset-x-4 @[220px]:top-4">{champion.name}</h3>
          <div className="absolute inset-x-1.5 bottom-2 flex items-center justify-between gap-1 @[180px]:inset-x-3 @[180px]:bottom-3 @[180px]:gap-2">
            <dl className="flex min-w-0 flex-1 flex-col gap-1 text-white @[180px]:gap-2">
              <div className="flex items-center gap-1 @[180px]:gap-2"><dt className="text-[12px] font-normal leading-4 text-white/75 @[180px]:text-[13px] @[180px]:leading-5">픽</dt><dd className="text-[12px] font-medium leading-4 tabular-nums @[180px]:text-[14px] @[180px]:leading-5">{champion.picks}회</dd></div>
              <div className="flex items-center gap-1 @[180px]:gap-2"><dt className="text-[12px] font-normal leading-4 text-white/75 @[180px]:text-[13px] @[180px]:leading-5">밴</dt><dd className="text-[12px] font-medium leading-4 tabular-nums @[180px]:text-[14px] @[180px]:leading-5">{champion.bans}회</dd></div>
            </dl>
            <div className="shrink-0"><PresenceRing value={champion.presence} /></div>
          </div>
        </div>
      </Link>
    }))} /> : <EmptyState>대회 기록이 없습니다.</EmptyState>}
  </section>;
}

export function HomeBuildSection({ data }: { data: HomeInsights | null }) {
  return <section aria-label="프로 선수 빌드" className="mt-6 sm:mt-8 lg:mt-10">
    <SectionHeading href="/schedule">프로 선수 빌드</SectionHeading>
    {data?.builds.length ? <CardCarousel cards={data.builds.map(build => ({ id: build.id, content:
      <Link href={build.href} className={card} aria-label={`${build.player} ${build.champion} 빌드`}>
        <div className="relative @container aspect-[3/4] overflow-hidden bg-[var(--ui-surface)]">
          <ChampionArt src={build.artwork} />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 to-transparent" />
          <div className="absolute inset-x-2 bottom-2 flex flex-col gap-2 @[180px]:inset-x-3 @[180px]:bottom-3 @[180px]:gap-3 @[220px]:inset-x-4 @[220px]:bottom-4">
          <div className="flex min-w-0 items-center gap-1.5 @[180px]:gap-2 @[220px]:gap-2.5">
            {build.playerImage ? <Image src={build.playerImage} alt="" width={48} height={48} unoptimized className="size-8 shrink-0 rounded-full bg-black/40 @[180px]:size-10 @[220px]:size-12 object-cover object-top" /> : null}
            <h3 className="min-w-0 truncate text-[15px] font-bold leading-5 text-white @[200px]:text-[16px] @[200px]:leading-6">{build.player}</h3>
          </div>
          <div className="grid grid-cols-3 justify-items-center gap-1 rounded-lg bg-black/50 p-1.5 @[180px]:rounded-xl @[180px]:p-2 @[220px]:gap-x-2 @[220px]:gap-y-1.5 @[220px]:p-2.5" aria-label="경기 종료 아이템">
            {Array.from({ length: 6 }, (_, index) => build.items[index] ? <Image key={index} src={build.items[index].image} alt={build.items[index].name} title={build.items[index].name} width={36} height={36} unoptimized className="size-6 rounded-md @[140px]:size-7 @[200px]:size-8 @[220px]:size-9 @[220px]:rounded-lg" /> : <span key={index} aria-hidden className="size-6 rounded-md @[140px]:size-7 @[200px]:size-8 @[220px]:size-9 @[220px]:rounded-lg bg-white/10" />)}
          </div>
          </div>
        </div>
      </Link>
    }))} /> : <EmptyState>빌드 기록이 없습니다.</EmptyState>}
  </section>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-[16px] font-normal leading-6 text-[var(--ui-muted)]">{children}</p>;
}
