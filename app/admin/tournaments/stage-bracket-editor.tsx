"use client";

import { useEffect, useRef, useState } from "react";

import { saveBracketColumnsAction, type BracketColumnUpdate } from "./actions";

export type EditorMatch = {
  id: string;
  matchDate: string;
  bestOf: number | null;
  teamAName: string;
  teamBName: string;
  teamAScore: number | null;
  teamBScore: number | null;
};

export type EditorStage = {
  id: string;
  name: string;
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
  isDragging,
  onDragStartCard,
  onDragEndCard,
  onDropBefore,
  onMoveToOtherSide,
}: {
  match: EditorMatch;
  isDragging: boolean;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onDropBefore: (id: string) => void;
  onMoveToOtherSide: (id: string) => void;
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
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/40">
        <span>{formatMatchDate(match.matchDate)}</span>
        {match.bestOf ? <span>Bo{match.bestOf}</span> : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white/80">
        <span className="truncate">{match.teamAName}</span>
        <span className="shrink-0 tabular-nums text-white/50">
          {match.teamAScore ?? "-"}:{match.teamBScore ?? "-"}
        </span>
        <span className="truncate text-right">{match.teamBName}</span>
      </div>
      <button
        type="button"
        onClick={() => onMoveToOtherSide(match.id)}
        className="mt-1.5 w-full rounded border border-white/10 py-1 text-[10px] font-bold text-white/50 hover:border-white/30 hover:text-white"
      >
        승자조 ↔ 패자조
      </button>
    </div>
  );
}

export function TournamentBracketEditor({
  segmentKey,
  stages,
  initialBoard,
}: {
  segmentKey: string;
  stages: EditorStage[];
  initialBoard: Board;
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
          list.map((match) => (
            <Card
              key={match.id}
              match={match}
              isDragging={draggingId === match.id}
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

      {stages.map((stage) => {
        const column = stageBoardOf(board, stage.id);

        return (
          <div key={stage.id} className="flex w-64 shrink-0 flex-col gap-3">
            <span className="w-fit rounded-sm bg-white/10 px-2 py-1 text-[11px] font-black uppercase tracking-widest text-white">
              {stage.name}
            </span>

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
