/** CSS `grid-template-columns: repeat(auto-fill, minmax(min, 1fr))`과 동일한 컬럼 수·아이템 폭을 계산한다. */
export function gridAutoFill(containerWidth: number, minItemWidth: number, gap: number) {
  if (containerWidth <= 0) return { columns: 1, itemWidth: minItemWidth };
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (minItemWidth + gap)));
  const itemWidth = (containerWidth - (columns - 1) * gap) / columns;
  return { columns, itemWidth };
}
