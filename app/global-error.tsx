"use client";

import { useEffect } from "react";
import marker from "@/assets/characters/pen-4.png";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main style={{ margin: "0 auto", maxWidth: 720, padding: "96px 24px", textAlign: "center", fontFamily: "sans-serif" }}>
          <p style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: "#6b7280" }}>
            Critical Error
          </p>
          <img src={marker.src} alt="" style={{ display: "block", width: 88, height: 88, objectFit: "contain", margin: "20px auto 0" }} />
          <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 900 }}>앱이 잠깐 삐끗했어요</h1>
          <p style={{ marginTop: 12, color: "#6b7280", lineHeight: 1.7 }}>페이지를 다시 시도해주세요.</p>
          {error.digest ? <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>digest: {error.digest}</p> : null}
          <button type="button" onClick={reset} style={{ marginTop: 24, borderRadius: 999, padding: "10px 18px", fontWeight: 900 }}>
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
