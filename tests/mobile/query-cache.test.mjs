import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => {
    assert.ok(name in dependencies, `Unmocked import: ${name}`);
    return dependencies[name];
  }, process: { env: {} }, Response, Date, AbortController, setTimeout, clearTimeout, queueMicrotask, ...globals });
  return exports;
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const response = data => new Response(JSON.stringify({ data }), { status: 200 });

function client(overrides = {}) {
  const disk = new Map();
  const storage = {
    getItem: async key => disk.get(key) ?? null,
    setItem: async (key, value) => { disk.set(key, value); },
    getAllKeys: async () => [...disk.keys()],
    multiRemove: async keys => { keys.forEach(key => disk.delete(key)); },
    ...overrides.storage,
  };
  const api = load('mobile/lib/api-client.ts', {
    '@react-native-async-storage/async-storage': storage,
    'expo-constants': { expoConfig: { hostUri: 'localhost:8081' } },
    '../../packages/contracts/src/mobile-v1': { mobileApiAuthForRequest: () => overrides.auth ?? 'optional' },
    '@/lib/secure-storage': { getInstallationId: async () => 'installation' },
    '@/lib/supabase': { supabase: { auth: { getSession: overrides.getSession ?? (async () => ({ data: { session: null } })) } } },
    '@/lib/query-memory-cache': load('mobile/lib/query-memory-cache.ts'),
  }, { fetch: overrides.fetch ?? (async () => response({ value: 1 })), ...overrides.globals });
  return { api, disk };
}

test('private snapshots are synchronous, account-scoped, and never written to disk', async () => {
  const { api, disk } = client();
  await api.fetchMobileQuery('/posts/1', '/posts/1#viewer=alice', 'memory', false);
  assert.equal(api.readApiMemoryCache('/posts/1#viewer=alice').data.value, 1);
  assert.equal(api.readApiMemoryCache('/posts/1#viewer=bob'), null);
  assert.equal(disk.size, 0);
  api.clearApiMemoryCache();
  assert.equal(api.readApiMemoryCache('/posts/1#viewer=alice'), null);
});

test('concurrent subscribers share a request while explicit refresh bypasses HTTP cache', async () => {
  const gate = deferred();
  const requests = [];
  const { api } = client({ fetch: async (url, options) => {
    requests.push({ url, options }); await gate.promise; return response({ value: requests.length });
  } });
  const first = api.fetchMobileQuery('/posts/1', '/posts/1', 'memory', false);
  const second = api.fetchMobileQuery('/posts/1', '/posts/1', 'memory', false);
  assert.equal(first, second);
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(requests.length, 1);
  await api.fetchMobileQuery('/posts/1', '/posts/1', 'memory', true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.cache, 'no-store');
  assert.match(requests[1].url, /_minion_t=/);
});

test('a pre-mutation request cannot repopulate invalidated memory', async () => {
  const gate = deferred();
  const { api } = client({ fetch: async () => { await gate.promise; return response({ old: true }); } });
  const old = api.fetchMobileQuery('/posts/1', '/posts/1#viewer=alice', 'memory', false);
  let notified = false;
  api.subscribeApiCacheInvalidation(() => { notified = true; });
  const invalidation = api.invalidateApiCache('/posts');
  assert.equal(notified, true);
  gate.resolve();
  await Promise.all([old, invalidation]);
  assert.equal(api.readApiMemoryCache('/posts/1#viewer=alice'), null);
});

test('an account change prevents pending private responses from being cached', async () => {
  const gate = deferred();
  const { api } = client({ fetch: async () => { await gate.promise; return response({ account: 'alice' }); } });
  const old = api.fetchMobileQuery('/predictions', '/predictions#viewer=alice', 'memory', false);
  api.clearApiMemoryCache();
  gate.resolve(); await old;
  assert.equal(api.readApiMemoryCache('/predictions#viewer=alice'), null);
});

test('a slower initial response cannot overwrite a completed explicit refresh', async () => {
  const old = deferred();
  const fresh = deferred();
  const { api } = client({ fetch: url => url.includes('_minion_t=') ? fresh.promise : old.promise });
  const first = api.fetchMobileQuery('/predictions', '/predictions', 'memory', false);
  const refresh = api.fetchMobileQuery('/predictions', '/predictions', 'memory', true);
  assert.equal(api.fetchMobileQuery('/predictions', '/predictions', 'memory', false), refresh);
  fresh.resolve(response('new')); await refresh;
  old.resolve(response('old')); await first;
  assert.equal(api.readApiMemoryCache('/predictions').data, 'new');
});

test('a slow disk read returns the newer network snapshot instead of overwriting it', async () => {
  const gate = deferred();
  const { api } = client({ storage: { getItem: () => gate.promise } });
  const diskRead = api.readApiCache('/schedule');
  await api.fetchMobileQuery('/schedule', '/schedule', true, false);
  gate.resolve(JSON.stringify({ data: { value: 0 }, savedAt: Date.now() - 1000 }));
  assert.equal((await diskRead).data.value, 1);
  assert.equal(api.readApiMemoryCache('/schedule').data.value, 1);
});

test('storage failures do not reject successfully fetched data', async () => {
  const { api } = client({ storage: {
    getItem: async () => { throw new Error('storage unavailable'); },
    setItem: async () => { throw new Error('storage full'); },
  } });
  assert.equal(await api.readApiCache('/schedule'), null);
  assert.equal((await api.fetchMobileQuery('/schedule', '/schedule', true, false)).value, 1);
  await api.writeApiCache('/schedule', { value: 2 });
  assert.equal(api.readApiMemoryCache('/schedule').data.value, 2);
});

test('disk invalidation does not let a concurrent reader resurrect old content', async () => {
  const gate = deferred();
  const { api } = client({ storage: {
    getAllKeys: () => gate.promise,
    getItem: async () => JSON.stringify({ data: 'old', savedAt: Date.now() }),
  } });
  const invalidation = api.invalidateApiCache('/posts');
  assert.equal(await api.readApiCache('/posts/1'), null);
  gate.resolve([]); await invalidation;
});

test('failed requests are evicted so retry can succeed and expose HTTP status', async () => {
  let calls = 0;
  const { api } = client({ fetch: async () => ++calls === 1
    ? new Response(JSON.stringify({ error: { message: 'missing' } }), { status: 404 }) : response('ok') });
  await assert.rejects(api.fetchMobileQuery('/posts/1', '/posts/1', 'memory', false), error => error.status === 404);
  assert.equal(await api.fetchMobileQuery('/posts/1', '/posts/1', 'memory', false), 'ok');
});

test('a stalled connection times out and does not trap subsequent retries', async () => {
  let expire;
  let calls = 0;
  const { api } = client({
    fetch: () => ++calls === 1 ? new Promise(() => {}) : Promise.resolve(response('retried')),
    globals: { setTimeout: (callback, ms) => { assert.equal(ms, 20_000); expire = callback; return 1; }, clearTimeout: () => {} },
  });
  const stalled = api.fetchMobileQuery('/posts/1', '/posts/1', 'memory', false);
  const rejected = assert.rejects(stalled, /연결이 지연/);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expire(); await rejected;
  assert.equal(await api.fetchMobileQuery('/posts/1', '/posts/1', 'memory', false), 'retried');
});

test('memory snapshots expire and the entry count stays bounded', () => {
  const { createQueryMemoryCache } = load('mobile/lib/query-memory-cache.ts');
  const cache = createQueryMemoryCache(2, 1000);
  cache.write('expired', 0, Date.now() - 2000);
  assert.equal(cache.read('expired'), null);
  for (const key of ['a', 'b', 'c']) cache.write(key, key);
  assert.equal(cache.read('a'), null);
  assert.equal(cache.read('b').data, 'b');
  assert.equal(cache.read('c').data, 'c');
});

test('concurrent authenticated requests share only the pending session read', async () => {
  const gate = deferred();
  const headers = [];
  let reads = 0;
  const { api } = client({
    getSession: () => ++reads === 1 ? gate.promise : Promise.resolve({ data: { session: { access_token: 'new-token' } } }),
    fetch: async (_url, options) => { headers.push(options.headers.Authorization); return response('ok'); },
  });
  const requests = Array.from({ length: 6 }, (_, index) => api.fetchMobileApi(`/private/${index}`));
  await Promise.resolve();
  assert.equal(reads, 1);
  gate.resolve({ data: { session: { access_token: 'first-token' } } });
  await Promise.all(requests);
  assert.deepEqual(headers, Array(6).fill('Bearer first-token'));
  await api.fetchMobileApi('/private/next');
  assert.equal(reads, 2);
  assert.equal(headers.at(-1), 'Bearer new-token');
});

test('an auth event during a pending session read cannot send the previous token', async () => {
  const old = deferred();
  let reads = 0;
  const headers = [];
  const { api } = client({
    getSession: () => ++reads === 1 ? old.promise : Promise.resolve({ data: { session: { access_token: 'changed-account' } } }),
    fetch: async (_url, options) => { headers.push(options.headers.Authorization); return response('ok'); },
  });
  const request = api.fetchMobileApi('/private/1');
  api.resetApiSessionRead();
  old.resolve({ data: { session: { access_token: 'old-account' } } });
  await request;
  assert.equal(reads, 2);
  assert.deepEqual(headers, ['Bearer changed-account']);
});

test('fresh public lists avoid repeat HTTP but explicit refresh and invalidation still fetch', async () => {
  let calls = 0;
  const { api } = client({ auth: 'public', fetch: async () => response(++calls) });
  const query = (fresh = false) => api.fetchMobileQuery('/players', '/players', true, fresh, { staleTimeMs: 30_000 });
  assert.equal(await query(), 1);
  assert.equal(await query(), 1);
  assert.equal(calls, 1);
  assert.equal(await query(true), 2);
  await api.invalidateApiCache('/players');
  assert.equal(await query(), 3);
});

test('personal responses do not inherit the public freshness allowance', async () => {
  let calls = 0;
  const { api } = client({ fetch: async () => response(++calls) });
  await api.fetchMobileQuery('/personal', '/personal#viewer=a', 'memory', false, { staleTimeMs: 30_000 });
  assert.equal(await api.fetchMobileQuery('/personal', '/personal#viewer=a', 'memory', false, { staleTimeMs: 30_000 }), 2);
});

test('obsolete search cancels only when all subscribers leave and can be retried', async () => {
  const first = new AbortController();
  const second = new AbortController();
  const requests = [];
  const { api } = client({ fetch: async (_url, { signal }) => {
    requests.push(signal);
    return requests.length === 1 ? new Promise(() => {}) : response('retry');
  } });
  const request = api.fetchMobileQuery('/search?q=a', '/search?q=a', true, false, { signal: first.signal, cancelOnUnused: true });
  const shared = api.fetchMobileQuery('/search?q=a', '/search?q=a', true, false, { signal: second.signal, cancelOnUnused: true });
  assert.equal(request, shared);
  await new Promise(resolve => setImmediate(resolve));
  first.abort();
  assert.equal(requests[0].aborted, false);
  const rejected = assert.rejects(request, error => error.name === 'AbortError');
  second.abort();
  await rejected;
  assert.equal(requests[0].aborted, true);
  assert.equal(await api.fetchMobileQuery('/search?q=a', '/search?q=a', true, false), 'retry');
});

test('detail navigation retains its request after leaving for fast back navigation', async () => {
  const gate = deferred();
  const subscriber = new AbortController();
  let requestSignal;
  const { api } = client({ fetch: async (_url, { signal }) => { requestSignal = signal; await gate.promise; return response('detail'); } });
  const request = api.fetchMobileQuery('/detail/1', '/detail/1', 'memory', false, { signal: subscriber.signal });
  await new Promise(resolve => setImmediate(resolve));
  subscriber.abort();
  assert.equal(requestSignal.aborted, false);
  gate.resolve();
  await request;
  assert.equal(api.readApiMemoryCache('/detail/1').data, 'detail');
});

test('expired disk snapshots cannot outlive the memory cache retention limit', async () => {
  const { api } = client({ storage: { getItem: async () => JSON.stringify({ data: 'old', savedAt: Date.now() - 11 * 60_000 }) } });
  assert.equal(await api.readApiCache('/players'), null);
});

test('forced refresh is consumed once and never follows a changed query or account', async () => {
  const { createQueryRefreshIntent } = load('mobile/lib/query-refresh-intent.ts');
  const intent = createQueryRefreshIntent('/a#viewer=alice');
  intent.request();
  assert.equal(intent.start('/b#viewer=alice').fresh, false);
  assert.equal(intent.start('/a#viewer=bob').fresh, false);
  const forced = intent.start('/a#viewer=alice');
  assert.equal(forced.fresh, true);
  forced.finish();
  assert.equal(intent.start('/a#viewer=alice').fresh, false, 'refocusing must resume normal cache behavior');
  intent.setKey('/b#viewer=alice');
  intent.request();
  assert.equal(intent.start('/b#viewer=alice').fresh, true, 'new refresh targets the latest committed path');
});

test('a refresh requested while disabled waits for an enabled request to finish', () => {
  const { createQueryRefreshIntent } = load('mobile/lib/query-refresh-intent.ts');
  const intent = createQueryRefreshIntent('/players');
  intent.request();
  // A disabled hook does not start a request. Moving through a different path
  // while disabled must not consume or transfer the pending refresh.
  intent.setKey('/champions');
  intent.start('/champions').finish();
  intent.setKey('/players');
  const enabledRequest = intent.start('/players');
  assert.equal(enabledRequest.fresh, true);
  enabledRequest.finish();
  assert.equal(intent.start('/players').fresh, false);
});

test('an older result cannot consume a newer invalidation intent', () => {
  const { createQueryRefreshIntent } = load('mobile/lib/query-refresh-intent.ts');
  const intent = createQueryRefreshIntent('/players');
  const normal = intent.start('/players');
  intent.request();
  const first = intent.start('/players');
  intent.request();
  normal.finish();
  first.finish();
  assert.equal(intent.start('/players').fresh, true);
  intent.start('/players').finish();
  assert.equal(intent.start('/players').fresh, false);
});

test('StrictMode effect replacement shares the forced request and then restores public cache reuse', async () => {
  const { createQueryRefreshIntent } = load('mobile/lib/query-refresh-intent.ts');
  const intent = createQueryRefreshIntent('/players');
  const calls = [];
  const gate = deferred();
  const { api } = client({ auth: 'public', fetch: async (url, { signal }) => {
    calls.push({ url, signal });
    await gate.promise;
    return response('fresh');
  } });
  await api.writeApiCache('/players', 'cached');
  intent.request();
  const first = intent.start('/players');
  const controller = new AbortController();
  const cancelled = api.fetchMobileQuery('/players', '/players', true, first.fresh, { signal: controller.signal, cancelOnUnused: true, staleTimeMs: 30_000 });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  // Effect replay starts synchronously, before the cancelled promise settles.
  const replay = intent.start('/players');
  assert.equal(replay.fresh, true);
  const next = api.fetchMobileQuery('/players', '/players', true, replay.fresh, { staleTimeMs: 30_000 });
  assert.equal(cancelled, next);
  gate.resolve();
  first.finish(true);
  assert.equal(await next, 'fresh');
  replay.finish();
  assert.equal(calls.length, 1);
  assert.ok(calls.every(call => call.url.includes('_minion_t=')));
  const refocus = intent.start('/players');
  assert.equal(refocus.fresh, false);
  assert.equal(await api.fetchMobileQuery('/players', '/players', true, refocus.fresh, { staleTimeMs: 30_000 }), 'fresh');
  assert.equal(calls.length, 1, 'a later focus must not bypass the fresh public snapshot');
});
