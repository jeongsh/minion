import "server-only";

import { unstable_cache } from "next/cache";
import { isAdminUser } from "@/lib/auth/admin";
import { collectCountedKeysetPages, mapWithConcurrency } from "@/lib/data/paged-read";
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
    .eq("status", "completed")
    .order("match_date", { ascending: false })
    .order("id")
    .limit(12);
  if (matchError) throw matchError;
  if (!matches?.length) return [];

  const teamIds = [...new Set(matches.flatMap(match => [match.team_a_id, match.team_b_id]))];
  const [rows, teamResult] = await Promise.all([
    collectCountedKeysetPages<ReviewRow>(async afterId => {
      let query = client.from("fan_ratings")
        .select("id, match_id, set_id, author_id, rating, review, created_at, players(name), fan_rating_reactions(count)", { count: "exact" })
        .in("match_id", matches.map(match => match.id))
        .is("blinded_at", null)
        .not("review", "is", null)
        .neq("review", "")
        .eq("fan_rating_reactions.kind", "honor")
        .order("id")
        .limit(200);
      if (afterId) query = query.gt("id", afterId);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data as unknown as ReviewRow[], count };
    }),
    client.from("teams").select("id, short_name").in("id", teamIds),
  ]);
  if (teamResult.error) throw teamResult.error;

  const hasCommunityApproval = (row: ReviewRow) => Number(row.rating) >= 6
    && (row.fan_rating_reactions[0]?.count ?? 0) >= 5;
  // 관리자 여부는 변경 가능한 프로필이 아니라 기존 서버 권한 판별을 공유한다.
  const authorIds = [...new Set(rows.filter(row => !hasCommunityApproval(row))
    .flatMap(row => row.author_id ? [row.author_id] : []))];
  const admin = authorIds.length ? createSupabaseAdminClient() : null;
  const adminIds = new Set(await mapWithConcurrency(authorIds, 4, async id => {
    const { data, error } = await admin!.auth.admin.getUserById(id);
    if (error) {
      if (error.status === 404) return null;
      throw error;
    }
    return data.user && isAdminUser(data.user) ? id : null;
  }));
  const teams = new Map(teamResult.data?.map(team => [team.id, team.short_name]));
  const matchOrder = new Map(matches.map((match, index) => [match.id, index]));
  const labels = new Map(matches.map(match => [match.id,
    `${teams.get(match.team_a_id) ?? "TBD"} vs ${teams.get(match.team_b_id) ?? "TBD"}`]));

  return rows.filter(row => row.review.trim() && row.players
    && (hasCommunityApproval(row) || (row.author_id !== null && adminIds.has(row.author_id))))
    .sort((a, b) => (matchOrder.get(a.match_id)! - matchOrder.get(b.match_id)!)
      || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
    .slice(0, 12)
    .map(row => ({
      id: row.id,
      href: `/matches/${encodeURIComponent(row.match_id)}?tab=rating&set=${encodeURIComponent(row.set_id)}`,
      matchLabel: labels.get(row.match_id)!,
      playerName: row.players!.name,
      review: row.review.trim(),
    }));
}, ["home-rating-reviews"], { revalidate: 30 });
