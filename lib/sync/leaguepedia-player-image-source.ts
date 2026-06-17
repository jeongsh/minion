export const PLAYER_IMAGE_PLACEHOLDER = "Unknown Infobox Image - Player.png";

export type PlayerImageCandidate = {
  Link?: string;
  FileName?: string;
  IsProfileImage?: string;
  SortDate?: string;
  Tournament?: string;
};

function imageYearFromFilename(filename: string) {
  const years = [...filename.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  return years.length > 0 ? Math.max(...years) : 0;
}

function imageSplitFromFilename(filename: string) {
  const split = filename.match(/Split\s*(\d+)/i);
  if (split) return Number(split[1]);
  if (/\b(Worlds|World Championship|WC|MSI|Cup|Road to MSI)\b/i.test(filename)) return 99;
  return 0;
}

export function comparePlayerImageCandidates(
  left: PlayerImageCandidate,
  right: PlayerImageCandidate,
) {
  const profileDelta =
    Number(right.IsProfileImage === "1") - Number(left.IsProfileImage === "1");
  if (profileDelta !== 0) return profileDelta;

  const leftName = left.FileName?.trim() ?? "";
  const rightName = right.FileName?.trim() ?? "";
  const yearDelta = imageYearFromFilename(rightName) - imageYearFromFilename(leftName);
  if (yearDelta !== 0) return yearDelta;

  const splitDelta = imageSplitFromFilename(rightName) - imageSplitFromFilename(leftName);
  if (splitDelta !== 0) return splitDelta;

  const sortDateDelta = (right.SortDate?.trim() ?? "").localeCompare(left.SortDate?.trim() ?? "");
  if (sortDateDelta !== 0) return sortDateDelta;

  return rightName.localeCompare(leftName);
}

export function isValidPlayerImageFilename(filename: string | null | undefined) {
  const normalized = filename?.trim();
  return !!normalized && normalized !== PLAYER_IMAGE_PLACEHOLDER;
}

export function pickBestPlayerImage(rows: PlayerImageCandidate[]) {
  const valid = rows.filter((row) => isValidPlayerImageFilename(row.FileName));
  if (valid.length === 0) return null;
  valid.sort(comparePlayerImageCandidates);
  return valid[0]?.FileName?.trim() ?? null;
}

export function pickBestImagesByLink(rows: PlayerImageCandidate[]) {
  const grouped = new Map<string, PlayerImageCandidate[]>();

  for (const row of rows) {
    const link = row.Link?.trim();
    if (!link) continue;
    const group = grouped.get(link) ?? [];
    group.push(row);
    grouped.set(link, group);
  }

  const result = new Map<string, string>();
  for (const [link, candidates] of grouped) {
    const best = pickBestPlayerImage(candidates);
    if (best) result.set(link, best);
  }
  return result;
}

export function pickBestImageForLinks(
  rows: PlayerImageCandidate[],
  links: string[],
) {
  const linkSet = new Set(links.map((link) => link.trim()).filter(Boolean));
  const candidates = rows.filter((row) => linkSet.has(row.Link?.trim() ?? ""));
  return pickBestPlayerImage(candidates);
}

export function pickProfileImageFilename(
  playersImage: string | null | undefined,
  imageRows: PlayerImageCandidate[],
  links: string[],
) {
  const bestFromImages = pickBestImageForLinks(imageRows, links);
  const normalizedPlayersImage = playersImage?.trim();

  if (!isValidPlayerImageFilename(normalizedPlayersImage)) {
    return bestFromImages;
  }
  if (!bestFromImages) {
    return normalizedPlayersImage!;
  }

  const left: PlayerImageCandidate = { FileName: normalizedPlayersImage, IsProfileImage: "1" };
  const right: PlayerImageCandidate = { FileName: bestFromImages, IsProfileImage: "1" };
  return comparePlayerImageCandidates(left, right) >= 0 ? bestFromImages : normalizedPlayersImage!;
}
