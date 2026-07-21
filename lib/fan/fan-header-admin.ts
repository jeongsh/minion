import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { fanHeaderImageUrl, kstWeekStart } from "./fan-header";

export type FanHeaderRequest = {
  id: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
  imageUrl: string;
  width: number;
  height: number;
  caption: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
  requesterName: string | null;
  /** 현재 이 팀의 대문으로 적용돼 있는지. */
  isApplied: boolean;
};

/** 어드민 검토 큐. 삭제되지 않은 요청 전체를 최신순으로 본다. */
export async function listFanHeaderRequests(): Promise<FanHeaderRequest[]> {
  const supabase = createSupabaseAdminClient();

  const { data: rows } = await supabase
    .from("fan_header_candidates")
    .select("id, team_id, user_id, image_path, width, height, caption, status, review_note, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!rows?.length) return [];

  // user_id가 auth.users를 참조해 PostgREST 조인이 풀리지 않으므로 따로 모아 붙인다.
  const [{ data: teams }, { data: profiles }, { data: selections }] = await Promise.all([
    supabase.from("teams").select("id, short_name, fan_site_host"),
    supabase.from("profiles").select("id, nickname").in("id", [...new Set(rows.map((row) => row.user_id))]),
    supabase.from("fan_header_selections").select("candidate_id").eq("week_start", kstWeekStart()),
  ]);

  const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
  const nicknameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
  const appliedIds = new Set((selections ?? []).map((selection) => selection.candidate_id));

  return rows.map((row) => {
    const team = teamById.get(row.team_id);
    return {
      id: row.id,
      teamId: row.team_id,
      teamName: team?.short_name ?? "?",
      teamSlug: team?.fan_site_host ?? "",
      imageUrl: fanHeaderImageUrl(row.image_path),
      width: row.width,
      height: row.height,
      caption: row.caption,
      status: row.status as FanHeaderRequest["status"],
      reviewNote: row.review_note,
      createdAt: row.created_at,
      requesterName: nicknameById.get(row.user_id) ?? null,
      isApplied: appliedIds.has(row.id),
    };
  });
}
