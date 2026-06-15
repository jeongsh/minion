"use client";

import { useState } from "react";
import type { Player, Team } from "@/lib/types";
import { DeleteButton } from "./delete-button";
import { PlayerCreateModal } from "./player-create-modal";
import { PlayerEditModal } from "./player-edit-modal";

const POS_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"];
const POS_LABEL: Record<string, string> = {
  TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서폿",
};

export function PlayerList({ players, teams }: { players: Player[]; teams: Team[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? players.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.realName?.toLowerCase().includes(q),
      )
    : players;

  // 팀별 그룹화
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const byTeam = new Map<string, Player[]>();
  for (const p of filtered) {
    const key = p.teamId ?? "__none__";
    const arr = byTeam.get(key) ?? [];
    arr.push(p);
    byTeam.set(key, arr);
  }

  // 팀 순서: teams 배열 순서 + 팀 없는 선수 마지막
  const orderedTeams = [
    ...teams.filter((t) => byTeam.has(t.id)),
    ...(byTeam.has("__none__") ? [{ id: "__none__", name: "팀 없음", shortName: "", primaryColor: "#888" } as Team] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
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

      {filtered.length === 0 && (
        <p className="text-sm text-muted">검색 결과가 없습니다.</p>
      )}

      <div className="grid grid-cols-2 gap-4">
      {orderedTeams.map((team) => {
        const teamPlayers = byTeam.get(team.id) ?? [];
        // 포지션 → 주전 우선 → 이름순 정렬
        const sorted = [...teamPlayers].sort((a, b) => {
          // 주전 전체가 서브 전체보다 먼저
          if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
          // 같은 그룹 내에서는 포지션 순
          if (a.position !== b.position)
            return POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position);
          return a.name.localeCompare(b.name);
        });

        return (
          <section key={team.id} className="overflow-hidden rounded-lg border border-border">
            {/* 팀 헤더 */}
            <div
              className="flex items-center gap-2 border-b border-border px-4 py-3"
              style={{ borderLeft: `4px solid ${(teamMap.get(team.id) ?? team).primaryColor ?? "#888"}` }}
            >
              <span className="font-bold">{team.name}</span>
              <span className="text-xs text-muted">({sorted.length}명)</span>
            </div>

            {/* 선수 목록 */}
            <table className="w-full text-sm">
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-surface-muted">
                    <td className="w-16 px-4 py-2.5 text-xs text-muted">{POS_LABEL[p.position]}</td>
                    <td className="px-2 py-2.5 font-medium">{p.name}</td>
                    <td className="px-2 py-2.5 text-xs text-muted">{p.realName || "-"}</td>
                    <td className="w-16 px-2 py-2.5">
                      {p.isStarter ? (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                          주전
                        </span>
                      ) : (
                        <span className="text-xs text-muted">서브</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-row items-center gap-1.5">
                        <PlayerEditModal player={p} teams={teams} />
                        <DeleteButton id={p.id} name={p.name} />
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
    </div>
  );
}
