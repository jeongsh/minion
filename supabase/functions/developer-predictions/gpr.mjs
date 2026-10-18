// The official GPR page embeds Apollo's server response. Never execute its scripts.
export function parseGprPage(html, now = new Date()) {
  const teams = new Map();
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const text = script[1];
    if (!text.startsWith('(window[Symbol.for("ApolloSSRDataTransport")]') || !text.includes('"teamGPR"')) continue;
    const start = text.indexOf('.push(');
    let payload;
    try {
      payload = JSON.parse(text.slice(start + 6).replace(/\);?\s*$/, ''));
    } catch {
      // Apollo's event stream also contains JS `undefined`; use the JSON rehydration snapshot.
      continue;
    }
    for (const snapshot of Object.values(payload.rehydrate ?? {})) {
      for (const row of snapshot?.data?.teamGPR ?? []) {
        const rating = row.currentTeamGPR;
        const calculated = Date.parse(rating?.dateCalculated);
        if (!row.team?.id || !Number.isFinite(rating?.gprScore) || rating.gprScore <= 0 ||
            !Number.isFinite(calculated) || calculated > now.getTime() + 86400000 ||
            calculated < now.getTime() - 14 * 86400000) continue;
        teams.set(row.team.id, {
          code: row.team.code, name: row.team.name, slug: row.team.slug,
          score: rating.gprScore, calculated_at: rating.dateCalculated,
        });
      }
    }
  }
  if (teams.size < 10) throw new Error('Official GPR snapshot is missing, stale or invalid');
  return [...teams.values()];
}

const normalize = (value) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const codeAliases = { cloud9: 'c9', lll: 'loud', agal: 'al', ml: 'los', mibrlos: 'los' };
const code = (value) => codeAliases[normalize(value)] ?? normalize(value);

export function mapGprTeams(rankings, teams) {
  const mapped = [];
  for (const team of teams) {
    const names = [team.slug, team.name, team.source_team_id?.replace(/^lp:/, '')].map(normalize).filter(Boolean);
    const candidates = rankings.filter((row) =>
      (team.short_name && code(row.code) === code(team.short_name)) ||
      names.includes(normalize(row.slug)) || names.includes(normalize(row.name)));
    if (candidates.length > 1) throw new Error(`Ambiguous GPR mapping: ${team.id}`);
    if (candidates.length === 1) mapped.push({ team_id: team.id, score: candidates[0].score, calculated_at: candidates[0].calculated_at });
  }
  return mapped;
}
