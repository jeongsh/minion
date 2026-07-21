"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminActionClient, createSupabaseAdminClient } from "@/lib/auth/admin";

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
    const supabase = await createSupabaseAdminActionClient();

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

    const supabase = await createSupabaseAdminActionClient();
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
 * 이 매치가 속한 그룹(같은 라운드 안에서 독립적으로 진행되는 승자조/패자조 묶음)을 지정한다.
 * 예: 한 라운드 안에 그룹 A/B가 각각 자체 브래킷을 진행하는 경우 구분하는 데 쓴다.
 * 기본값 0이면 그룹 구분 없이 지금처럼 하나로 보인다.
 */
export async function setMatchGroupIndexAction(
  segmentKey: string,
  matchId: string,
  groupIndex: number,
): Promise<SaveBracketLayoutResult> {
  try {
    if (!Number.isInteger(groupIndex) || groupIndex < 0) {
      throw new Error("그룹 번호는 0 이상의 정수여야 합니다.");
    }

    const supabase = await createSupabaseAdminActionClient();
    const { error } = await supabase.from("matches").update({ group_index: groupIndex }).eq("id", matchId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${segmentKey}`);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "그룹 지정에 실패했습니다.";
    return { ok: false, error: message };
  }
}

/**
 * 새 라운드(스테이지)를 만든다. afterStageId가 지정되면 그 라운드 바로 뒤에, 비어있으면
 * 맨 앞에 끼워 넣는다. 같은 브래킷 스테이지 안의 기존 라운드들의 상대적인 순서는 그대로
 * 유지한 채 orderIndex를 0부터 다시 순서대로 매긴다.
 */
export async function createStageAction(formData: FormData): Promise<void> {
  const segmentKey = String(formData.get("segmentKey") ?? "");
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const bracketStageId = String(formData.get("bracketStageId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const afterStageId = String(formData.get("afterStageId") ?? "");

  if (!tournamentId || !bracketStageId || !name) {
    throw new Error("라운드 이름을 입력해주세요.");
  }

  const supabase = await createSupabaseAdminActionClient();
  const { data: existingStages, error: fetchError } = await supabase
    .from("stages")
    .select("id, order_index")
    .eq("bracket_stage_id", bracketStageId)
    .order("order_index", { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  const orderedIds = (existingStages ?? []).map((stage) => stage.id);
  const insertAt = afterStageId ? orderedIds.indexOf(afterStageId) + 1 : 0;

  const { data: inserted, error: insertError } = await supabase
    .from("stages")
    .insert({ tournament_id: tournamentId, bracket_stage_id: bracketStageId, name, order_index: insertAt })
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

/**
 * 라운드(스테이지)의 이름을 바꾼다(공개 대진표 페이지의 컬럼 헤더에도 그대로 반영됨).
 */
export async function renameStageAction(
  segmentKey: string,
  stageId: string,
  name: string,
): Promise<SaveBracketLayoutResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("라운드 이름을 입력해주세요.");
    }

    const supabase = await createSupabaseAdminActionClient();
    const { error } = await supabase.from("stages").update({ name: trimmed }).eq("id", stageId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    if (segmentKey) {
      revalidatePath(`/tournaments/${segmentKey}`);
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "라운드 이름 변경에 실패했습니다.";
    return { ok: false, error: message };
  }
}

/**
 * 새 브래킷 스테이지(예: 플레이-인 / 토너먼트 스테이지)를 만든다. 같은 대회의 기존
 * 브래킷 스테이지들 뒤에 순서대로 추가된다.
 */
export async function createBracketStageAction(formData: FormData): Promise<void> {
  const segmentKey = String(formData.get("segmentKey") ?? "");
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!tournamentId || !name) {
    throw new Error("브래킷 스테이지 이름을 입력해주세요.");
  }

  const supabase = await createSupabaseAdminActionClient();
  const { count, error: countError } = await supabase
    .from("bracket_stages")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  if (countError) {
    throw countError;
  }

  const { error: insertError } = await supabase
    .from("bracket_stages")
    .insert({ tournament_id: tournamentId, name, order_index: count ?? 0 });

  if (insertError) {
    throw insertError;
  }

  revalidatePath("/admin/tournaments");
  if (segmentKey) {
    revalidatePath(`/tournaments/${segmentKey}`);
  }
}

/**
 * 브래킷 스테이지의 제목을 바꾼다(공개 대진표 탭에도 그대로 반영됨).
 */
export async function renameBracketStageAction(
  segmentKey: string,
  bracketStageId: string,
  name: string,
): Promise<SaveBracketLayoutResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("브래킷 스테이지 이름을 입력해주세요.");
    }

    const supabase = await createSupabaseAdminActionClient();
    const { error } = await supabase
      .from("bracket_stages")
      .update({ name: trimmed })
      .eq("id", bracketStageId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    if (segmentKey) {
      revalidatePath(`/tournaments/${segmentKey}`);
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "브래킷 스테이지 이름 변경에 실패했습니다.";
    return { ok: false, error: message };
  }
}

/**
 * 브래킷 스테이지의 공개 페이지 표시 방식을 바꾼다("bracket"=대진표, "standings"=
 * LCK 정규시즌처럼 승-패 순위표). 조별 라운드로빈으로 진행되는 스테이지(예: 케스파컵
 * 그룹 스테이지)를 순위표로 보여주고 싶을 때 어드민에서 직접 전환한다.
 */
export async function setBracketStageDisplayModeAction(
  segmentKey: string,
  bracketStageId: string,
  displayMode: "bracket" | "standings",
): Promise<SaveBracketLayoutResult> {
  try {
    const supabase = await createSupabaseAdminActionClient();
    const { error } = await supabase
      .from("bracket_stages")
      .update({ display_mode: displayMode })
      .eq("id", bracketStageId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    if (segmentKey) {
      revalidatePath(`/tournaments/${segmentKey}`);
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "표시 방식 변경에 실패했습니다.";
    return { ok: false, error: message };
  }
}

/**
 * 브래킷 스테이지를 삭제한다. 안에 라운드가 남아있으면 거부한다(라운드를 먼저 다른
 * 브래킷 스테이지로 옮기거나 삭제해야 함).
 */
export async function deleteBracketStageAction(
  segmentKey: string,
  bracketStageId: string,
): Promise<SaveBracketLayoutResult> {
  try {
    const supabase = await createSupabaseAdminActionClient();

    const { count, error: countError } = await supabase
      .from("stages")
      .select("id", { count: "exact", head: true })
      .eq("bracket_stage_id", bracketStageId);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) > 0) {
      throw new Error("이 브래킷 스테이지에 라운드가 남아 있어 삭제할 수 없습니다.");
    }

    const { error } = await supabase.from("bracket_stages").delete().eq("id", bracketStageId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    if (segmentKey) {
      revalidatePath(`/tournaments/${segmentKey}`);
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "브래킷 스테이지 삭제에 실패했습니다.";
    return { ok: false, error: message };
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
 * 라운드(스테이지) 자체의 위치를 한 칸 앞/뒤로 옮긴다. 같은 브래킷 스테이지 안의 다른
 * 라운드들의 상대 순서는 그대로 유지된 채 orderIndex가 0부터 다시 매겨진다.
 */
export async function moveStageAction(
  segmentKey: string,
  bracketStageId: string,
  stageId: string,
  direction: "left" | "right",
): Promise<SaveBracketLayoutResult> {
  try {
    const supabase = await createSupabaseAdminActionClient();
    const { data: existingStages, error: fetchError } = await supabase
      .from("stages")
      .select("id, order_index")
      .eq("bracket_stage_id", bracketStageId)
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
 * 라운드(스테이지)를 다른 브래킷 스테이지로 옮긴다. 삭제 없이 바로 이동할 수 있게 해서,
 * 라운드를 잘못된 브래킷 스테이지에 만들었거나 나중에 재구성이 필요할 때 쓴다. 옮겨간
 * 곳에서는 맨 뒤 순서로 붙는다.
 */
export async function moveStageToBracketStageAction(
  segmentKey: string,
  stageId: string,
  targetBracketStageId: string,
): Promise<SaveBracketLayoutResult> {
  try {
    const supabase = await createSupabaseAdminActionClient();

    const { count, error: countError } = await supabase
      .from("stages")
      .select("id", { count: "exact", head: true })
      .eq("bracket_stage_id", targetBracketStageId);

    if (countError) {
      throw countError;
    }

    const { error } = await supabase
      .from("stages")
      .update({ bracket_stage_id: targetBracketStageId, order_index: count ?? 0 })
      .eq("id", stageId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${segmentKey}`);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "브래킷 스테이지 이동에 실패했습니다.";
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
    const supabase = await createSupabaseAdminActionClient();

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

/**
 * 매치를 삭제한다. 세트/팬 평점/POM 투표 등 연결된 데이터는 ON DELETE CASCADE로
 * 함께 삭제되므로, 확인 다이얼로그는 호출하는 쪽(클라이언트)에서 반드시 거쳐야 한다.
 */
export async function deleteMatchAction(segmentKey: string, matchId: string): Promise<SaveBracketLayoutResult> {
  try {
    const supabase = await createSupabaseAdminActionClient();
    const { error } = await supabase.from("matches").delete().eq("id", matchId);

    if (error) {
      throw error;
    }

    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${segmentKey}`);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "매치 삭제에 실패했습니다.";
    return { ok: false, error: message };
  }
}

