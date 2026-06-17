"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MiniModalRow = {
  label: string;
  value: React.ReactNode;
};

export function MiniModalLink({
  href,
  label,
  eyebrow,
  title,
  rows,
  cta = "상세 보기",
  placement = "bottom",
}: {
  href: string;
  label: React.ReactNode;
  eyebrow: string;
  title: string;
  rows: MiniModalRow[];
  cta?: string;
  placement?: "top" | "bottom";
}) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const panelWidth = 288;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8);

    if (placement === "top") {
      setStyle({
        position: "fixed",
        left,
        bottom: window.innerHeight - rect.top + 8,
        zIndex: 50,
      });
      return;
    }

    setStyle({
      position: "fixed",
      left,
      top: rect.bottom + 8,
      zIndex: 50,
    });
  }, [placement]);

  const show = () => {
    updatePosition();
    setVisible(true);
  };

  const hide = () => setVisible(false);

  useEffect(() => {
    if (!visible) return;
    const handleReposition = () => updatePosition();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [visible, updatePosition]);

  return (
    <>
      <Link
        ref={anchorRef}
        href={href}
        className="font-semibold text-accent underline-offset-4 hover:underline"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {label}
      </Link>
      {mounted && visible
        ? createPortal(
            <div
              style={style}
              className="pointer-events-none w-72"
              onMouseEnter={show}
              onMouseLeave={hide}
            >
              <div className="rounded-md border border-border bg-surface p-4 text-left shadow-lg">
                <p className="text-xs font-semibold text-muted">{eyebrow}</p>
                <p className="mt-1 text-base font-semibold text-foreground">{title}</p>
                <div className="mt-3 grid gap-2">
                  {rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted">{row.label}</span>
                      <span className="font-semibold text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs font-semibold text-accent">{cta}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
