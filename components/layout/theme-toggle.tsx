"use client";

import { useEffect, useState } from "react";

import { SegmentedToggle } from "@/components/ui/tabs";

export const THEME_STORAGE_KEY = "minion-theme";

export type ThemeMode = "dark" | "light";

export function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content", theme === "dark" ? "#141517" : "#ffffff",
  );
}

export function saveTheme(theme: ThemeMode) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 저장소를 쓸 수 없어도 현재 화면에는 적용한다.
  }
}

// 모바일 헤더에서 뺀 색상 모드 전환을 마이 화면에서 제공한다.
export function ThemeModeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <SegmentedToggle
      items={[{ key: "light", label: "라이트" }, { key: "dark", label: "다크" }]}
      activeKey={theme}
      ariaLabel="색상 모드"
      onSelect={(next) => {
        saveTheme(next);
        setTheme(next);
      }}
    />
  );
}
