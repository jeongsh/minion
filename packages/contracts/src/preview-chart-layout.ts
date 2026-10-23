export const CHAMPION_MAP_HEIGHT = 264;
export const CHAMPION_MAP_ROW_HEIGHT = 88;

/** 픽 비중 순서를 유지하며 오른쪽 끝에 몰린 원과 한 줄 이름을 세 행 안에서 분리한다. */
export function placePreviewChampions<T extends { picksA: number; picksB: number }>(items: T[], width: number) {
  const gap = Math.max(22, 76 / Math.max(200, width) * 100);
  const ends = [-Infinity, -Infinity, -Infinity];
  const placed = items.map((item) => ({ ...item, x: 8 + item.picksB / (item.picksA + item.picksB) * 84, lane: 0 }))
    .sort((a, b) => a.x - b.x)
    .map((item) => {
      const free = ends.findIndex((end) => item.x - end >= gap);
      const lane = free >= 0 ? free : ends.indexOf(Math.min(...ends));
      const x = Math.max(item.x, ends[lane] + gap);
      ends[lane] = x;
      return { ...item, x, lane };
    });
  for (let lane = 0; lane < ends.length; lane += 1) {
    let limit = 92;
    for (const item of placed.filter((entry) => entry.lane === lane).toReversed()) {
      item.x = Math.min(item.x, limit);
      limit = item.x - gap;
    }
  }
  return placed;
}
