export type LeaguepediaIdentity = {
  id: string;
  slug?: string | null;
  name?: string | null;
  short_name?: string | null;
  leaguepedia_page?: string | null;
  source_id?: string | null;
};

export type LeaguepediaAlias = {
  entity_id: string;
  page_name: string;
};

export function normalizeLeaguepediaKey(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^lp:/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function displayNameFromLeaguepediaPage(pageName: string | null | undefined) {
  return String(pageName ?? "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function uniqueMatch<T extends LeaguepediaIdentity>(matches: T[]) {
  const unique = new Map(matches.map((match) => [match.id, match]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}

function identityKeys(identity: LeaguepediaIdentity) {
  return [
    identity.leaguepedia_page,
    identity.source_id,
    identity.slug,
    identity.name,
    identity.short_name,
  ].filter((value): value is string => Boolean(value?.trim()));
}

/**
 * Exact source keys win. Parenthetical stripping is only a final fallback and
 * only succeeds when it identifies exactly one entity.
 */
export function resolveLeaguepediaIdentity<T extends LeaguepediaIdentity>(
  value: string | null | undefined,
  identities: T[],
  aliases: LeaguepediaAlias[] = [],
) {
  const exactKey = normalizeLeaguepediaKey(value);
  if (!exactKey) return null;

  const aliasEntityIds = new Set(
    aliases
      .filter((alias) => normalizeLeaguepediaKey(alias.page_name) === exactKey)
      .map((alias) => alias.entity_id),
  );
  const exactMatches = identities.filter((identity) =>
    aliasEntityIds.has(identity.id) ||
    identityKeys(identity).some((key) => normalizeLeaguepediaKey(key) === exactKey)
  );
  const exact = uniqueMatch(exactMatches);
  if (exact) return exact;
  if (exactMatches.length > 1) return null;

  const displayKey = normalizeLeaguepediaKey(displayNameFromLeaguepediaPage(value));
  if (!displayKey) return null;
  const displayMatches = identities.filter((identity) =>
    identityKeys(identity).some(
      (key) => normalizeLeaguepediaKey(displayNameFromLeaguepediaPage(key)) === displayKey,
    ) || aliases.some(
      (alias) => alias.entity_id === identity.id &&
        normalizeLeaguepediaKey(displayNameFromLeaguepediaPage(alias.page_name)) === displayKey,
    )
  );
  return uniqueMatch(displayMatches);
}

export function leaguepediaSourceId(pageName: string) {
  return `lp:${pageName.trim()}`;
}
