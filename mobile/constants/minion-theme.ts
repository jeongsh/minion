export const minionThemes = {
  light: {
    ink: '#18191c',
    text: '#2d2f33',
    muted: '#73767c',
    surface: '#ffffff',
    surfaceMuted: '#eeeeef',
    card: '#f5f5f7',
    cardHover: '#f0f0f3',
    divider: '#e8e8ed',
    adSurface: '#e7e8ea',
    footerNav: '#666a71',
    footerText: '#777b82',
    border: '#dedfe2',
    pageBackground: '#ffffff',
    accent: '#03de8a',
    accentForeground: '#ffffff',
  },
  dark: {
    ink: '#f8f8f8',
    text: '#e8e9ec',
    muted: '#8f98a8',
    surface: '#141517',
    surfaceMuted: '#1c1e22',
    card: '#1c1e22',
    cardHover: '#24272c',
    divider: '#212224',
    adSurface: '#1c1e22',
    footerNav: '#a0a7b2',
    footerText: '#8f98a8',
    border: '#383c44',
    pageBackground: '#141517',
    accent: '#03de8a',
    accentForeground: '#061018',
  },
} as const;

export const minionRadius = { card: 16, control: 8 } as const;
export const minionSize = { header: 56, dock: 52, footerDockClearance: 74 } as const;

export type MinionTheme = (typeof minionThemes)[keyof typeof minionThemes] & {
  radius: typeof minionRadius;
  size: typeof minionSize;
};
