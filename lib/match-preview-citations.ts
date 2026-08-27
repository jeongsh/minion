export type PositionedUrlCitation = {
  url?: string;
  start_index?: number;
  end_index?: number;
};

export function claimObjectRanges(text: string) {
  const claimsStart = /"claims"\s*:\s*\[/.exec(text);
  if (!claimsStart) return [];
  const arrayStart = claimsStart.index + claimsStart[0].lastIndexOf("[");
  const ranges: Array<{ start: number; end: number }> = [];
  let objectStart = -1;
  let objectDepth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart + 1; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      if (objectDepth === 0) objectStart = index;
      objectDepth += 1;
      continue;
    }
    if (character === "}") {
      objectDepth -= 1;
      if (objectDepth === 0 && objectStart >= 0) {
        ranges.push({ start: objectStart, end: index + 1 });
        objectStart = -1;
      }
      continue;
    }
    if (character === "]" && objectDepth === 0) break;
  }
  return ranges;
}

export function bindUrlCitationsToClaims<T extends PositionedUrlCitation>(
  outputText: string,
  annotations: T[],
) {
  return claimObjectRanges(outputText).map((range) => annotations.filter((annotation) => {
    if (!annotation.url || typeof annotation.start_index !== "number") return false;
    const citationStart = annotation.start_index;
    const citationEnd = typeof annotation.end_index === "number"
      ? Math.max(annotation.end_index, citationStart + 1)
      : citationStart + 1;
    return citationStart < range.end && citationEnd > range.start;
  }));
}
