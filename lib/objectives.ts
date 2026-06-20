import type { SetResult } from "@/lib/types";

const MINIMAP_BASE =
  "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons";

export type DragonType =
  | "cloud"
  | "infernal"
  | "mountain"
  | "ocean"
  | "hextech"
  | "chemtech"
  | "elder";

export type ObjectiveIconSlot = {
  key: string;
  src: string;
  label: string;
};

export type ObjectiveIconOptions = {
  includeElder?: boolean;
};

/** Community Dragon 미니맵 오브젝트 아이콘 (종류별 색상 구분) */
export const OBJECTIVE_ICONS = {
  baron: `${MINIMAP_BASE}/baron.png`,
  herald: `${MINIMAP_BASE}/riftherald.png`,
  voidGrub: `${MINIMAP_BASE}/grub.png`,
  dragon: `${MINIMAP_BASE}/dragon.png`,
  cloud: `${MINIMAP_BASE}/dragon_cloud.png`,
  infernal: `${MINIMAP_BASE}/dragon_infernal.png`,
  mountain: `${MINIMAP_BASE}/dragon_mountain.png`,
  ocean: `${MINIMAP_BASE}/dragon_ocean.png`,
  hextech: `${MINIMAP_BASE}/dragon_hextech.png`,
  chemtech: `${MINIMAP_BASE}/dragon_chemtech.png`,
  elder: `${MINIMAP_BASE}/dragon_elder.png`,
} as const;

type Side = "blue" | "red";

type DragonCounts = Record<DragonType, number>;

const DRAGON_FIELDS: Array<{
  type: DragonType;
  label: string;
  blueKey: keyof SetResult;
  redKey: keyof SetResult;
}> = [
  { type: "cloud", label: "바람", blueKey: "blueClouds", redKey: "redClouds" },
  { type: "infernal", label: "화염", blueKey: "blueInfernals", redKey: "redInfernals" },
  { type: "mountain", label: "대지", blueKey: "blueMountains", redKey: "redMountains" },
  { type: "ocean", label: "바다", blueKey: "blueOceans", redKey: "redOceans" },
  { type: "hextech", label: "마공", blueKey: "blueHextechs", redKey: "redHextechs" },
  { type: "chemtech", label: "화공", blueKey: "blueChemtechs", redKey: "redChemtechs" },
  { type: "elder", label: "장로", blueKey: "blueElders", redKey: "redElders" },
];

function emptyDragonCounts(): DragonCounts {
  return {
    cloud: 0,
    infernal: 0,
    mountain: 0,
    ocean: 0,
    hextech: 0,
    chemtech: 0,
    elder: 0,
  };
}

function sideValue(set: SetResult, side: Side, key: keyof SetResult) {
  const value = set[key];
  return typeof value === "number" ? value : null;
}

function dragonCountsFromSet(set: SetResult, side: Side): DragonCounts {
  const counts = emptyDragonCounts();
  for (const field of DRAGON_FIELDS) {
    const key = side === "blue" ? field.blueKey : field.redKey;
    const value = sideValue(set, side, key);
    if (value != null && value > 0) {
      counts[field.type] = value;
    }
  }
  return counts;
}

export function objectiveIconSlots(
  count: number | null | undefined,
  src: string,
  label: string,
): ObjectiveIconSlot[] {
  if (count == null || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => ({
    key: `${label}-${index}`,
    src,
    label,
  }));
}

function dragonIconsFromCounts(
  dragons: DragonCounts,
  options?: { includeElder?: boolean },
): ObjectiveIconSlot[] {
  const includeElder = options?.includeElder ?? true;
  const icons: ObjectiveIconSlot[] = [];

  for (const field of DRAGON_FIELDS) {
    if (!includeElder && field.type === "elder") continue;

    for (let index = 0; index < dragons[field.type]; index += 1) {
      icons.push({
        key: `${field.type}-${index}`,
        src: OBJECTIVE_ICONS[field.type],
        label: field.label,
      });
    }
  }

  return icons;
}

export function dragonIconsForSide(
  set: SetResult,
  side: Side,
  options?: ObjectiveIconOptions,
): ObjectiveIconSlot[] {
  const icons = dragonIconsFromCounts(dragonCountsFromSet(set, side), {
    includeElder: options?.includeElder ?? true,
  });
  if (icons.length > 0) return icons;

  const total = side === "blue" ? set.blueDragons : set.redDragons;
  return objectiveIconSlots(total, OBJECTIVE_ICONS.dragon, "드래곤");
}

export function elderIconsForSide(set: SetResult, side: Side) {
  const count = sideValue(set, side, side === "blue" ? "blueElders" : "redElders");
  return objectiveIconSlots(count, OBJECTIVE_ICONS.elder, "장로");
}

export function baronIconsForSide(set: SetResult, side: Side) {
  const count = sideValue(set, side, side === "blue" ? "blueBarons" : "redBarons");
  return objectiveIconSlots(count, OBJECTIVE_ICONS.baron, "바론");
}

export function heraldIconsForSide(set: SetResult, side: Side) {
  const count = sideValue(set, side, side === "blue" ? "blueRiftHeralds" : "redRiftHeralds");
  return objectiveIconSlots(count, OBJECTIVE_ICONS.herald, "전령");
}

export function voidGrubIconsForSide(set: SetResult, side: Side) {
  const count = sideValue(set, side, side === "blue" ? "blueVoidGrubs" : "redVoidGrubs");
  return objectiveIconSlots(count, OBJECTIVE_ICONS.voidGrub, "공허충");
}
