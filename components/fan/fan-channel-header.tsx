import { getFanNotificationEnabled, getIsFan } from "@/app/fan/[teamSlug]/actions";
import { FanAlarmButton } from "@/components/fan/fan-alarm-button";
import { FanFollowButton } from "@/components/fan/fan-follow-button";
import { TeamLogo } from "@/components/ui/team-logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTeamByFanSiteHost, getTeamBySlug, getTeamFanCount } from "@/lib/data/lck";
import { getActiveFanHeaderUrl } from "@/lib/fan/fan-header";

export async function FanChannelHeader({
  teamSlug,
  calendarSlot,
}: {
  teamSlug: string;
  calendarSlot?: React.ReactNode;
}) {
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));

  if (!team) return null;

  const showFullName = team.name.trim().toLocaleLowerCase() !== team.shortName.trim().toLocaleLowerCase();

  const user = await getCurrentUser();
  const [fanCount, isFan, notificationEnabled, headerBackground] = await Promise.all([
    getTeamFanCount(team.id),
    getIsFan(team.id),
    user ? getFanNotificationEnabled(team.id) : Promise.resolve(false),
    getActiveFanHeaderUrl(team.id),
  ]);

  return (
    <header
      className="relative isolate overflow-hidden bg-[var(--ui-surface)] text-[var(--ui-ink)]"
      style={{ "--fan-accent": team.primaryColor } as React.CSSProperties}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-20 overflow-hidden">
        {headerBackground ? (
          <>
            {/* 팬 대문은 외부 저장소 URL이라 Next Image 허용 호스트를 고정할 수 없다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headerBackground}
              alt=""
              className="absolute inset-y-0 right-0 h-full w-full object-cover object-[center_32%] opacity-[0.16] sm:w-[72%] sm:opacity-25 lg:w-[58%] lg:opacity-40"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--ui-surface)_0%,var(--ui-surface)_42%,transparent_78%)] max-sm:bg-[linear-gradient(90deg,var(--ui-surface)_0%,color-mix(in_srgb,var(--ui-surface)_84%,transparent)_100%)]" />
          </>
        ) : (
          <>
            <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-[var(--fan-accent)] opacity-[0.08] blur-3xl sm:right-8" />
            <span className="absolute -right-2 top-1/2 -translate-y-1/2 select-none font-paperozi text-[clamp(5rem,14vw,10rem)] font-black tracking-[-0.08em] text-[var(--fan-accent)] opacity-[0.055]">
              {team.shortName}
            </span>
          </>
        )}
      </div>

      <div className="fan-page-container relative py-5 sm:py-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-[20px] border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_8px_28px_color-mix(in_srgb,var(--ui-ink)_8%,transparent)] sm:h-20 sm:w-20">
              <TeamLogo team={team} size="h-[66%] w-[66%]" plain themeAware />
            </span>

            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2.5">
                <h1 className="truncate font-paperozi text-[27px] font-black leading-none tracking-[-0.04em] sm:text-[34px]">
                  {team.shortName}
                </h1>
                <span className="shrink-0 rounded-full bg-[var(--team-accent-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--team-accent-text)] sm:text-xs">
                  팬 채널
                </span>
              </div>
              <p className="mt-2 flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[var(--ui-muted)]">
                {showFullName ? <span className="truncate">{team.name}</span> : null}
                {showFullName ? <span aria-hidden="true" className="h-3 w-px shrink-0 bg-[var(--ui-border)]" /> : null}
                <span className="shrink-0">
                  팬 <strong className="font-extrabold tabular-nums text-[var(--ui-ink)]">{fanCount.toLocaleString("ko-KR")}</strong>명
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
            <FanFollowButton
              teamId={team.id}
              teamSlug={team.fanSiteHost}
              teamName={team.shortName}
              initialCount={fanCount}
              initialFollowing={isFan}
              teamColor={team.primaryColor}
              variant="spotlight"
            />
            <FanAlarmButton
              teamId={team.id}
              teamSlug={team.fanSiteHost}
              initialEnabled={notificationEnabled}
              compact
            />
            {calendarSlot}
          </div>
        </div>
      </div>
    </header>
  );
}
