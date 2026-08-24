import { Image, type ImageSource } from 'expo-image';

const OBJECTIVE_ASSETS: Record<string, ImageSource> = {
  '/objectives/baron.svg': require('@/assets/objectives/baron.svg'),
  '/objectives/chemtech-dragon.svg': require('@/assets/objectives/chemtech-dragon.svg'),
  '/objectives/cloud-dragon.svg': require('@/assets/objectives/cloud-dragon.svg'),
  '/objectives/dragon.svg': require('@/assets/objectives/dragon.svg'),
  '/objectives/elder-dragon.svg': require('@/assets/objectives/elder-dragon.svg'),
  '/objectives/herald.svg': require('@/assets/objectives/herald.svg'),
  '/objectives/hextech-dragon.svg': require('@/assets/objectives/hextech-dragon.svg'),
  '/objectives/infernal-dragon.svg': require('@/assets/objectives/infernal-dragon.svg'),
  '/objectives/mountain-dragon.svg': require('@/assets/objectives/mountain-dragon.svg'),
  '/objectives/ocean-dragon.svg': require('@/assets/objectives/ocean-dragon.svg'),
  '/objectives/tower.svg': require('@/assets/objectives/tower.svg'),
  '/objectives/void-grub.svg': require('@/assets/objectives/void-grub.svg'),
};

export function objectiveIconSource(path: string) {
  return OBJECTIVE_ASSETS[path];
}

export function ObjectiveIcon({ path, size, opacity = 1 }: { path: string; size: number; opacity?: number }) {
  const source = objectiveIconSource(path);
  if (!source) return null;
  return <Image contentFit="contain" source={source} style={{ height: size, opacity, width: size }} />;
}
