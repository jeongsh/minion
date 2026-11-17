import "server-only";

import { unstable_cache } from "next/cache";
import { isAdminUser } from "@/lib/auth/admin";
import { canQuerySupabase, createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type HomeRatingReview = {
  id: string;
  href: string;
  matchLabel: string;
  playerName: string;
  review: string;
};

type ReviewRow = {
  id: string;
  match_id: string;
  set_id: string;
  author_id: string | null;
  rating: number;
  review: string;
  created_at: string;
  players: { name: string } | null;
  fan_rating_reactions: { count: number }[];
};

export const getHomeRatingReviews = unstable_cache(async (): Promise<HomeRatingReview[]> => {
  if (!canQuerySupabase()) return [];
  const client = createSupabaseServerClient();
  const { data: matches, error: matchError } = await client.from("matches")
    .select("id, team_a_id, team_b_id")
    .in("status", ["live", "completed"])
    .order("match_date", { ascending: false })
    .order("id")
    .limit(12);
  if (matchError) throw matchError;
  if (!matches?.length) return [];

  const teamIds = [...new Set(matches.flatMap(match => [match.team_a_id, match.team_b_id]))];
  const teamResult = await client.from("teams").select("id, short_name").in("id", teamIds);
  if (teamResult.error) throw teamResult.error;
  const rows: ReviewRow[] = [];
  const adminChecks = new Map<string, boolean>();
  const snapshot = new Date().toISOString();
  for (const match of matches) {
    let after: { created_at: string; id: string } | null = null;
    while (rows.length < 12) {
      let query = client.from("fan_ratings")
        .select("id, match_id, set_id, author_id, rating, review, created_at, players(name), fan_rating_reactions(count)")
        .eq("match_id", match.id).is("blinded_at", null).not("review", "is", null).neq("review", "")
        .eq("fan_rating_reactions.kind", "honor").lte("created_at", snapshot)
        .order("created_at", { ascending: false }).order("id").limit(25);
      if (after) query = query.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},id.gt.${after.id})`);
      const { data, error } = await query;
      if (error) throw error;
      const page = (data ?? []) as unknown as ReviewRow[];
      if (!page.length) break;
      for (const row of page) {
        if (!row.review.trim() || !row.players) continue;
        let approved = Number(row.rating) >= 6 && (row.fan_rating_reactions[0]?.count ?? 0) >= 5;
        if (!approved && row.author_id) {
          if (!adminChecks.has(row.author_id)) {
            const result = await createSupabaseAdminClient().auth.admin.getUserById(row.author_id);
            if (result.error && result.error.status !== 404) throw result.error;
            adminChecks.set(row.author_id, Boolean(result.data.user && isAdminUser(result.data.user)));
          }
          approved = adminChecks.get(row.author_id)!;
        }
        if (approved) rows.push(row);
        if (rows.length === 12) break;
      }
      after = page.at(-1)!;
    }
    if (rows.length === 12) break;
  }
  const teams = new Map(teamResult.data?.map(team => [team.id, team.short_name]));
  const labels = new Map(matches.map(match => [match.id,
    `${teams.get(match.team_a_id) ?? "TBD"} vs ${teams.get(match.team_b_id) ?? "TBD"}`]));

  return rows
    .map(row => ({
      id: row.id,
      href: `/matches/${encodeURIComponent(row.match_id)}?tab=rating&set=${encodeURIComponent(row.set_id)}`,
      matchLabel: labels.get(row.match_id)!,
      playerName: row.players!.name,
      review: row.review.trim(),
    }));
}, ["home-rating-reviews"], { revalidate: 30 });
