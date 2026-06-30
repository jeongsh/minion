import { useEffect } from "react";
import type { Editor } from "@tiptap/react";

function loadExternalScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

// 트위터/인스타 임베드 blockquote 를 외부 위젯 스크립트로 하이드레이션한다.
// 스크립트 로드 실패 시 링크 fallback 으로 보인다.
export function useEmbedHydration(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;

    let cancelled = false;

    const hydrateEmbeds = async () => {
      const root = editor.view.dom;
      const hasTwitter = !!root.querySelector(".twitter-tweet");
      const hasInstagram = !!root.querySelector(".instagram-media");
      if (!hasTwitter && !hasInstagram) return;

      try {
        if (hasTwitter) {
          await loadExternalScript("https://platform.twitter.com/widgets.js");
          if (!cancelled) {
            (window as unknown as { twttr?: { widgets?: { load: (el: HTMLElement) => void } } }).twttr?.widgets?.load(root);
          }
        }

        if (hasInstagram) {
          await loadExternalScript("https://www.instagram.com/embed.js");
          if (!cancelled) {
            (window as unknown as { instgrm?: { Embeds?: { process: () => void } } }).instgrm?.Embeds?.process();
          }
        }
      } catch {
        // 무시: 링크 fallback 으로 표시된다.
      }
    };

    hydrateEmbeds();
    editor.on("transaction", hydrateEmbeds);

    return () => {
      cancelled = true;
      editor.off("transaction", hydrateEmbeds);
    };
  }, [editor]);
}
