import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getTeamIdentityHistories, getTeams } from "@/lib/data/lck";
import { fanSiteHosts } from "@/lib/team-themes";
import { teamLogoPath, teamWhiteLogoPath } from "@/lib/team-logos";
import type { Team } from "@/lib/types";

import { createTeamAction, createTeamIdentityHistoryAction, updateTeamAction } from "./actions";

function inputClassName() {
  return "min-w-0 rounded-md border border-border bg-background px-3 py-2 font-normal";
}

function TeamFields({ team }: { team?: Team }) {
  return (
    <>
      {team ? <input type="hidden" name="teamId" value={team.id} /> : null}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        고정 팬사이트 호스트
        <select name="fanSiteHost" defaultValue={team?.fanSiteHost ?? ""} required className={inputClassName()}>
          <option value="">선택</option>
          {fanSiteHosts.map((host) => (
            <option key={host} value={host}>
              {host}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        팀 상세 slug
        <input name="slug" defaultValue={team?.slug ?? ""} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        팀명
        <input name="name" defaultValue={team?.name ?? ""} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        축약명
        <input name="shortName" defaultValue={team?.shortName ?? ""} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        기본 색상
        <input name="primaryColor" defaultValue={team?.primaryColor ?? "#1E88E5"} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        보조 색상
        <input name="secondaryColor" defaultValue={team?.secondaryColor ?? "#041A2F"} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
        로고 URL
        <input
          name="logoUrl"
          defaultValue={team?.logoUrl ?? (team?.slug ? teamLogoPath(team.slug) : "")}
          placeholder={team?.slug ? teamLogoPath(team.slug) : "/logos/{slug}.svg"}
          className={inputClassName()}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
        화이트 로고 URL
        <input
          name="logoWhiteUrl"
          defaultValue={team?.logoWhiteUrl ?? (team?.slug ? teamWhiteLogoPath(team.slug) : "")}
          placeholder={team?.slug ? teamWhiteLogoPath(team.slug) : "/logos/{slug}-white.svg"}
          className={inputClassName()}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
        배경 URL
        <input name="backgroundUrl" defaultValue={team?.backgroundUrl ?? ""} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        홈페이지
        <input name="officialHomepageUrl" defaultValue={team?.officialHomepageUrl ?? ""} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        YouTube
        <input name="officialYoutubeUrl" defaultValue={team?.officialYoutubeUrl ?? ""} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        X
        <input name="officialXUrl" defaultValue={team?.officialXUrl ?? ""} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Instagram
        <input name="officialInstagramUrl" defaultValue={team?.officialInstagramUrl ?? ""} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Leaguepedia Page
        <input name="leaguepediaPage" defaultValue={team?.leaguepediaPage ?? ""} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Source Team ID
        <input name="sourceTeamId" defaultValue={team?.sourceTeamId ?? ""} className={inputClassName()} />
      </label>
    </>
  );
}

function FormPanel({
  children,
  description,
  meta,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  meta?: React.ReactNode;
  title: string;
}) {
  return (
    <details className="group rounded-md border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 marker:hidden">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {meta}
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-lg leading-none group-open:hidden">
            +
          </span>
          <span className="hidden h-8 w-8 items-center justify-center rounded-md border border-border text-lg leading-none group-open:flex">
            -
          </span>
        </div>
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}

function SectionTitle({
  description,
  id,
  title,
}: {
  description?: string;
  id: string;
  title: string;
}) {
  return (
    <div>
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
  );
}

function IdentityHistoryForm({ team }: { team: Team }) {
  return (
    <form action={createTeamIdentityHistoryAction}>
      <input type="hidden" name="teamId" value={team.id} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          팀명
          <input name="historyName" defaultValue={team.name} required className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          축약명
          <input name="historyShortName" defaultValue={team.shortName} required className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          팀 상세 slug
          <input name="historySlug" defaultValue={team.slug} required className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          네이밍 스폰서
          <input name="sponsorName" placeholder="예: 키움증권" className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
          로고 URL
          <input name="historyLogoUrl" defaultValue={team.logoUrl} className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          적용 시작일
          <input name="effectiveFrom" type="date" defaultValue="2026-01-01" required className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          적용 종료일
          <input name="effectiveTo" type="date" className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
          메모
          <input name="note" className={inputClassName()} />
        </label>
      </div>
      <button type="submit" className="mt-4 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
        변경 이력 추가
      </button>
    </form>
  );
}

export default async function AdminTeamsPage() {
  const [teams, histories] = await Promise.all([getTeams(), getTeamIdentityHistories()]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="팀 관리" />

      <section className="flex flex-col gap-4" aria-labelledby="team-current-values">
        <SectionTitle id="team-current-values" title="현재 팀 표시값" />
        <DataTable
          rows={teams}
          columns={[
            { key: "host", label: "고정 팬사이트 호스트", render: (row) => row.fanSiteHost },
            { key: "slug", label: "팀 상세 slug", render: (row) => row.slug },
            { key: "name", label: "팀명", render: (row) => row.name },
            { key: "short", label: "축약명", render: (row) => row.shortName },
            { key: "logo", label: "로고 URL", render: (row) => row.logoUrl },
            { key: "logoWhite", label: "화이트 로고 URL", render: (row) => row.logoWhiteUrl },
            { key: "color", label: "포인트 컬러", render: (row) => row.primaryColor },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="team-edit">
        <SectionTitle
          id="team-edit"
          title="팀 수정"
          description="팀을 선택해서 필요한 항목만 펼쳐 수정합니다."
        />
        <div className="grid gap-3">
          {teams.map((team) => (
            <FormPanel
              key={team.id}
              title={team.name}
              description={`${team.fanSiteHost} · ${team.slug} · ${team.id}`}
              meta={
                <span className="hidden items-center gap-1 md:flex">
                  <span
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: team.primaryColor }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: team.secondaryColor }}
                  />
                </span>
              }
            >
              <form action={updateTeamAction}>
                <div className="grid gap-3 md:grid-cols-2">
                  <TeamFields team={team} />
                </div>
                <button type="submit" className="mt-4 rounded-md border border-border px-3 py-2 text-sm font-semibold">
                  현재 표시값 저장
                </button>
              </form>
            </FormPanel>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="team-identity-history">
        <SectionTitle id="team-identity-history" title="팀명 / 로고 변경 이력" />
        <DataTable
          rows={histories.map((history) => ({
            ...history,
            fanSiteHost: teams.find((team) => team.id === history.teamId)?.fanSiteHost ?? "-",
          }))}
          emptyText="등록된 변경 이력이 없습니다."
          columns={[
            { key: "host", label: "고정 팬사이트 호스트", render: (row) => row.fanSiteHost },
            { key: "sponsor", label: "네이밍 스폰서", render: (row) => row.sponsorName ?? "-" },
            { key: "name", label: "팀명", render: (row) => row.name },
            { key: "short", label: "축약명", render: (row) => row.shortName },
            { key: "slug", label: "팀 상세 slug", render: (row) => row.slug },
            { key: "logo", label: "로고 URL", render: (row) => row.logoUrl },
            { key: "from", label: "적용 시작", render: (row) => row.effectiveFrom },
            { key: "to", label: "적용 종료", render: (row) => row.effectiveTo ?? "-" },
            { key: "note", label: "메모", render: (row) => row.note ?? "-" },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="team-history-add">
        <SectionTitle
          id="team-history-add"
          title="팀명 / 로고 변경 이력 추가"
          description="기존 팀의 명칭이나 로고 변경 기록만 따로 추가합니다."
        />
        <div className="grid gap-3">
          {teams.map((team) => (
            <FormPanel
              key={team.id}
              title={`${team.name} 변경 이력 추가`}
              description={team.fanSiteHost}
            >
              <IdentityHistoryForm team={team} />
            </FormPanel>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="team-create">
        <SectionTitle
          id="team-create"
          title="팀 생성"
          description="새 팀을 추가할 때만 펼쳐 입력합니다."
        />
        <FormPanel title="새 팀 생성" description="고정 팬사이트 호스트와 기본 표시값을 입력합니다.">
          <form action={createTeamAction} className="grid gap-3 md:grid-cols-2">
            <TeamFields />
            <div className="flex items-end">
              <button type="submit" className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">
                팀 생성
              </button>
            </div>
          </form>
        </FormPanel>
      </section>
    </main>
  );
}
