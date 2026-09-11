import { useEffect } from "react";
import type { Editor } from "@tiptap/react";

function loadExternalScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      const widgets = window as typeof window & { twttr?: { widgets?: unknown }; instgrm?: { Embeds?: unknown } };
      if (src.includes("twitter") ? widgets.twttr?.widgets : widgets.instgrm?.Embeds) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
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
    const root = editor.view.dom;

    const updateEmbedStates = () => {
      root.querySelectorAll<HTMLElement>(".embed-block[data-embed-type]").forEach((block) => {
        if (block.querySelector("iframe")) {
          block.classList.remove("embed-loading", "embed-error");
          block.classList.add("embed-ready");
        }
      });
    };
    const observer = new MutationObserver(updateEmbedStates);
    observer.observe(root, { childList: true, subtree: true });

    const hydrateEmbeds = async () => {
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
        root.querySelectorAll<HTMLElement>(".embed-block.embed-loading").forEach((block) => {
          block.classList.remove("embed-loading");
          block.classList.add("embed-error");
        });
      }
      updateEmbedStates();
    };

    hydrateEmbeds();
    editor.on("transaction", hydrateEmbeds);

    return () => {
      cancelled = true;
      observer.disconnect();
      editor.off("transaction", hydrateEmbeds);
    };
  }, [editor]);
}
