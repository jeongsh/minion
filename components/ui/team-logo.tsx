import type { Team } from "@/lib/types";

export function TeamLogo({ team, size="h-10 w-10", plain=false }: { team?: Team; size?: string; plain?: boolean }) {
  return <span className={`grid ${size} shrink-0 place-items-center overflow-hidden ${plain ? "" : "rounded-full bg-[var(--ui-surface-muted)]"}`}>{team?.logoUrl ? <img src={team.logoUrl} alt={team.name} className={plain ? "h-full w-full object-contain" : "h-[72%] w-[72%] object-contain"}/> : <span className="text-xs font-black">{team?.shortName ?? "?"}</span>}</span>;
}

