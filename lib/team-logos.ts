/** LCK 10개 팀 로고는 `/logos/{slug}.svg`, 화이트 버전은 `/logos/{slug}-white.svg` 규칙을 따른다. */
export function teamLogoPath(key: string) {
  return `/logos/${key}.svg`;
}

export function teamWhiteLogoPath(key: string) {
  return `/logos/${key}-white.svg`;
}
