import { ImagePlus } from "lucide-react";
import type { ReactNode } from "react";

import { getFanNotificationEnabled, getIsFan } from "@/app/fan/[teamSlug]/actions";
import { FanAlarmButton } from "@/components/fan/fan-alarm-button";
import { FanFollowButton } from "@/components/fan/fan-follow-button";
import { FanHeaderTooltip, fanHeaderIconButtonClass } from "@/components/fan/fan-header-control-styles";
import { FanHeaderRequestDialog } from "@/components/fan/fan-header-request-dialog";
import { FanOfficialLinks } from "@/components/fan/fan-official-links";
import { FavoriteTeamButton } from "@/components/fan/favorite-team-button";
import { TeamLogo } from "@/components/ui/team-logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTeamByFanSiteHost, getTeamBySlug, getTeamFanCount } from "@/lib/data/lck";
import { checkFanHeaderUploadEligibility, getActiveFanHeaderUrl } from "@/lib/fan/fan-header";
import { getFavoriteTeamId } from "@/lib/fan/favorite-team";

export async function FanChannelHeader({ teamSlug, calendarSlot }: { teamSlug: string; calendarSlot?: ReactNode }) {
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));

  if (!team) return null;

  const user = await getCurrentUser();
  const [fanCount, isFan, notificationEnabled, headerBackground, uploadEligibility, favoriteTeamId] = await Promise.all([
    getTeamFanCount(team.id),
    getIsFan(team.id),
    user ? getFanNotificationEnabled(team.id) : Promise.resolve(false),
    getActiveFanHeaderUrl(team.id),
    checkFanHeaderUploadEligibility(team.id, user?.id),
    getFavoriteTeamId(),
  ]);
  const displayHeaderBackground =
    headerBackground ?? (team.fanSiteHost === "hle" ? "/images/fan-headers/hle-header-bg-v1.jpg" : null);

  const hasHeaderBackground = Boolean(displayHeaderBackground);

  return (
    <header
      className={
        hasHeaderBackground
          ? "relative isolate overflow-hidden border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-white"
          : "border-b border-[var(--ui-border)] bg-[var(--page-background)] text-[var(--ui-ink)]"
      }
    >
      {displayHeaderBackground ? (
        <>
          {/* 팬 대문이 있으면 헤더 전체를 채우는 배경으로 사용한다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayHeaderBackground}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_34%] saturate-[0.9]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.34)_48%,rgba(0,0,0,0.68)_100%)]"
          />
        </>
      ) : null}

      <div
        className={
          hasHeaderBackground
            ? "fan-page-container flex min-h-[220px] items-end py-5 sm:min-h-[260px] sm:py-6 lg:min-h-[300px] lg:py-7"
            : "fan-page-container flex min-h-[132px] items-end py-5 sm:min-h-[148px] sm:py-6 lg:min-h-0 lg:py-7"
        }
      >
        <div className="flex w-full min-w-0 items-end lg:justify-between lg:gap-8">
          <div className="flex h-[68px] min-w-0 items-end gap-4 sm:h-[76px]">
            <span
              className={
                hasHeaderBackground
                  ? "grid h-[68px] w-[68px] shrink-0 place-items-center rounded-xl border border-white bg-white sm:h-[76px] sm:w-[76px]"
                  : "grid h-[68px] w-[68px] shrink-0 place-items-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] sm:h-[76px] sm:w-[76px]"
              }
            >
              <TeamLogo team={team} size="h-[70%] w-[70%]" plain themeAware />
            </span>

            <div className="flex h-[68px] min-w-0 flex-col justify-center sm:h-[76px]">
              <h1
                className={
                  hasHeaderBackground
                    ? "truncate font-paperozi text-[24px] font-black leading-none tracking-[-0.035em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] sm:text-[30px]"
                    : "truncate font-paperozi text-[24px] font-black leading-none tracking-[-0.035em] sm:text-[30px]"
                }
              >
                {team.shortName} 팬 커뮤니티
              </h1>
              <div className="mt-1.5 flex items-center gap-2">
                <FanFollowButton
                  teamId={team.id}
                  teamSlug={team.fanSiteHost}
                  teamName={team.shortName}
                  initialCount={fanCount}
                  initialFollowing={isFan}
                  teamColor={team.primaryColor}
                  variant="header"
                />
                <FavoriteTeamButton
                  teamId={team.id}
                  teamSlug={team.fanSiteHost}
                  teamName={team.shortName}
                  initialFavorite={favoriteTeamId === team.id}
                />
                <FanAlarmButton
                  teamId={team.id}
                  teamSlug={team.fanSiteHost}
                  initialEnabled={notificationEnabled}
                  teamColor={team.primaryColor}
                  compact
                  iconOnly
                />
                {calendarSlot}
              </div>
            </div>
          </div>

          <div className="hidden h-[76px] min-w-0 items-end gap-4 sm:gap-5 lg:flex lg:shrink-0 lg:justify-end">
            <FanHeaderRequestDialog
              teamId={team.id}
              teamSlug={team.fanSiteHost}
              teamName={team.shortName}
              teamColor={team.primaryColor}
              blockedReason={uploadEligibility.ok ? null : uploadEligibility.reason}
              triggerClassName={fanHeaderIconButtonClass}
              triggerAriaLabel="대문 신청"
              trigger={
                <>
                  <ImagePlus size={16} aria-hidden="true" />
                  <FanHeaderTooltip>대문 신청</FanHeaderTooltip>
                </>
              }
            />
            <span aria-hidden="true" className="hidden h-10 items-center sm:flex">
              <span className={hasHeaderBackground ? "h-6 w-px bg-white/45" : "h-6 w-px bg-[var(--ui-border)]"} />
            </span>
            <FanOfficialLinks team={team} />
          </div>
        </div>
      </div>
    </header>
  );
}
