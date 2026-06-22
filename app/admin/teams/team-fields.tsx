import { fanSiteHosts } from "@/lib/team-themes";
import { teamLogoPath, teamWhiteLogoPath } from "@/lib/team-logos";
import type { Team } from "@/lib/types";

export function inputClassName() {
  return "min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-accent";
}

function HiddenTeamId({ team }: { team?: Team }) {
  return team ? <input type="hidden" name="teamId" value={team.id} /> : null;
}

export function TeamBasicFields({ team }: { team?: Team }) {
  return (
    <>
      <HiddenTeamId team={team} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">고정 팬사이트 호스트</span>
        <select name="fanSiteHost" defaultValue={team?.fanSiteHost ?? ""} required className={inputClassName()}>
          <option value="">선택</option>
          {fanSiteHosts.map((host) => (
            <option key={host} value={host}>
              {host}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">팀 상세 slug</span>
        <input name="slug" defaultValue={team?.slug ?? ""} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">팀명</span>
        <input name="name" defaultValue={team?.name ?? ""} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">축약명</span>
        <input name="shortName" defaultValue={team?.shortName ?? ""} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">감독</span>
        <input name="headCoach" defaultValue={team?.headCoach ?? ""} placeholder="예: Bengi" className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">코치</span>
        <input name="coaches" defaultValue={team?.coaches ?? ""} placeholder="예: Roach, Moment" className={inputClassName()} />
      </label>
    </>
  );
}

export function TeamBrandingFields({ team }: { team?: Team }) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">기본 색상</span>
        <input name="primaryColor" type="color" defaultValue={team?.primaryColor ?? "#1E88E5"} required className="h-10 w-full cursor-pointer rounded-md border border-border bg-background" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">보조 색상</span>
        <input name="secondaryColor" type="color" defaultValue={team?.secondaryColor ?? "#041A2F"} required className="h-10 w-full cursor-pointer rounded-md border border-border bg-background" />
      </label>
      <label className="flex flex-col gap-1.5 md:col-span-2">
        <span className="text-sm font-medium">로고 URL</span>
        <input
          name="logoUrl"
          defaultValue={team?.logoUrl ?? (team?.slug ? teamLogoPath(team.slug) : "")}
          placeholder={team?.slug ? teamLogoPath(team.slug) : "/logos/{slug}.svg"}
          className={inputClassName()}
        />
      </label>
      <label className="flex flex-col gap-1.5 md:col-span-2">
        <span className="text-sm font-medium">화이트 로고 URL</span>
        <input
          name="logoWhiteUrl"
          defaultValue={team?.logoWhiteUrl ?? (team?.slug ? teamWhiteLogoPath(team.slug) : "")}
          placeholder={team?.slug ? teamWhiteLogoPath(team.slug) : "/logos/{slug}-white.svg"}
          className={inputClassName()}
        />
      </label>
      <label className="flex flex-col gap-1.5 md:col-span-2">
        <span className="text-sm font-medium">배경 URL</span>
        <input name="backgroundUrl" defaultValue={team?.backgroundUrl ?? ""} className={inputClassName()} />
      </label>
    </>
  );
}

export function TeamLinkFields({ team }: { team?: Team }) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">홈페이지</span>
        <input
          name="officialHomepageUrl"
          defaultValue={team?.officialHomepageUrl ?? ""}
          placeholder="https://..."
          className={inputClassName()}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">YouTube</span>
        <input
          name="officialYoutubeUrl"
          defaultValue={team?.officialYoutubeUrl ?? ""}
          placeholder="https://www.youtube.com/@..."
          className={inputClassName()}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">X</span>
        <input
          name="officialXUrl"
          defaultValue={team?.officialXUrl ?? ""}
          placeholder="https://x.com/..."
          className={inputClassName()}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Instagram</span>
        <input
          name="officialInstagramUrl"
          defaultValue={team?.officialInstagramUrl ?? ""}
          placeholder="https://www.instagram.com/..."
          className={inputClassName()}
        />
      </label>
    </>
  );
}

export function TeamMetaFields({ team }: { team?: Team }) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Leaguepedia Page</span>
        <input name="leaguepediaPage" defaultValue={team?.leaguepediaPage ?? ""} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Source Team ID</span>
        <input name="sourceTeamId" defaultValue={team?.sourceTeamId ?? ""} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">글로벌 파워랭킹</span>
        <input name="globalPowerRank" type="number" min="1" defaultValue={team?.globalPowerRank ?? ""} placeholder="예: 3" className={inputClassName()} />
      </label>
    </>
  );
}

export function TeamFields({ team }: { team?: Team }) {
  return (
    <>
      <TeamBasicFields team={team} />
      <TeamBrandingFields team={team} />
      <TeamLinkFields team={team} />
      <TeamMetaFields team={team} />
    </>
  );
}

export function IdentityHistoryFields({ team }: { team: Team }) {
  return (
    <>
      <input type="hidden" name="teamId" value={team.id} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">팀명</span>
        <input name="historyName" defaultValue={team.name} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">축약명</span>
        <input name="historyShortName" defaultValue={team.shortName} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">팀 상세 slug</span>
        <input name="historySlug" defaultValue={team.slug} required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">네이밍 스폰서</span>
        <input name="sponsorName" placeholder="예: 키움증권" className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5 md:col-span-2">
        <span className="text-sm font-medium">로고 URL</span>
        <input name="historyLogoUrl" defaultValue={team.logoUrl} className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">적용 시작일</span>
        <input name="effectiveFrom" type="date" defaultValue="2026-01-01" required className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">적용 종료일</span>
        <input name="effectiveTo" type="date" className={inputClassName()} />
      </label>
      <label className="flex flex-col gap-1.5 md:col-span-2">
        <span className="text-sm font-medium">메모</span>
        <input name="note" className={inputClassName()} />
      </label>
    </>
  );
}
