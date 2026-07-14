import { CheckCircle2 } from "lucide-react";

import { getIsFan } from "@/app/fan/[teamSlug]/actions";
import { FanFollowButton } from "@/components/fan/fan-follow-button";
import { TeamLogo } from "@/components/ui/team-logo";
import { getTeamByFanSiteHost, getTeamBySlug, getTeamFanCount } from "@/lib/data/lck";

export async function FanChannelHeader({ teamSlug }: { teamSlug: string }) {
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) return null;

  const [fanCount, isFan] = await Promise.all([getTeamFanCount(team.id), getIsFan(team.id)]);
  const fanCountLabel = fanCount.toLocaleString("ko-KR");

  return (
    <header className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)]">
      <div className="layout-wide py-3.5 sm:py-5">
        <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] sm:h-20 sm:w-20">
            <TeamLogo team={team} size="h-[72%] w-[72%]" plain themeAware />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="min-w-0 truncate text-[19px] font-extrabold leading-tight sm:text-[22px]">
                {team.shortName}
              </h1>
              <CheckCircle2 size={16} className="shrink-0" style={{ color: team.primaryColor }} aria-hidden="true" />
            </div>
            <p className="mt-1 text-[13px] font-semibold text-[var(--ui-text)] sm:text-sm">팬 {fanCountLabel}명</p>
            <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-[1.45] text-[var(--ui-muted)] sm:text-sm">
              {team.name} 팬 채널입니다.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:mt-4 sm:max-w-[260px]">
          <FanFollowButton
            teamId={team.id}
            teamSlug={team.fanSiteHost}
            teamName={team.shortName}
            initialCount={fanCount}
            initialFollowing={isFan}
            teamColor={team.primaryColor}
            variant="channel"
          />
        </div>
      </div>
    </header>
  );
}
