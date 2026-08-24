/** API가 내려주는 segment.logo 경로 문자열을 앱에 번들된 동일 원본 자산으로 매핑한다(웹과 같은 자산 사용). */
export const TOURNAMENT_LOGO_ASSETS: Record<string, number> = {
  '/logos/tournaments/enc.webp': require('@/assets/logos/tournaments/enc.webp'),
  '/logos/tournaments/ewc.svg': require('@/assets/logos/tournaments/ewc.svg'),
  '/logos/tournaments/first-stand.svg': require('@/assets/logos/tournaments/first-stand.svg'),
  '/logos/tournaments/kespa-cup.svg': require('@/assets/logos/tournaments/kespa-cup.svg'),
  '/logos/tournaments/lck.svg': require('@/assets/logos/tournaments/lck.svg'),
  '/logos/tournaments/msi.svg': require('@/assets/logos/tournaments/msi.svg'),
  '/logos/tournaments/worlds.svg': require('@/assets/logos/tournaments/worlds.svg'),
};
