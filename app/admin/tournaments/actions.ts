"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SaveBracketLayoutResult = { ok: true } | { ok: false; error: string };

export type BracketColumnUpdate = {
  stageId: string;
  side: "upper" | "lower";
  matchIds: string[];
};

/**
 * 하나 이상의 (스테이지, 승자조/패자조) 목록 전체를 저장한다. 각 배열의 순서가 곧
 * bracket_order다. 매치를 다른 스테이지로 끌어다 놓은 경우 stage_id도 함께 옮기고,
 * tournament_id는 대상 스테이지가 속한 대회로 맞춰준다(둘이 어긋나지 않도록).
 */
export async function saveBracketColumnsAction(
  segmentKey: string,
  columns: BracketColumnUpdate[],
): Promise<SaveBracketLayoutResult> {
  try {
    const supabase = createSupabaseAdminClient();

    const stageIds = [...new Set(columns.map((column) => column.stageId))];
    const { data: stageRows, error: stageError } = await supabase
      .from("stages")
      .select("id, tournament_id")
      .in("id", stageIds);

    if (stageError) {
      throw stageError;
    }

    const tournamentIdByStage = new Map(
      (stageRows ?? []).map((row) => [row.id, row.tournament_id as string]),
    );

    for (const column of columns) {
      const tournamentId = tournamentIdByStage.get(column.stageId);

      for (const [index, matchId] of column.matchIds.entries()) {
        const { error } = await supabase
          .from("matches")
          .update({
            stage_id: column.stageId,
            tournament_id: tournamentId,
            bracket_side: column.side,
            bracket_order: index,
          })
          .eq("id", matchId);

        if (error) {
          throw error;
        }
      }
    }

    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${segmentKey}`);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "브래킷 배치 저장에 실패했습니다.";
    return { ok: false, error: message };
  }
}
