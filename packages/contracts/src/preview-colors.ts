/** 짙은 유채색을 검정으로 취급하지 않고, 다크 모드에서도 같은 색상을 유지한다. */
export function previewTeamColor(color: string | null | undefined, neutral: string, dark = false) {
  if (!color || !/^#[\da-f]{6}$/i.test(color)) return neutral;
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const max = Math.max(...rgb), min = Math.min(...rgb);
  const luminance = rgb.map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  if (max - min <= 12 / 255 && (luminance < 0.04 || luminance > 0.85)) return neutral;
  if (!dark || luminance >= 0.04) return color;
  // HSL의 hue와 saturation은 보존하고 lightness만 60%로 올린다.
  const lightness = (max + min) / 2;
  const saturation = (max - min) / (1 - Math.abs(2 * lightness - 1));
  const chroma = (1 - Math.abs(2 * 0.6 - 1)) * saturation;
  const offset = 0.6 - chroma / 2;
  return '#' + rgb.map((v) => Math.round(((v - min) / (max - min) * chroma + offset) * 255).toString(16).padStart(2, '0')).join('');
}
