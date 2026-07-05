import { createClient } from "@supabase/supabase-js";

import { syncLeaguepediaTimelineForSet } from "../lib/sync/leaguepedia-timeline.ts";

const matchRef = process.argv.find((arg) => arg.startsWith("--match="))?.slice("--match=".length);
if (!matchRef) throw new Error("--match=<leaguepedia_match_id> is required");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are required");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: match, error: matchError } = await supabase
  .from("matches")
  .select("id")
  .eq("leaguepedia_match_id", matchRef)
  .single();
if (matchError) throw matchError;

const { data: sets, error: setsError } = await supabase
  .from("sets")
  .select("id, set_number")
  .eq("match_id", match.id)
  .order("set_number");
if (setsError) throw setsError;

const results = [];
for (const set of sets ?? []) {
  const result = await syncLeaguepediaTimelineForSet(supabase, set.id);
  results.push({ setNumber: set.set_number, status: result.status, reason: result.reason });
}

console.log(JSON.stringify({ matchRef, results }, null, 2));
