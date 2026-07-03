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

/**
 * 이 매치의 승자가 진출하는 다음 매치를 지정한다(공개 대진표 페이지의 연결선에 사용).
 * 자기 자신은 다음 매치로 지정할 수 없다.
 */
export async function setMatchAdvancesToAction(
  segmentKey: string,
  matchId: string,
  advancesToMatchId: string | null,
): Promise<SaveBracketLayoutResult> {
  try {
    if (advancesToMatchId === matchId) {
      throw new Error("같은 매치를 다음 매치로 지정할 수 없습니다.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("matches")
      .update({ advances_to_match_id: advancesToMatchId })
      .eq("id", matchId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${segmentKey}`);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "다음 매치 지정에 실패했습니다.";
    return { ok: false, error: message };
  }
}

/**
 * 새 라운드(스테이지)를 만든다. afterStageId가 지정되면 그 라운드 바로 뒤에, 비어있으면
 * 맨 앞에 끼워 넣는다. 기존 라운드들의 상대적인 순서는 그대로 유지한 채 orderIndex를
 * 0부터 다시 순서대로 매긴다.
 */
export async function createStageAction(formData: FormData): Promise<void> {
  const segmentKey = String(formData.get("segmentKey") ?? "");
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const afterStageId = String(formData.get("afterStageId") ?? "");

  if (!tournamentId || !name) {
    throw new Error("라운드 이름을 입력해주세요.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingStages, error: fetchError } = await supabase
    .from("stages")
    .select("id, order_index")
    .eq("tournament_id", tournamentId)
    .order("order_index", { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  const orderedIds = (existingStages ?? []).map((stage) => stage.id);
  const insertAt = afterStageId ? orderedIds.indexOf(afterStageId) + 1 : 0;

  const { data: inserted, error: insertError } = await supabase
    .from("stages")
    .insert({ tournament_id: tournamentId, name, order_index: insertAt })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  orderedIds.splice(insertAt, 0, inserted.id);
  await renumberStages(supabase, orderedIds);

  revalidatePath("/admin/tournaments");
  if (segmentKey) {
    revalidatePath(`/tournaments/${segmentKey}`);
  }
}

async function renumberStages(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderedIds: string[],
): Promise<void> {
  for (const [index, stageId] of orderedIds.entries()) {
    const { error } = await supabase.from("stages").update({ order_index: index }).eq("id", stageId);

    if (error) {
      throw error;
    }
  }
}

/**
 * 라운드(스테이지) 자체의 위치를 한 칸 앞/뒤로 옮긴다. 다른 라운드들의 상대 순서는
 * 그대로 유지된 채 orderIndex가 0부터 다시 매겨진다.
 */
export async function moveStageAction(
  segmentKey: string,
  tournamentId: string,
  stageId: string,
  direction: "left" | "right",
): Promise<SaveBracketLayoutResult> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data: existingStages, error: fetchError } = await supabase
      .from("stages")
      .select("id, order_index")
      .eq("tournament_id", tournamentId)
      .order("order_index", { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    const orderedIds = (existingStages ?? []).map((stage) => stage.id);
    const currentIndex = orderedIds.indexOf(stageId);

    if (currentIndex === -1) {
      throw new Error("라운드를 찾을 수 없습니다.");
    }

    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= orderedIds.length) {
      return { ok: true };
    }

    [orderedIds[currentIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[currentIndex]];

    await renumberStages(supabase, orderedIds);

    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${segmentKey}`);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "라운드 순서 변경에 실패했습니다.";
    return { ok: false, error: message };
  }
}

/**
 * 라운드(스테이지)를 삭제한다. 매치가 하나라도 남아있으면 거부한다 — stages.matches
 * FK가 ON DELETE SET NULL이라, 확인 없이 지우면 매치가 어느 라운드에도 속하지 않은
 * 채로 조용히 남아 대진표에서 사라져 버릴 수 있다.
 */
export async function deleteStageAction(segmentKey: string, stageId: string): Promise<SaveBracketLayoutResult> {
  try {
    const supabase = createSupabaseAdminClient();

    const { count, error: countError } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", stageId);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) > 0) {
      throw new Error("이 라운드에 매치가 남아 있어 삭제할 수 없습니다. 먼저 다른 라운드로 매치를 옮겨주세요.");
    }

    const { error } = await supabase.from("stages").delete().eq("id", stageId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${segmentKey}`);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "라운드 삭제에 실패했습니다.";
    return { ok: false, error: message };
  }
}
