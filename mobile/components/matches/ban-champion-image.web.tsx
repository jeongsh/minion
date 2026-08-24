import { createElement } from 'react';

export function BanChampionImage({ url }: { url: string }) {
  return createElement('img', {
    alt: '',
    src: url,
    style: { filter: 'grayscale(1)', height: '100%', objectFit: 'cover', opacity: 0.65, width: '100%' },
  });
}
