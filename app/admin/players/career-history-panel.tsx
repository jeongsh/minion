"use client";

import { useState } from "react";
import type { Player, PlayerCareerHistory, Team } from "@/lib/types";
import { addCareerHistoryAction, deleteCareerHistoryAction } from "./actions";

const POS_LABEL: Record<string, string> = {
  TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서폿",
};
const POSITIONS = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;

function inputCls() {
  return "rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent";
}

function CareerAddForm({ player, teams, onDone }: {
  player: Player;
  teams: Team[];
  onDone: () => void;
}) {
  const [useCustomTeam, setUseCustomTeam] = useState(false);

  return (
    <form
      action={async (fd) => {
        await addCareerHistoryAction(fd);
        onDone();
      }}
      className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-3"
    >
      <input type="hidden" name="player_id" value={player.id} />
      <p className="text-xs font-semibold text-muted">경력 추가</p>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={useCustomTeam}
            onChange={(e) => setUseCustomTeam(e.target.checked)}
          />
          직접 입력 (DB 없는 팀)
        </label>
      </div>

      {useCustomTeam ? (
        <input
          name="team_name"
          placeholder="팀명 직접 입력"
          required
          className={inputCls()}
        />
      ) : (
        <select name="team_id" className={inputCls()}>
          <option value="">— 팀 없음 —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-3 gap-2">
        <select name="position" required defaultValue={player.position} className={inputCls()}>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>{POS_LABEL[p]} ({p})</option>
          ))}
        </select>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-muted">시작일</label>
          <input type="date" name="start_date" required className={inputCls()} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-muted">종료일 (현역이면 비움)</label>
          <input type="date" name="end_date" className={inputCls()} />
        </div>
      </div>

      <input
        name="notes"
        placeholder="메모 (선택)"
        className={inputCls()}
      />

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-foreground px-3 py-1 text-xs font-semibold text-background"
        >
          추가
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-border px-3 py-1 text-xs font-semibold"
        >
          취소
        </button>
      </div>
    </form>
  );
}

export function CareerHistoryPanel({
  player,
  histories,
  teams,
}: {
  player: Player;
  histories: PlayerCareerHistory[];
  teams: Team[];
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const mine = histories
    .filter((h) => h.playerId === player.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-muted"
      >
        경력 {mine.length > 0 && <span className="text-accent">({mine.length})</span>}
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border bg-surface p-3">
          {mine.length === 0 ? (
            <p className="text-xs text-muted">기록된 경력이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {mine.map((h) => {
                const teamLabel =
                  h.teamId ? (teamMap.get(h.teamId)?.name ?? h.teamName ?? "알 수 없는 팀")
                           : (h.teamName ?? "팀 없음");
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-2 rounded bg-surface-muted px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: h.teamId
                            ? (teamMap.get(h.teamId)?.primaryColor ?? "#888")
                            : "#888",
                        }}
                      />
                      <span className="font-semibold">{teamLabel}</span>
                      <span className="text-muted">{POS_LABEL[h.position] ?? h.position}</span>
                      <span className="text-muted">
                        {h.startDate.slice(0, 7)}
                        {" ~ "}
                        {h.endDate ? h.endDate.slice(0, 7) : "현재"}
                      </span>
                      {h.notes && <span className="text-muted italic">{h.notes}</span>}
                    </div>
                    <form action={deleteCareerHistoryAction}>
                      <input type="hidden" name="id" value={h.id} />
                      <button
                        type="submit"
                        className="text-red-400 hover:text-red-600"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}

          {adding ? (
            <CareerAddForm player={player} teams={teams} onDone={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-2 text-xs text-accent hover:underline"
            >
              + 경력 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}
