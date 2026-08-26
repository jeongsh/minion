export type GameRuneOption = {
  id: number;
  name: string;
  icon: string;
  treeName?: string;
};

export type RuneCatalog = {
  keystones: GameRuneOption[];
  trees: GameRuneOption[];
};

type DdragonRuneSlot = {
  runes: Array<{
    id: number;
    name: string;
    icon: string;
    localizedName?: string;
  }>;
};

export type DdragonRuneTree = {
  id: number;
  name: string;
  icon: string;
  slots: DdragonRuneSlot[];
  localizedName?: string;
};

export function runeImageUrl(rune: Pick<GameRuneOption, "icon">) {
  return `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`;
}

export function runeImageUrlById(options: GameRuneOption[], runeId: number | null | undefined) {
  const rune = options.find((entry) => entry.id === runeId);
  return rune ? runeImageUrl(rune) : "";
}

/** runeIds에서 키스톤(크게)과 보조 계열(작게) URL을 판별한다. 저장 순서가 바뀐 데이터도 처리한다. */
export function resolveRunePairUrls(
  runeIds: Array<number | null | undefined>,
  catalog: RuneCatalog,
): { keystoneUrl: string; treeUrl: string } {
  let keystoneUrl = "";
  let treeUrl = "";

  for (const runeId of runeIds) {
    if (typeof runeId !== "number" || runeId <= 0) continue;

    const keystone = catalog.keystones.find((entry) => entry.id === runeId);
    if (keystone) {
      keystoneUrl = runeImageUrl(keystone);
      continue;
    }

    const tree = catalog.trees.find((entry) => entry.id === runeId);
    if (tree) {
      treeUrl = runeImageUrl(tree);
    }
  }

  return { keystoneUrl, treeUrl };
}

export function runeLabel(options: GameRuneOption[], runeId: number | null | undefined) {
  if (!runeId) return "";
  return options.find((entry) => entry.id === runeId)?.name ?? `#${runeId}`;
}

export function filterRunes(options: GameRuneOption[], query: string, limit = 40) {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? options.filter(
        (rune) =>
          rune.name.toLowerCase().includes(normalized) ||
          rune.treeName?.toLowerCase().includes(normalized) ||
          String(rune.id).includes(normalized),
      )
    : options;

  return filtered.slice(0, limit);
}

export async function fetchRuneCatalog(version = "16.12.1"): Promise<RuneCatalog> {
  const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/runesReforged.json`, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(`Data Dragon rune catalog request failed: ${response.status}`);
  }

  const json = (await response.json()) as DdragonRuneTree[];

  const trees = json
    .map((tree) => ({
      id: tree.id,
      name: tree.name,
      icon: tree.icon,
    }))
    .filter((tree) => Number.isFinite(tree.id) && tree.id > 0 && tree.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const keystones = json
    .flatMap((tree) =>
      (tree.slots[0]?.runes ?? []).map((rune) => ({
        id: rune.id,
        name: rune.name,
        icon: rune.icon,
        treeName: tree.name,
      })),
    )
    .filter((rune) => Number.isFinite(rune.id) && rune.id > 0 && rune.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return { keystones, trees };
}

export async function fetchRuneNameToIdMap(version = "16.12.1"): Promise<Map<string, number>> {
  try {
    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`,
      { next: { revalidate: 60 * 60 * 24 } },
    );
    if (!response.ok) return new Map();
    const json = (await response.json()) as DdragonRuneTree[];
    const map = new Map<string, number>();
    for (const tree of json) {
      map.set(tree.name.toLowerCase(), tree.id);
      const noSpaceTree = tree.name.replace(/\s+/g, "").toLowerCase();
      if (noSpaceTree !== tree.name.toLowerCase()) map.set(noSpaceTree, tree.id);
      for (const slot of tree.slots) {
        for (const rune of slot.runes) {
          map.set(rune.name.toLowerCase(), rune.id);
          const noSpace = rune.name.replace(/\s+/g, "").toLowerCase();
          if (noSpace !== rune.name.toLowerCase()) map.set(noSpace, rune.id);
        }
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Data Dragon는 스탯 파편(글자 그대로 "Adaptive Force" 등)을 runesReforged.json에 담지
 * 않는다. 대신 고정된 정적 CDN 경로로 서빙되는데, 이 경로들은 시즌이 바뀌어도 안정적으로
 * 유지된다. Leaguepedia SP.Runes 필드에서 실제로 관측된 7개 파편 이름을 기준으로 매핑했다.
 */
const STAT_SHARD_ICON_BY_NAME: Record<string, string> = {
  "adaptive force": "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png",
  "attack speed": "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png",
  "ability haste": "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png",
  "move speed": "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMovementSpeedIcon.png",
  "health scaling": "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png",
  "health": "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthPlusIcon.png",
  "tenacity and slow resist": "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsTenacityIcon.png",
};

/** 룬 트리 전체 구조(키스톤 포함 각 슬롯의 모든 선택지)를 그대로 반환한다 — 이름은 Leaguepedia 값과
 * 맞춰 매칭할 수 있도록 영문(en_US) 그대로 둔다. */
export async function fetchFullRuneTrees(version = "16.12.1"): Promise<DdragonRuneTree[]> {
  try {
    const [englishResponse, koreanResponse] = await Promise.all([
      fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`, {
        next: { revalidate: 60 * 60 * 24 },
      }),
      fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/runesReforged.json`, {
        next: { revalidate: 60 * 60 * 24 },
      }),
    ]);
    if (!englishResponse.ok) return [];

    const english = (await englishResponse.json()) as DdragonRuneTree[];
    const korean = koreanResponse.ok ? (await koreanResponse.json()) as DdragonRuneTree[] : [];
    const koreanTreeById = new Map(korean.map((tree) => [tree.id, tree]));
    const koreanRuneById = new Map(
      korean.flatMap((tree) => tree.slots.flatMap((slot) => slot.runes)).map((rune) => [rune.id, rune]),
    );

    return english.map((tree) => ({
      ...tree,
      localizedName: koreanTreeById.get(tree.id)?.name,
      slots: tree.slots.map((slot) => ({
        ...slot,
        runes: slot.runes.map((rune) => ({
          ...rune,
          localizedName: koreanRuneById.get(rune.id)?.name,
        })),
      })),
    }));
  } catch {
    return [];
  }
}

const TREE_NAME_KO: Record<string, string> = {
  Precision: "정밀",
  Domination: "지배",
  Sorcery: "마법",
  Resolve: "결의",
  Inspiration: "영감",
};

/**
 * 스탯 파편 3행의 선택지 이름. Data Dragon에는 없어서 실제 Leaguepedia SP.Runes 데이터
 * (인덱스 6/7/8 위치)를 분석해 확인한 값이다.
 */
const SHARD_ROWS: string[][] = [
  ["Adaptive Force", "Attack Speed", "Ability Haste"],
  ["Adaptive Force", "Move Speed", "Health Scaling"],
  ["Health", "Tenacity and Slow Resist", "Health Scaling"],
];

const SHARD_NAME_KO: Record<string, string> = {
  "Adaptive Force": "적응형 능력치",
  "Attack Speed": "공격 속도",
  "Ability Haste": "스킬 가속",
  "Move Speed": "이동 속도",
  "Health Scaling": "성장 체력",
  Health: "체력",
  "Tenacity and Slow Resist": "강인함과 둔화 저항",
};

export type RuneGridOption = { name: string; url: string; selected: boolean };
export type RuneGridRow = RuneGridOption[];

export type RuneBuildGrid = {
  /** 선택 상세가 없어 전체 트리를 비선택 상태로 보여주는 그리드인지 여부 */
  empty?: boolean;
  primaryTreeName: string;
  primaryTreeIcon: string;
  /** [키스톤 행, 주계열 나머지 3행] */
  primaryRows: RuneGridRow[];
  secondaryTreeName: string;
  secondaryTreeIcon: string;
  /** 키스톤 행 제외 3행 */
  secondaryRows: RuneGridRow[];
  /** 3행(공격/유연/방어) */
  shardRows: RuneGridRow[];
};

/**
 * SP.Runes 순서([키스톤, 주계열3, 보조계열2, 파편3])의 선택된 룬 이름 9개와 전체 룬 트리
 * 카탈로그로부터, 실제 클라이언트 룬 페이지처럼 선택되지 않은 옵션까지 포함한 전체 그리드를
 * 만든다. 주계열은 키스톤이 속한 트리, 보조계열은 보조 룬 2개 중 하나라도 포함하는(키스톤
 * 트리가 아닌) 트리로 역추적한다.
 */
export function buildRuneBuildGrid(
  fullRuneNames: string[],
  trees: DdragonRuneTree[],
): RuneBuildGrid | null {
  if (fullRuneNames.length !== 9 || trees.length === 0) return null;
  const [keystoneName, p1, p2, p3, s1, s2, sh1, sh2, sh3] = fullRuneNames;
  const keystoneKey = keystoneName.toLowerCase();
  const primaryMinors = new Set([p1, p2, p3].map((n) => n.toLowerCase()));
  const secondaryMinors = new Set([s1, s2].map((n) => n.toLowerCase()));

  const primaryTree = trees.find((tree) =>
    tree.slots[0]?.runes.some((rune) => rune.name.toLowerCase() === keystoneKey),
  );
  if (!primaryTree) return null;

  const secondaryTree = trees.find(
    (tree) =>
      tree.id !== primaryTree.id &&
      tree.slots.slice(1).some((slot) => slot.runes.some((rune) => secondaryMinors.has(rune.name.toLowerCase()))),
  );
  if (!secondaryTree) return null;

  const toRow = (runes: DdragonRuneSlot["runes"], selected: Set<string>): RuneGridRow =>
    runes.map((rune) => ({
      name: rune.localizedName ?? rune.name,
      url: runeImageUrl(rune),
      selected: selected.has(rune.name.toLowerCase()),
    }));

  const treeIconUrl = (tree: DdragonRuneTree) => `https://ddragon.leagueoflegends.com/cdn/img/${tree.icon}`;

  const shardNames = [sh1, sh2, sh3];
  const shardRows: RuneGridRow[] = SHARD_ROWS.map((options, rowIndex) => {
    const selectedKey = shardNames[rowIndex]?.toLowerCase();
    return options.map((name) => ({
      name: SHARD_NAME_KO[name] ?? name,
      url: STAT_SHARD_ICON_BY_NAME[name.toLowerCase()] ?? "",
      selected: name.toLowerCase() === selectedKey,
    }));
  });

  return {
    primaryTreeName: primaryTree.localizedName ?? TREE_NAME_KO[primaryTree.name] ?? primaryTree.name,
    primaryTreeIcon: treeIconUrl(primaryTree),
    primaryRows: primaryTree.slots.map((slot, index) =>
      toRow(slot.runes, index === 0 ? new Set([keystoneKey]) : primaryMinors),
    ),
    secondaryTreeName: secondaryTree.localizedName ?? TREE_NAME_KO[secondaryTree.name] ?? secondaryTree.name,
    secondaryTreeIcon: treeIconUrl(secondaryTree),
    secondaryRows: secondaryTree.slots.slice(1).map((slot) => toRow(slot.runes, secondaryMinors)),
    shardRows,
  };
}

/**
 * 세부 선택 데이터가 없을 때도 룬 영역의 형태를 유지한다. 남아 있는 룬 ID로 주·보조
 * 계열을 복원하고, 모든 선택지를 비선택 상태로 반환한다.
 */
export function buildEmptyRuneBuildGrid(
  runeIds: Array<number | null | undefined>,
  trees: DdragonRuneTree[],
): RuneBuildGrid | null {
  if (trees.length < 2) return null;

  const ids = new Set(runeIds.filter((id): id is number => typeof id === "number" && id > 0));
  const primaryTree =
    trees.find((tree) => tree.slots[0]?.runes.some((rune) => ids.has(rune.id))) ?? trees[0];
  const secondaryTree =
    trees.find((tree) => tree.id !== primaryTree.id && ids.has(tree.id)) ??
    trees.find((tree) => tree.id !== primaryTree.id);

  if (!secondaryTree) return null;

  const emptyRow = (runes: DdragonRuneSlot["runes"]): RuneGridRow =>
    runes.map((rune) => ({
      name: rune.localizedName ?? rune.name,
      url: runeImageUrl(rune),
      selected: false,
    }));
  const treeIconUrl = (tree: DdragonRuneTree) =>
    `https://ddragon.leagueoflegends.com/cdn/img/${tree.icon}`;
  const shardRows: RuneGridRow[] = SHARD_ROWS.map((options) =>
    options.map((name) => ({
      name: SHARD_NAME_KO[name] ?? name,
      url: STAT_SHARD_ICON_BY_NAME[name.toLowerCase()] ?? "",
      selected: false,
    })),
  );

  return {
    empty: true,
    primaryTreeName: primaryTree.localizedName ?? TREE_NAME_KO[primaryTree.name] ?? primaryTree.name,
    primaryTreeIcon: treeIconUrl(primaryTree),
    primaryRows: primaryTree.slots.map((slot) => emptyRow(slot.runes)),
    secondaryTreeName:
      secondaryTree.localizedName ?? TREE_NAME_KO[secondaryTree.name] ?? secondaryTree.name,
    secondaryTreeIcon: treeIconUrl(secondaryTree),
    secondaryRows: secondaryTree.slots.slice(1).map((slot) => emptyRow(slot.runes)),
    shardRows,
  };
}

export function localizeRuneNames(names: string[], trees: DdragonRuneTree[]) {
  const translated = new Map<string, string>();
  for (const tree of trees) {
    translated.set(tree.name.toLowerCase(), tree.localizedName ?? TREE_NAME_KO[tree.name] ?? tree.name);
    for (const slot of tree.slots) {
      for (const rune of slot.runes) {
        translated.set(rune.name.toLowerCase(), rune.localizedName ?? rune.name);
      }
    }
  }
  for (const [english, korean] of Object.entries(SHARD_NAME_KO)) translated.set(english.toLowerCase(), korean);
  return names.map((name) => translated.get(name.toLowerCase()) ?? name);
}

export async function fetchRuneImages(version = "16.12.1"): Promise<Record<string, string>> {
  try {
    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/runesReforged.json`,
      { next: { revalidate: 60 * 60 * 24 } },
    );
    if (!response.ok) return {};
    const data = (await response.json()) as DdragonRuneTree[];
    const result: Record<string, string> = {};
    for (const style of data) {
      result[String(style.id)] = `https://ddragon.leagueoflegends.com/cdn/img/${style.icon}`;
      for (const slot of style.slots) {
        for (const rune of slot.runes) {
          result[String(rune.id)] = `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`;
        }
      }
    }
    return result;
  } catch {
    return {};
  }
}
