"use client";

import { useEffect, useRef, useState } from "react";

import {
  deleteMatchAction,
  deleteStageAction,
  moveStageAction,
  moveStageToBracketStageAction,
  saveBracketColumnsAction,
  setMatchAdvancesToAction,
  setMatchGroupIndexAction,
  type BracketColumnUpdate,
} from "./actions";

export type EditorMatch = {
  id: string;
  matchDate: string;
  bestOf: number | null;
  teamAName: string;
  teamBName: string;
  teamAScore: number | null;
  teamBScore: number | null;
  advancesToMatchId: string | null;
  groupIndex: number;
};

export type EditorStage = {
  id: string;
  name: string;
};

export type EditorBracketStage = {
  id: string;
  name: string;
};

export type MatchOptionGroup = {
  stageId: string;
  stageName: string;
  matches: Array<{ id: string; label: string }>;
};

type BracketSide = "upper" | "lower";
type StageBoard = { upper: EditorMatch[]; lower: EditorMatch[] };
type Board = Record<string, StageBoard>;

const EMPTY_STAGE_BOARD: StageBoard = { upper: [], lower: [] };

function stageBoardOf(board: Board, stageId: string): StageBoard {
  return board[stageId] ?? EMPTY_STAGE_BOARD;
}

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function Card({
  match,
  matchOptions,
  isDragging,
  isFirst,
  isLast,
  onDragStartCard,
  onDragEndCard,
  onDropBefore,
  onMoveToOtherSide,
  onMoveUp,
  onMoveDown,
  onSetAdvancesTo,
  onSetGroupIndex,
  onDeleteMatch,
}: {
  match: EditorMatch;
  matchOptions: MatchOptionGroup[];
  isDragging: boolean;
  isFirst: boolean;
  isLast: boolean;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onDropBefore: (id: string) => void;
  onMoveToOtherSide: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onSetAdvancesTo: (matchId: string, advancesToMatchId: string | null) => void;
  onSetGroupIndex: (matchId: string, groupIndex: number) => void;
  onDeleteMatch: (matchId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStartCard(match.id)}
      onDragEnd={onDragEndCard}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropBefore(match.id);
      }}
      className={`cursor-grab rounded-md border border-white/10 bg-white/[0.04] p-2 active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
        <span className="truncate">{formatMatchDate(match.matchDate)}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {match.bestOf ? <span>Bo{match.bestOf}</span> : null}
          <button
            type="button"
            onClick={() => onDeleteMatch(match.id)}
            className="rounded border border-white/10 px-1.5 py-0.5 text-red-400/70 hover:border-red-400/40 hover:text-red-400"
            aria-label="이 경기 삭제"
          >
            삭제
          </button>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white/80">
        <span className="truncate">{match.teamAName}</span>
        <span className="shrink-0 tabular-nums text-white/50">
          {match.teamAScore ?? "-"}:{match.teamBScore ?? "-"}
        </span>
        <span className="truncate text-right">{match.teamBName}</span>
      </div>
      <div className="mt-1.5 flex gap-1">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onMoveUp(match.id)}
          className="rounded border border-white/10 px-2 py-1 text-[10px] font-bold text-white/60 hover:border-white/30 hover:text-white disabled:opacity-20"
          aria-label="이 경기를 위로 이동"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => onMoveDown(match.id)}
          className="rounded border border-white/10 px-2 py-1 text-[10px] font-bold text-white/60 hover:border-white/30 hover:text-white disabled:opacity-20"
          aria-label="이 경기를 아래로 이동"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onMoveToOtherSide(match.id)}
          className="flex-1 rounded border border-white/10 py-1 text-[10px] font-bold text-white/50 hover:border-white/30 hover:text-white"
        >
          승자조 ↔ 패자조
        </button>
      </div>
      <select
        value={match.advancesToMatchId ?? ""}
        onChange={(event) => onSetAdvancesTo(match.id, event.target.value || null)}
        className="mt-1.5 w-full rounded border border-white/10 bg-[#0a0e1a] px-1 py-1 text-[10px] font-semibold text-white/70"
      >
        <option value="">다음 경기 지정 안 함</option>
        {matchOptions.map((group) => {
          const options = group.matches.filter((option) => option.id !== match.id);
          if (options.length === 0) return null;

          return (
            <optgroup key={group.stageId} label={group.stageName}>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-white/40" title="같은 라운드 안에서 독립적으로 진행되는 그룹(예: 그룹 A/B)을 구분한다. 기본 0">
          그룹
        </span>
        <input
          type="number"
          min={0}
          value={match.groupIndex}
          onChange={(event) => onSetGroupIndex(match.id, Math.max(0, Number(event.target.value) || 0))}
          className="w-14 rounded border border-white/10 bg-[#0a0e1a] px-1.5 py-1 text-[10px] font-semibold text-white/70"
        />
      </div>
    </div>
  );
}

export function TournamentBracketEditor({
  segmentKey,
  bracketStageId,
  bracketStages,
  stages,
  initialBoard,
  matchOptions,
}: {
  segmentKey: string;
  bracketStageId: string;
  bracketStages: EditorBracketStage[];
  stages: EditorStage[];
  initialBoard: Board;
  matchOptions: MatchOptionGroup[];
}) {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  // 서버 재검증(revalidatePath) 이후 다시 렌더링될 때 stages 목록에 새로 등장한
  // 스테이지(예: 방금 매치가 처음 옮겨진 라운드)가 있으면 로컬 board에 채워 넣는다.
  // 이미 로컬에 갖고 있는 스테이지는 건드리지 않아 진행 중인 편집을 보존한다.
  useEffect(() => {
    setBoard((prev) => {
      const missing = stages.filter((stage) => !prev[stage.id]);
      if (missing.length === 0) return prev;

      const next = { ...prev };
      for (const stage of missing) {
        next[stage.id] = initialBoard[stage.id] ?? EMPTY_STAGE_BOARD;
      }
      return next;
    });
  }, [stages, initialBoard]);

  async function persist(columns: BracketColumnUpdate[]) {
    setSaving(true);
    const result = await saveBracketColumnsAction(segmentKey, columns);
    setSaving(false);
    if (!result.ok) {
      window.alert(result.error);
    }
  }

  function moveTo(targetStageId: string, targetSide: BracketSide, beforeId: string | null) {
    const id = dragId.current;
    dragId.current = null;
    setDraggingId(null);
    if (!id) return;

    setBoard((prev) => {
      let match: EditorMatch | undefined;
      let sourceStageId: string | undefined;
      let sourceSide: BracketSide | undefined;

      for (const stageId of Object.keys(prev)) {
        const found = prev[stageId].upper.find((item) => item.id === id);
        if (found) {
          match = found;
          sourceStageId = stageId;
          sourceSide = "upper";
          break;
        }
        const foundLower = prev[stageId].lower.find((item) => item.id === id);
        if (foundLower) {
          match = foundLower;
          sourceStageId = stageId;
          sourceSide = "lower";
          break;
        }
      }

      if (!match || !sourceStageId || !sourceSide) return prev;

      const next: Board = { ...prev };
      next[sourceStageId] = {
        ...stageBoardOf(next, sourceStageId),
        [sourceSide]: stageBoardOf(next, sourceStageId)[sourceSide].filter((item) => item.id !== id),
      };

      const targetColumn = stageBoardOf(next, targetStageId);
      const targetList = [...targetColumn[targetSide]];
      const insertAt = beforeId ? targetList.findIndex((item) => item.id === beforeId) : -1;

      if (insertAt === -1) {
        targetList.push(match);
      } else {
        targetList.splice(insertAt, 0, match);
      }

      next[targetStageId] = { ...targetColumn, [targetSide]: targetList };

      const affected: BracketColumnUpdate[] = [
        { stageId: targetStageId, side: targetSide, matchIds: targetList.map((item) => item.id) },
      ];

      if (sourceStageId !== targetStageId || sourceSide !== targetSide) {
        affected.push({
          stageId: sourceStageId,
          side: sourceSide,
          matchIds: stageBoardOf(next, sourceStageId)[sourceSide].map((item) => item.id),
        });
      }

      void persist(affected);

      return next;
    });
  }

  function moveToOtherSide(stageId: string, id: string) {
    dragId.current = id;
    const isInUpper = stageBoardOf(board, stageId).upper.some((match) => match.id === id);
    moveTo(stageId, isInUpper ? "lower" : "upper", null);
  }

  function reorderCard(stageId: string, side: BracketSide, id: string, direction: "up" | "down") {
    setBoard((prev) => {
      const list = stageBoardOf(prev, stageId)[side];
      const index = list.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;

      const nextList = [...list];
      [nextList[index], nextList[targetIndex]] = [nextList[targetIndex], nextList[index]];

      const next: Board = { ...prev, [stageId]: { ...stageBoardOf(prev, stageId), [side]: nextList } };

      void persist([{ stageId, side, matchIds: nextList.map((item) => item.id) }]);

      return next;
    });
  }

  async function setAdvancesTo(matchId: string, advancesToMatchId: string | null) {
    setBoard((prev) => {
      const next: Board = { ...prev };
      for (const stageId of Object.keys(next)) {
        for (const side of ["upper", "lower"] as const) {
          const list = stageBoardOf(next, stageId)[side];
          const index = list.findIndex((item) => item.id === matchId);
          if (index === -1) continue;

          const updatedList = [...list];
          updatedList[index] = { ...updatedList[index], advancesToMatchId };
          next[stageId] = { ...stageBoardOf(next, stageId), [side]: updatedList };
        }
      }
      return next;
    });

    setSaving(true);
    const result = await setMatchAdvancesToAction(segmentKey, matchId, advancesToMatchId);
    setSaving(false);
    if (!result.ok) {
      window.alert(result.error);
    }
  }

  async function setGroupIndex(matchId: string, groupIndex: number) {
    setBoard((prev) => {
      const next: Board = { ...prev };
      for (const stageId of Object.keys(next)) {
        for (const side of ["upper", "lower"] as const) {
          const list = stageBoardOf(next, stageId)[side];
          const index = list.findIndex((item) => item.id === matchId);
          if (index === -1) continue;

          const updatedList = [...list];
          updatedList[index] = { ...updatedList[index], groupIndex };
          next[stageId] = { ...stageBoardOf(next, stageId), [side]: updatedList };
        }
      }
      return next;
    });

    setSaving(true);
    const result = await setMatchGroupIndexAction(segmentKey, matchId, groupIndex);
    setSaving(false);
    if (!result.ok) {
      window.alert(result.error);
    }
  }

  async function moveStage(stageId: string, direction: "left" | "right") {
    setSaving(true);
    const result = await moveStageAction(segmentKey, bracketStageId, stageId, direction);
    setSaving(false);
    if (!result.ok) {
      window.alert(result.error);
    }
  }

  async function moveStageToBracket(stageId: string, targetBracketStageId: string) {
    if (!targetBracketStageId) return;

    setSaving(true);
    const result = await moveStageToBracketStageAction(segmentKey, stageId, targetBracketStageId);
    setSaving(false);
    if (!result.ok) {
      window.alert(result.error);
    }
  }

  async function deleteStage(stageId: string, stageName: string) {
    if (!window.confirm(`"${stageName}" 라운드를 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }

    setSaving(true);
    const result = await deleteStageAction(segmentKey, stageId);
    setSaving(false);
    if (!result.ok) {
      window.alert(result.error);
    }
  }

  async function deleteMatch(matchId: string) {
    if (!window.confirm("이 경기를 삭제할까요? 연결된 세트/평점 등도 함께 삭제되며 되돌릴 수 없습니다.")) {
      return;
    }

    setBoard((prev) => {
      const next: Board = { ...prev };
      for (const stageId of Object.keys(next)) {
        for (const side of ["upper", "lower"] as const) {
          const list = stageBoardOf(next, stageId)[side];
          if (!list.some((item) => item.id === matchId)) continue;
          next[stageId] = { ...stageBoardOf(next, stageId), [side]: list.filter((item) => item.id !== matchId) };
        }
      }
      return next;
    });

    setSaving(true);
    const result = await deleteMatchAction(segmentKey, matchId);
    setSaving(false);
    if (!result.ok) {
      window.alert(result.error);
    }
  }

  function renderList(stageId: string, side: BracketSide, list: EditorMatch[]) {
    return (
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          moveTo(stageId, side, null);
        }}
        className="flex min-h-[2rem] flex-1 flex-col gap-2 rounded-md border border-dashed border-white/10 p-2"
      >
        {list.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-white/25">여기로 끌어다 놓기</p>
        ) : (
          list.map((match, index) => (
            <Card
              key={match.id}
              match={match}
              matchOptions={matchOptions}
              isDragging={draggingId === match.id}
              isFirst={index === 0}
              isLast={index === list.length - 1}
              onDragStartCard={(id) => {
                dragId.current = id;
                setDraggingId(id);
              }}
              onDragEndCard={() => {
                dragId.current = null;
                setDraggingId(null);
              }}
              onDropBefore={(beforeId) => moveTo(stageId, side, beforeId)}
              onMoveToOtherSide={(matchId) => moveToOtherSide(stageId, matchId)}
              onMoveUp={(matchId) => reorderCard(stageId, side, matchId, "up")}
              onMoveDown={(matchId) => reorderCard(stageId, side, matchId, "down")}
              onSetAdvancesTo={setAdvancesTo}
              onSetGroupIndex={setGroupIndex}
              onDeleteMatch={deleteMatch}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-6 overflow-x-auto pb-2">
      {saving ? (
        <span className="fixed right-6 top-6 z-20 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#0a0e1a]">
          저장 중…
        </span>
      ) : null}

      {stages.map((stage, index) => {
        const column = stageBoardOf(board, stage.id);

        return (
          <div key={stage.id} className="flex w-64 shrink-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-sm bg-white/10 px-2 py-1 text-[11px] font-black uppercase tracking-widest text-white">
                {stage.name}
              </span>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveStage(stage.id, "left")}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-xs font-bold text-white/60 hover:border-white/30 hover:text-white disabled:opacity-20"
                  aria-label="이 라운드를 앞으로 이동"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={index === stages.length - 1}
                  onClick={() => moveStage(stage.id, "right")}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-xs font-bold text-white/60 hover:border-white/30 hover:text-white disabled:opacity-20"
                  aria-label="이 라운드를 뒤로 이동"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => deleteStage(stage.id, stage.name)}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-xs font-bold text-red-400/70 hover:border-red-400/40 hover:text-red-400"
                  aria-label="이 라운드 삭제"
                >
                  삭제
                </button>
              </div>
            </div>

            {bracketStages.length > 1 ? (
              <select
                defaultValue=""
                onChange={(event) => {
                  const targetId = event.target.value;
                  event.target.value = "";
                  void moveStageToBracket(stage.id, targetId);
                }}
                className="w-full rounded border border-white/10 bg-[#0a0e1a] px-2 py-1 text-[11px] font-semibold text-white/60"
              >
                <option value="">다른 브래킷으로 이동…</option>
                {bracketStages
                  .filter((bs) => bs.id !== bracketStageId)
                  .map((bs) => (
                    <option key={bs.id} value={bs.id}>
                      {bs.name}
                    </option>
                  ))}
              </select>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">승자조</span>
              {renderList(stage.id, "upper", column.upper)}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">패자조</span>
              {renderList(stage.id, "lower", column.lower)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
