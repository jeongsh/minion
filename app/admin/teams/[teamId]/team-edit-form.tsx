"use client";

import Link from "next/link";
import { useState } from "react";
import type { Team, TeamIdentityHistory } from "@/lib/types";
import { createTeamIdentityHistoryAction, updateTeamAction } from "../actions";
import {
  IdentityHistoryFields,
  TeamBasicFields,
  TeamBrandingFields,
  TeamLinkFields,
  TeamMetaFields,
} from "../team-fields";

function ExternalLink({ href, label }: { href: string; label: string }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
    >
      {label}
    </a>
  );
}

export function TeamEditForm({
  team,
  histories,
}: {
  team: Team;
  histories: TeamIdentityHistory[];
}) {
  const [logoPreview, setLogoPreview] = useState(team.logoWhiteUrl || team.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(team.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(team.secondaryColor);
  const [showHistoryForm, setShowHistoryForm] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        <ExternalLink href={team.officialHomepageUrl} label="공식 홈페이지" />
        <ExternalLink href={team.officialYoutubeUrl} label="YouTube" />
        <ExternalLink href={team.officialXUrl} label="X" />
        <ExternalLink href={team.officialInstagramUrl} label="Instagram" />
        <Link
          href={`/teams/${team.slug}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
        >
          팀 상세 보기
        </Link>
        <Link
          href={`/fan/${team.slug}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
        >
          팬 사이트 보기
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="flex flex-col gap-4">
          <section
            className="overflow-hidden rounded-lg border border-border"
            style={{
              background: `linear-gradient(160deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            }}
          >
            <div className="flex flex-col items-center gap-3 px-4 py-8">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt={team.name} className="h-20 w-20 object-contain drop-shadow-lg" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white">
                  {team.shortName?.slice(0, 2)}
                </div>
              )}
              <div className="text-center">
                <p className="font-bold text-white drop-shadow">{team.name}</p>
                <p className="text-xs text-white/70">{team.fanSiteHost}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 text-xs text-muted">
            <p>팀 ID</p>
            <p className="mt-1 break-all font-mono text-foreground">{team.id}</p>
          </section>
        </aside>

        <form
          action={updateTeamAction}
          className="flex flex-col gap-8 rounded-lg border border-border bg-surface p-6"
          onChange={(event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (target.name === "logoUrl" || target.name === "logoWhiteUrl") {
              setLogoPreview(target.value || team.logoUrl);
            }
            if (target.name === "primaryColor") setPrimaryColor(target.value);
            if (target.name === "secondaryColor") setSecondaryColor(target.value);
          }}
        >
          <section>
            <h2 className="text-lg font-semibold">기본 정보</h2>
            <p className="mt-1 text-sm text-muted">팀명, slug, 팬사이트 호스트, 스태프</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TeamBasicFields team={team} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">브랜딩</h2>
            <p className="mt-1 text-sm text-muted">팀 컬러, 로고, 배경 이미지</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TeamBrandingFields team={team} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">공식 링크</h2>
            <p className="mt-1 text-sm text-muted">홈페이지 및 SNS 채널</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TeamLinkFields team={team} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">연동 / 메타</h2>
            <p className="mt-1 text-sm text-muted">Leaguepedia, 소스 ID, 파워랭킹</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TeamMetaFields team={team} />
            </div>
          </section>

          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="submit"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
            >
              변경사항 저장
            </button>
          </div>
        </form>
      </div>

      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">팀명 / 로고 변경 이력</h2>
            <p className="mt-1 text-sm text-muted">네이밍 스폰서 변경이나 리브랜딩 기록</p>
          </div>
          <button
            type="button"
            onClick={() => setShowHistoryForm((value) => !value)}
            className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
          >
            {showHistoryForm ? "추가 폼 닫기" : "+ 이력 추가"}
          </button>
        </div>

        {histories.length === 0 ? (
          <p className="mt-4 text-sm text-muted">등록된 변경 이력이 없습니다.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">팀명</th>
                  <th className="px-3 py-2 font-medium">스폰서</th>
                  <th className="px-3 py-2 font-medium">slug</th>
                  <th className="px-3 py-2 font-medium">적용 기간</th>
                  <th className="px-3 py-2 font-medium">메모</th>
                </tr>
              </thead>
              <tbody>
                {histories.map((history) => (
                  <tr key={history.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-3">
                      <p className="font-medium">{history.name}</p>
                      <p className="text-xs text-muted">{history.shortName}</p>
                    </td>
                    <td className="px-3 py-3 text-muted">{history.sponsorName ?? "-"}</td>
                    <td className="px-3 py-3 font-mono text-xs">{history.slug}</td>
                    <td className="px-3 py-3 text-muted">
                      {history.effectiveFrom}
                      {" ~ "}
                      {history.effectiveTo ?? "현재"}
                    </td>
                    <td className="px-3 py-3 text-muted">{history.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showHistoryForm ? (
          <form
            action={createTeamIdentityHistoryAction}
            className="mt-6 rounded-md border border-dashed border-border p-4"
          >
            <h3 className="text-sm font-semibold">새 변경 이력</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <IdentityHistoryFields team={team} />
            </div>
            <button
              type="submit"
              className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              이력 추가
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
