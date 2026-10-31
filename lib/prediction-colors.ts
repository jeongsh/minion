export function isBlackPredictionColor(color: string) {
  const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  return Math.max(...channels) <= 64 && Math.max(...channels) - Math.min(...channels) <= 24;
}

// Keep the light ticket's dark labels readable while using the strongest team tint.
export function predictionSelectionOpacity(color: string) {
  if (isBlackPredictionColor(color)) return "100%";
  const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const luminance = (rgb: number[]) => rgb.reduce((sum, value, index) => {
    const channel = value / 255;
    return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const ink = luminance([24, 25, 28]);
  for (let percent = 68; percent >= 0; percent--) {
    const background = channels.map((channel) => channel * percent / 100 + 255 * (1 - percent / 100));
    if ((luminance(background) + 0.05) / (ink + 0.05) >= 4.5) return `${percent}%`;
  }
  return "0%";
}
