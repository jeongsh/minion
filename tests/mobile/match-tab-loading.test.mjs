import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function route({ noSets = false, brokenHistory = false } = {}) {
  const calls = [];
  const match = { id: 'match', matchDate: '2026-09-01T00:00:00Z', status: 'completed', teamAId: 'a', teamBId: 'b', tournamentId: 'cup', stageId: 'stage' };
  const sets = noSets ? [] : [{ id: 'set-1', setNumber: 1, matchId: 'match', blueTeamId: 'a', redTeamId: 'b', patch: '16.1' }];
  const teams = [{ id: 'a', name: 'A', shortName: 'A' }, { id: 'b', name: 'B', shortName: 'B' }];
  const values = {
    getMatchById: match, getSetsByMatchId: sets, getAllTeams: teams,
    getAllPlayers: [{ id: 'player', name: 'Player', teamId: 'a', position: 'MID' }],
    getTournaments: [{ id: 'cup', name: 'Cup' }], getStages: [{ id: 'stage', name: 'Stage' }],
    getMatchVodsByMatchId: [{ provider: 'youtube', setNumber: 1, url: 'https://example.com/video' }],
    getFanRatingsByMatchId: [{ setId: 'set-1', playerId: 'player', authorId: 'viewer', rating: 10, teamId: 'a' }],
    getMatches: [], getSets: [], getSetPicksBans: [],
    getPlayerStatLines: [{ playerId: 'player', teamId: 'a', position: 'MID' }],
    getTimelineEvents: [], getTimelineFrames: [], getChampions: [], getPlayerBuildEvents: [], getPlayerBenchmarkStatLines: [],
  };
  const lck = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, async () => {
    calls.push(name);
    if (brokenHistory && ['getMatches', 'getSets'].includes(name)) throw new Error('history unavailable');
    return value;
  }]));
  const dependencies = {
    '@/lib/data/lck': lck,
    '@/lib/ddragon': { ddragonVersionFromPatch: () => '16.1.1' },
    '@/lib/champions': { championImage: () => null, normalizedDdragonId: () => '', fetchChampionAbilityIcons: async () => null },
    '@/lib/player-build': { buildPlayerLoadoutTimeline: () => ({ skillOrder: [], itemPurchaseGroups: [] }) },
    '@/lib/match-display': { isMatchLive: () => false, matchStatusLabel: value => value },
    '@/lib/match-preview-ai': { getMatchAiPreview: async () => { calls.push('getMatchAiPreview'); return { sources: [], summary: 'preview', watchPoints: [] }; } },
    '@/lib/data/match-briefing': {
      getStoredMatchBriefingSources: async () => ({ preview: null }),
      getStoredMatchBriefingData: async (_match, _teams, _players, data) => ({ ...data, powerRankings: { teams: [], status: 'unavailable' } }),
    },
    '@/lib/match-briefing-stats': {
      matchBriefingSample: () => ({ setIds: [] }),
      buildMatchBriefingStats: () => ({ teamA: { values: [] }, teamB: { values: [] } }),
      TEAM_RADAR_AXES: [], formatTeamMetric: value => value,
    },
    '@/lib/power-rankings': { teamPowerRanking: () => null },
    '@/lib/match-preview-visuals': {
      buildMatchBriefingVisuals: () => ({ teamA: { setIds: [], lanes: [] }, teamB: { setIds: [], lanes: [] } }),
      buildTeamStyles: () => ({ teamA: { scores: [], values: [] }, teamB: { scores: [], values: [] } }),
      buildChampionPriority: () => [], buildFirstDragonMinutes: () => [], buildLeagueSetRecord: () => null,
      TEAM_STYLE_AXES: [], formatTeamStyle: value => value, regionLeague: () => null, teamRegion: () => null,
    },
    '@/lib/data/match-preview-timeline': { getDragonEvents: async () => [] },
    '@/lib/data/match-preview-accuracy': { getStoredPreviewPredictions: async () => [] },
    '@/lib/match-preview-accuracy': { buildMatchPreviewAccuracy: () => null },
    '@/lib/predictions': { getPredictionMarketData: async () => { calls.push('getPredictionMarketData'); return { bets: [] }; }, predictionMarketForMatch: () => ({ teamAPercent: 50, teamBPercent: 50 }) },
    '@/lib/view-data': { fanRatingLeader: () => null },
    '@/lib/set-status': { getSetRatingStartedAt: () => null, isSetRatingOpen: () => false, isSetRatingSnapshotReady: () => false },
    '@/lib/mobile/api-response': {
      mobileError: (code, message, status) => ({ error: { code, message }, status }),
      mobileSuccess: data => data,
      ...Object.fromEntries(['toMobileMatch', 'toMobileObjectiveCounts', 'toMobileSetDraftSide', 'toMobileSetPlayerStat', 'toMobileTeam', 'toMobileTimelineEvent', 'toMobileTimelineFrame'].map(name => [name, value => value])),
    },
    '@/lib/runes': {
      fetchRuneCatalog: async () => { calls.push('fetchRuneCatalog'); return {}; },
      fetchFullRuneTrees: async () => { calls.push('fetchFullRuneTrees'); return []; },
      buildRuneBuildGrid: () => null,
      buildEmptyRuneBuildGrid: () => null,
    },
    '@/lib/spells': { fetchSpellCatalog: async () => { calls.push('fetchSpellCatalog'); return []; } },
    '@/lib/mobile/auth': { getMobileAuth: async () => ({ user: { id: 'viewer' } }) },
    '@/lib/match-header-labels': { compactMatchStageName: value => value, compactMatchTournamentName: value => value },
  };
  const source = fs.readFileSync(new URL('../../app/api/mobile/v1/matches/[matchId]/route.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, URL, Date, require: name => {
    assert.ok(name in dependencies, `Unmocked import: ${name}`); return dependencies[name];
  } });
  return {
    calls,
    get: async (query = '') => JSON.parse(JSON.stringify(await exports.GET(new Request(`https://example.com/api/mobile/v1/matches/match${query}`), { params: Promise.resolve({ matchId: 'match' }) }))),
  };
}

test('default set entry succeeds even if unrelated preview history is unavailable', async () => {
  const api = route({ brokenHistory: true });
  const data = await api.get('?tab=data');
  assert.equal(data.activeSet.id, 'set-1');
  assert.equal(data.preview, null);
  for (const name of ['getMatches', 'getSets', 'getMatchAiPreview', 'getPredictionMarketData', 'getFanRatingsByMatchId', 'getMatchVodsByMatchId']) assert.ok(!api.calls.includes(name), name);
});

test('tab responses preserve their corresponding full-response data', async () => {
  const full = await route().get();
  const sections = { data: ['activeSet', 'players'], preview: ['preview'], rating: ['fanRating', 'players'], video: ['vods', 'matchVodUrl'], live: ['live'] };
  for (const [tab, fields] of Object.entries(sections)) {
    const scoped = await route().get(`?tab=${tab}`);
    for (const field of ['match', 'header', 'sets', 'activeSetId', ...fields]) assert.deepEqual(scoped[field], full[field], `${tab}.${field}`);
  }
});

test('rating reads personal ratings but skips timeline, spell, rune and preview queries', async () => {
  const api = route();
  const data = await api.get('?tab=rating&set=set-1');
  assert.equal(data.fanRating.players[0].myRating, 5);
  assert.equal(data.fanRating.players[0].averageRating, 5);
  assert.equal(data.activeSet, null);
  for (const name of ['getTimelineEvents', 'getTimelineFrames', 'getSetPicksBans', 'fetchSpellCatalog', 'fetchRuneCatalog', 'getPlayerBuildEvents', 'fetchFullRuneTrees', 'getMatchAiPreview', 'getPlayerBenchmarkStatLines']) assert.ok(!api.calls.includes(name), name);
});

test('matches without sets fall back to the same preview as the web', async () => {
  const data = await route({ noSets: true }).get('?tab=data');
  assert.equal(data.activeSet, null);
  assert.equal(data.sets.length, 0);
  assert.equal(data.preview.ai.summary, 'preview');
});

test('old clients and unknown tabs retain the full response contract', async () => {
  const api = route();
  const data = await api.get('?tab=unknown');
  assert.ok(data.preview && data.activeSet && data.fanRating && data.vods.length);
  assert.ok(api.calls.includes('getMatches') && api.calls.includes('getTimelineFrames'));
});
