/**
 * 키치 UI에서 반복해서 쓰는 색 조합.
 * 실제 색상 값은 globals.css에만 두고, 컴포넌트에서는 이 CSS 변수 참조를 사용한다.
 */
export const KITSCH_PALETTES = {
  greenButter: {
    main: "var(--palette-green-butter-main)",
    point: "var(--palette-green-butter-point)",
  },
  grapeLime: {
    main: "var(--palette-grape-lime-main)",
    point: "var(--palette-grape-lime-point)",
  },
  tomatoButter: {
    main: "var(--palette-tomato-butter-main)",
    point: "var(--palette-tomato-butter-point)",
    hover: "var(--palette-tomato-butter-hover)",
  },
  celebration: {
    main: "var(--palette-celebration-main)",
    point: "var(--palette-celebration-point)",
    soft: "var(--palette-celebration-soft)",
  },
} as const;
