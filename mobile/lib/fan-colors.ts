function channel(value: string, offset: number) {
  return Number.parseInt(value.slice(offset, offset + 2), 16);
}

/** 웹 FanSiteLayout의 --team-accent-text color-mix 계산을 RN 색으로 옮긴다. */
export function fanAccentText(primaryColor: string) {
  const value = primaryColor.replace('#', '').padEnd(6, '0').slice(0, 6);
  const rgb = [channel(value, 0), channel(value, 2), channel(value, 4)];
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  const target = luminance > 0.58 ? 0 : 255;
  const mixed = rgb.map((part) => Math.round(part * 0.72 + target * 0.28));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

export function fanHeaderControlColor(dark: boolean) {
  return dark ? 'rgba(248,248,248,0.78)' : 'rgba(24,25,28,0.78)';
}
