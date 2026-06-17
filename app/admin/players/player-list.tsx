"use client";

import Link from "next/link";
import { useState } from "react";
import type { Player, PlayerCareerHistory, Team } from "@/lib/types";
import { reactivatePlayerAction } from "./actions";
import { CareerHistoryPanel } from "./career-history-panel";
import { DeleteButton } from "./delete-button";
import { PlayerCreateModal } from "./player-create-modal";
import { RetireButton } from "./retire-button";

const POS_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"];
const POS_LABEL: Record<string, string> = {
  TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서폿",
};

export function PlayerList({
  players,
  retiredPlayers,
  teams,
  careerHistories,
}: {
  players: Player[];
  retiredPlayers: Player[];
  teams: Team[];
  careerHistories: PlayerCareerHistory[];
}) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? players.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.realName?.toLowerCase().includes(q),
      )
    : players;

  const filteredRetired = q
    ? retiredPlayers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.realName?.toLowerCase().includes(q),
      )
    : retiredPlayers;

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // 현역 — 팀별 그룹화
  const byTeam = new Map<string, Player[]>();
  for (const p of filtered) {
    const key = p.teamId ?? "__none__";
    const arr = byTeam.get(key) ?? [];
    arr.push(p);
    byTeam.set(key, arr);
  }
  const orderedTeams = [
    ...teams.filter((t) => byTeam.has(t.id)),
    ...(byTeam.has("__none__")
      ? [{ id: "__none__", name: "팀 없음", shortName: "", primaryColor: "#888" } as Team]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* 검색 + 추가 버튼 */}
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="선수명 또는 본명 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border bg-background px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <PlayerCreateModal teams={teams} />
      </div>

      {/* ── 현역 선수 ── */}
      {filtered.length === 0 && filteredRetired.length === 0 && (
        <p className="text-sm text-muted">검색 결과가 없습니다.</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {orderedTeams.map((team) => {
          const teamPlayers = byTeam.get(team.id) ?? [];
          const sorted = [...teamPlayers].sort((a, b) => {
            if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
            if (a.position !== b.position)
              return POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position);
            return a.name.localeCompare(b.name);
          });

          return (
            <section key={team.id} className="overflow-hidden rounded-lg border border-border">
              <div
                className="flex items-center gap-2 border-b border-border px-4 py-3"
                style={{
                  borderLeft: `4px solid ${(teamMap.get(team.id) ?? team).primaryColor ?? "#888"}`,
                }}
              >
                <span className="font-bold">{team.name}</span>
                <span className="text-xs text-muted">({sorted.length}명)</span>
              </div>

              <table className="w-full text-sm">
                <tbody>
                  {sorted.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/50 last:border-0 hover:bg-surface-muted"
                    >
                      <td className="w-14 px-4 py-2.5 text-xs text-muted">
                        {POS_LABEL[p.position]}
                      </td>
                      <td className="px-2 py-2.5 font-medium">{p.name}</td>
                      <td className="px-2 py-2.5 text-xs text-muted">{p.realName || "-"}</td>
                      <td className="w-14 px-2 py-2.5">
                        {p.isStarter ? (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                            주전
                          </span>
                        ) : (
                          <span className="text-xs text-muted">서브</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-row flex-wrap items-center gap-1.5">
                          <Link
                            href={`/admin/players/${p.id}`}
                            className="rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-muted"
                          >
                            수정
                          </Link>
                          <RetireButton id={p.id} name={p.name} />
                          <DeleteButton id={p.id} name={p.name} />
                          <CareerHistoryPanel
                            player={p}
                            histories={careerHistories}
                            teams={teams}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      {/* ── 은퇴 선수 ── */}
      {(retiredPlayers.length > 0 || q) && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3 border-t border-border pt-8">
            <h2 className="text-xl font-bold">은퇴 선수</h2>
            <span className="rounded-full bg-muted/20 px-2.5 py-0.5 text-sm text-muted">
              {filteredRetired.length}명
            </span>
          </div>

          {filteredRetired.length === 0 ? (
            <p className="text-sm text-muted">은퇴 선수가 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredRetired.map((p) => {
                const mine = careerHistories
                  .filter((h) => h.playerId === p.id)
                  .sort((a, b) => b.startDate.localeCompare(a.startDate));

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border bg-surface p-5"
                  >
                    {/* 선수 기본 정보 */}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/20 text-lg font-bold text-muted">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{p.name}</span>
                            <span className="rounded bg-muted/20 px-1.5 py-0.5 text-xs text-muted">
                              {POS_LABEL[p.position]}
                            </span>
                            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-semibold text-red-500">
                              은퇴
                            </span>
                          </div>
                          {p.realName && (
                            <p className="text-sm text-muted">{p.realName}</p>
                          )}
                          {p.retiredAt && (
                            <p className="text-xs text-muted">
                              은퇴일: {p.retiredAt}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/players/${p.id}`}
                          className="rounded border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                        >
                          관리
                        </Link>
                        <form action={reactivatePlayerAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="rounded border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
                          >
                            복귀
                          </button>
                        </form>
                        <DeleteButton id={p.id} name={p.name} />
                      </div>
                    </div>

                    {/* 경력 히스토리 타임라인 */}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">역대 소속 팀</p>
                        <CareerHistoryPanel
                          player={p}
                          histories={careerHistories}
                          teams={teams}
                        />
                      </div>

                      {mine.length === 0 ? (
                        <p className="text-xs text-muted">기록된 경력이 없습니다. 우측 버튼으로 추가하세요.</p>
                      ) : (
                        <div className="relative ml-2 flex flex-col gap-0">
                          {/* 세로 타임라인 선 */}
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                          {mine.map((h, i) => {
                            const team = h.teamId ? teamMap.get(h.teamId) : null;
                            const teamLabel =
                              team?.name ?? h.teamName ?? "팀 없음";
                            const color = team?.primaryColor ?? "#888";

                            return (
                              <div key={h.id} className="relative flex items-start gap-3 pb-4">
                                {/* 점 */}
                                <div
                                  className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-background"
                                  style={{ backgroundColor: color }}
                                />
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">{teamLabel}</span>
                                    <span className="text-xs text-muted">
                                      {POS_LABEL[h.position] ?? h.position}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted">
                                    {h.startDate.slice(0, 7)}
                                    {" ~ "}
                                    {h.endDate ? h.endDate.slice(0, 7) : "현재"}
                                  </span>
                                  {h.notes && (
                                    <span className="text-xs text-muted italic">{h.notes}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
