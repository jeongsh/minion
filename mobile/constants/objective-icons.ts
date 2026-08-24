/** 웹 lib/objectives.ts의 OBJECTIVE_ICONS와 동일한 /public/objectives SVG 자산을 API 오리진에서 그대로 불러온다. */
export const OBJECTIVE_ICON_PATHS = {
  baron: '/objectives/baron.svg',
  herald: '/objectives/herald.svg',
  voidGrub: '/objectives/void-grub.svg',
  dragon: '/objectives/dragon.svg',
  elder: '/objectives/elder-dragon.svg',
  tower: '/objectives/tower.svg',
} as const;
