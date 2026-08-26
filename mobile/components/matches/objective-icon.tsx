import { Image, type ImageSource } from 'expo-image';
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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

export function ObjectiveIcon({ path, size, opacity = 1, tintColor }: { path: string; size: number; opacity?: number; tintColor?: ColorValue }) {
  const source = objectiveIconSource(path);
  if (!source) return null;
  if (path === '/objectives/tower.svg' && tintColor) {
    return (
      <Svg height={size} opacity={opacity} viewBox="0 0 24 24" width={size}>
        <Path
          clipRule="evenodd"
          d="M16.5 12L14 22H9L6.5 12L11.5 17L16.5 12ZM11.5 2L16.4992 7L15.2458 8.2525L15.25 8.25H19L11.5 15.75L4 8.25H7.74917L6.5 7L11.5 2ZM11.5 5L9.5 7L11.5 9L13.5 7L11.5 5Z"
          fill={tintColor}
          fillRule="evenodd"
        />
      </Svg>
    );
  }
  return <Image contentFit="contain" source={source} style={{ height: size, opacity, tintColor, width: size }} />;
}
