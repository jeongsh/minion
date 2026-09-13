import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { PRETENDARD_UNICODE_FALLBACK_CSS } from '../../packages/fonts/pretendard';

const PAPEROZI_FONT_FACE = `
  @font-face {
    font-family: 'Paperozi';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-7Bold.woff2') format('woff2');
    font-weight: 700;
    font-display: swap;
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1, shrink-to-fit=no" name="viewport" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: PRETENDARD_UNICODE_FALLBACK_CSS }} />
        <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: PAPEROZI_FONT_FACE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
