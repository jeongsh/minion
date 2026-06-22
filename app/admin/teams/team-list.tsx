"use client";

import Link from "next/link";
import { useState } from "react";
import type { Team } from "@/lib/types";
import { TeamCreateModal } from "./team-create-modal";

export function TeamList({ teams }: { teams: Team[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? teams.filter(
        (team) =>
          team.name.toLowerCase().includes(q) ||
          team.shortName.toLowerCase().includes(q) ||
          team.slug.toLowerCase().includes(q) ||
          team.fanSiteHost.toLowerCase().includes(q),
      )
    : teams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="팀명, slug, 팬사이트 호스트 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border bg-background px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <TeamCreateModal />
        <span className="text-sm text-muted">{filtered.length}개 팀</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">검색 결과가 없습니다.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <article
              key={team.id}
              className="group overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-md"
            >
              <div
                className="flex items-center gap-4 px-5 py-4"
                style={{
                  background: `linear-gradient(135deg, ${team.primaryColor} 0%, ${team.secondaryColor} 100%)`,
                }}
              >
                {team.logoWhiteUrl || team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={team.logoWhiteUrl || team.logoUrl}
                    alt={team.name}
                    className="h-12 w-12 object-contain drop-shadow"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
                    {team.shortName?.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold text-white drop-shadow">{team.name}</h2>
                  <p className="truncate text-xs text-white/70">{team.fanSiteHost}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 p-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted">slug</dt>
                    <dd className="font-medium">{team.slug}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">감독</dt>
                    <dd className="font-medium">{team.headCoach || "-"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted">코치</dt>
                    <dd className="font-medium">{team.coaches || "-"}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Link
                    href={`/admin/teams/${team.id}`}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                  >
                    관리
                  </Link>
                  <Link
                    href={`/teams/${team.slug}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                  >
                    팀 상세
                  </Link>
                  <Link
                    href={`/fan/${team.slug}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                  >
                    팬 사이트
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
