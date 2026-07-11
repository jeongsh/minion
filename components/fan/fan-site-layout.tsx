import { notFound } from "next/navigation";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

type TeamStyle = React.CSSProperties & {
  "--team-primary": string;
  "--team-secondary": string;
  "--team-on-primary": string;
  "--team-accent-text": string;
  "--team-accent-soft": string;
};

function contrastText(hex: string) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#111318" : "#ffffff";
}

export async function FanSiteLayout({
  teamSlug,
  children,
}: {
  teamSlug: string;
  children: React.ReactNode;
}) {
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const style: TeamStyle = {
    "--team-primary": team.primaryColor,
    "--team-secondary": team.secondaryColor,
    "--team-on-primary": contrastText(team.primaryColor),
    "--team-accent-text": `color-mix(in srgb, ${team.primaryColor} 72%, ${contrastText(team.primaryColor) === "#ffffff" ? "white" : "black"})`,
    "--team-accent-soft": `color-mix(in srgb, ${team.primaryColor} 12%, var(--ui-surface))`,
  };

  return (
    <div className="team-surface min-h-[calc(100vh-73px)]" style={style}>
      {children}
    </div>
  );
}
