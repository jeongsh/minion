"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AndroidLogo, AppleLogo } from "@/components/layout/store-logos";
import { ANDROID_PLAY_STORE_URL, APP_LAUNCH_BANNER_DISMISS_KEY, IOS_APP_STORE_URL } from "@/lib/app-store-links";
import { KITSCH_PALETTES } from "@/lib/theme/palettes";

const BANNER_HEIGHT = 36;

/**
 * 헤더보다 위에 놓이는 앱 출시 이벤트 배너.
 * 문서 흐름에 있어 스크롤하면 함께 올라가고, 고정 헤더는 --app-banner-scroll만큼 따라 올라가 상단에 붙는다.
 * 노출 여부(닫음, iOS Safari)는 첫 페인트 전 스크립트가 html 속성으로 정하고 CSS가 처리한다.
 */
export function AppLaunchBanner() {
  useEffect(() => {
    // 스크롤 연동 애니메이션을 지원하면 CSS가 스크롤과 같은 프레임에 처리하므로 JS 보정이 필요 없다.
    if (typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()")) return;
    const root = document.documentElement;
    let last = -1;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const next = Math.min(Math.max(window.scrollY, 0), BANNER_HEIGHT);
      if (next === last) return;
      last = next;
      root.style.setProperty("--app-banner-scroll", `${next}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--app-banner-scroll");
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(APP_LAUNCH_BANNER_DISMISS_KEY, "1");
    } catch {}
    document.documentElement.setAttribute("data-app-banner-hidden", "");
  };

  return <AppLaunchBannerBar className="app-event-banner relative z-[51]" onDismiss={dismiss} />;
}


export type AppLaunchBannerTheme = { background: string; accent: string; foreground: string; buttonText: string };

export const DEFAULT_APP_LAUNCH_BANNER_THEME: AppLaunchBannerTheme = {
  background: KITSCH_PALETTES.greenButter.deep,
  accent: KITSCH_PALETTES.greenButter.point,
  foreground: "#ffffff",
  buttonText: KITSCH_PALETTES.greenButter.deep,
};

export function AppLaunchBannerBar({
  theme = DEFAULT_APP_LAUNCH_BANNER_THEME,
  className,
  onDismiss,
}: {
  theme?: AppLaunchBannerTheme;
  className?: string;
  onDismiss?: () => void;
}) {
  return (
    <div className={`h-9 ${className ?? ""}`} style={{ backgroundColor: theme.background, color: theme.foreground }} role="region" aria-label="앱 출시 안내">
      {/* PC에서는 좌측 내비게이션 폭을 비우고 본문과 같은 최대 폭·여백 안에서 좌우로 배치한다. */}
      <div className="h-full md:pl-14">
      <div className="relative mx-auto flex h-full w-full max-w-[var(--breakpoint-wide)] items-center gap-2.5 pl-4 pr-12 sm:gap-3 sm:px-[var(--layout-gutter)]">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="hidden shrink-0 text-[13px] font-medium sm:inline" style={{ color: theme.accent }}>앱 출시</span>
          <span className="min-w-0 truncate font-paperozi text-[14px]">MINION 앱이 나왔어요!</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <a href={IOS_APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="app-banner-store app-banner-store-ios h-7 items-center gap-1 rounded-md bg-white px-2 text-[13px] font-medium transition hover:brightness-95" style={{ color: theme.buttonText }} aria-label="App Store에서 MINION 앱 받기">
            <AppleLogo size={14} />
            <span className="app-banner-store-label-desktop">App Store</span>
            <span className="app-banner-store-label-mobile">앱 받기</span>
          </a>
          <a href={ANDROID_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="app-banner-store app-banner-store-android h-7 items-center gap-1 rounded-md bg-white px-2 text-[13px] font-medium transition hover:brightness-95" style={{ color: theme.buttonText }} aria-label="Google Play에서 MINION 앱 받기">
            <AndroidLogo size={14} />
            <span className="app-banner-store-label-desktop">Google Play</span>
            <span className="app-banner-store-label-mobile">앱 받기</span>
          </a>
        </div>
        <button type="button" onClick={onDismiss} className="absolute right-1.5 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/20 transition hover:bg-white/30 sm:static sm:ml-auto" aria-label="앱 출시 안내 닫기">
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
      </div>
    </div>
  );
}
