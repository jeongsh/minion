import { parseGprPage, mapGprTeams } from './gpr.mjs';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const secret = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!secret) return new Response(null, { status: 401 });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  async function api(path, body) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: body ? 'POST' : 'GET', headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const error = await response.json();
      if (error.message === 'AUTOMATION_UNAUTHORIZED') throw new Error('AUTOMATION_UNAUTHORIZED');
      throw new Error(`Database request failed: ${response.status} ${error.code ?? ''}`);
    }
    return response.json();
  }
  try {
    // Authenticate before fetching the relatively large official page.
    await api('rpc/run_developer_predictions', { p_secret: secret });
    const now = new Date();
    const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(now));
    const response = await fetch(`https://lolesports.com/en-US/gpr/${year}/current`, {
      signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'MINION-GPR-Automation/1.0' },
    });
    if (!response.ok) throw new Error(`Official GPR request failed: ${response.status}`);
    const rankings = parseGprPage(await response.text(), now);
    const teams = await api('teams?select=id,slug,name,short_name,source_team_id');
    const mapped = mapGprTeams(rankings, teams);
    const summary = await api('rpc/run_developer_predictions', { p_secret: secret, p_rankings: mapped });
    console.log(JSON.stringify({ officialTeams: rankings.length, mappedTeams: mapped.length, ...summary }));
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    if (error.message === 'AUTOMATION_UNAUTHORIZED') return new Response(null, { status: 401 });
    console.error(error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
