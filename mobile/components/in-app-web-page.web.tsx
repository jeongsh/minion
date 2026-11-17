import { createElement } from 'react';

import { mobileApiOrigin, resolveApiAssetUrl } from '@/lib/api-client';

// Use the original document in browser previews as well as native WebView.
export function InAppWebPage({ path, title }: { path: string; title: string }) {
  const uri = resolveApiAssetUrl(path) ?? `${mobileApiOrigin}${path}`;

  return createElement('iframe', {
    src: uri,
    title,
    style: { border: 0, display: 'block', flex: 1, height: '100%', width: '100%' },
  });
}
