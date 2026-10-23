import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadSource(path, modules) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in modules, `unexpected dependency ${name}`); return modules[name]; }, Error });
  return exports;
}

function database(profileResults, subscriptionError = null, rankResult = { data: { effective_tier: 'challenger' }, error: null }) {
  let reads = 0;
  return {
    get reads() { return reads; },
    from: (table) => ({
      select: () => ({ eq: () => table === 'profiles'
        ? { maybeSingle: async () => profileResults[Math.min(reads++, profileResults.length - 1)] }
        : table === 'ranked_profiles'
          ? { maybeSingle: async () => rankResult }
        : Promise.resolve({ data: [], error: subscriptionError }) }),
    }),
  };
}

test('bootstrap returns an error instead of overwriting a known viewer with an empty profile', async () => {
  for (const result of [{ data: null, error: { message: 'network' } }, { data: null, error: null }]) {
    const db = database([result]);
    const { GET } = loadSource('../../app/api/mobile/v1/bootstrap/route.ts', {
      '@/lib/data/lck': { getTeams: async () => [] },
      '@/lib/mobile/auth': { getMobileAuth: async () => ({ supabase: db, user: { id: 'member' } }) },
      '@/lib/mobile/api-response': { mobileError: (code, message, status) => ({ code, message, status }), mobileSuccess: () => assert.fail('must not return a successful empty viewer'), toMobileTeam: (value) => value },
    });
    assert.equal((await GET({})).status, 503);
  }
});

test('bootstrap distinguishes a genuinely unset image from a query failure', async () => {
  for (const url of ['https://example.test/avatar.webp', null]) {
    const db = database([{ data: { nickname: '회원', profile_image_url: url, tier: 'iron' }, error: null }]);
    const { GET } = loadSource('../../app/api/mobile/v1/bootstrap/route.ts', {
      '@/lib/data/lck': { getTeams: async () => [] },
      '@/lib/mobile/auth': { getMobileAuth: async () => ({ supabase: db, user: { id: 'member' } }) },
      '@/lib/mobile/api-response': { mobileError: () => assert.fail('healthy query'), mobileSuccess: (value) => value, toMobileTeam: (value) => value },
    });
    const response = await GET({});
    assert.equal(response.viewer.profileImage?.url ?? null, url);
    assert.equal(response.viewer.tier, 'challenger');
  }
});

test('web retries a transient profile error and never treats persistent failure as no avatar', async () => {
  for (const persistent of [false, true]) {
    const db = database([{ data: null, error: { message: 'network' } }, persistent ? { data: null, error: { message: 'network' } } : { data: { nickname: '회원', profile_image_url: 'https://example.test/avatar.webp' }, error: null }]);
    const { getCurrentUser } = loadSource('../../lib/auth/current-user.ts', {
      react: { cache: (fn) => fn },
      '@/lib/auth/verified-user': { getVerifiedAuth: async () => ({ supabase: db, user: { id: 'member' } }) },
    });
    if (persistent) await assert.rejects(getCurrentUser(), /프로필을 불러오지 못했습니다/);
    else assert.equal((await getCurrentUser()).profileImageUrl, 'https://example.test/avatar.webp');
    assert.equal(db.reads, 2);
  }
});
