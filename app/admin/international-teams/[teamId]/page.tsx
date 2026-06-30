import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHeader } from "@/components/layout/section-header";
import { getPlayersByTeamId, getTeamById } from "@/lib/data/lck";
import type { Player } from "@/lib/types";

import { updateInternationalPlayerImageAction, updateInternationalTeamMediaAction } from "../actions";

function inputClassName() {
  return "min-w-0 rounded-md border border-border bg-background px-3 py-2 font-normal";
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function PlayerImageRow({ player }: { player: Player }) {
  const hasImage = Boolean(player.profileImageUrl);

  return (
    <form
      action={updateInternationalPlayerImageAction}
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-center"
    >
      <input type="hidden" name="playerId" value={player.id} />

      <div className="flex items-center gap-3 sm:w-48 sm:shrink-0">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.profileImageUrl} alt={`${player.name} 프로필`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-muted">{initials(player.name)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{player.name}</p>
          <p className="text-xs text-muted">{player.position}</p>
        </div>
      </div>

      <input
        name="profileImageUrl"
        defaultValue={player.profileImageUrl ?? ""}
        placeholder="프로필 이미지 URL (비우면 삭제)"
        className={`${inputClassName()} flex-1`}
      />

      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground sm:shrink-0"
      >
        저장
      </button>
    </form>
  );
}

export default async function AdminInternationalTeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const [team, players] = await Promise.all([getTeamById(teamId), getPlayersByTeamId(teamId)]);

  if (!team) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Link href="/admin/international-teams" className="text-sm text-muted hover:text-foreground">
          ← 해외팀 목록
        </Link>
        <SectionHeader eyebrow="해외팀 관리" title={team.name} />
        <p className="text-sm text-muted">
          {team.slug} · {team.leaguepediaPage || "Leaguepedia page 없음"}
        </p>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="team-media">
        <h2 id="team-media" className="text-xl font-semibold">
          팀 로고 / 프로필 이미지
        </h2>
        <form
          action={updateInternationalTeamMediaAction}
          className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
        >
          <input type="hidden" name="teamId" value={team.id} />
          <div className="flex gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
              {team.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.logoUrl} alt={`${team.name} 로고`} className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-[10px] text-muted">NO LOGO</span>
              )}
            </div>
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
              {team.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.profileImageUrl} alt={`${team.name} 프로필`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-muted">NO IMG</span>
              )}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            로고 URL
            <input name="logoUrl" defaultValue={team.logoUrl ?? ""} placeholder="이미지 URL 입력" required className={inputClassName()} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            프로필 이미지 URL
            <input name="profileImageUrl" defaultValue={team.profileImageUrl ?? ""} placeholder="선택" className={inputClassName()} />
          </label>
          <button type="submit" className="self-start rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            저장
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="player-images">
        <div>
          <h2 id="player-images" className="text-xl font-semibold">
            선수 프로필 이미지
          </h2>
          <p className="mt-1 text-sm text-muted">
            각 선수의 현재 썸네일을 보면서 프로필 이미지 URL을 직접 관리합니다.
          </p>
        </div>

        {players.length > 0 ? (
          <div className="flex flex-col gap-2">
            {players.map((player) => (
              <PlayerImageRow key={player.id} player={player} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted">
            이 팀에 등록된 선수가 없습니다.
          </p>
        )}
      </section>
    </main>
  );
}
