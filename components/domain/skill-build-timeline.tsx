import Image from "next/image";

import type { ChampionAbilityIcons } from "@/lib/champions";
import type { SkillLevelUp } from "@/lib/player-build";

const SKILLS = [1, 2, 3, 4] as const;
const SKILL_KEY: Record<(typeof SKILLS)[number], string> = { 1: "Q", 2: "W", 3: "E", 4: "R" };

export function SkillBuildTimeline({
  abilityIcons,
  skillOrder,
}: {
  abilityIcons: ChampionAbilityIcons | null;
  skillOrder: SkillLevelUp[];
}) {
  const selected = new Set(skillOrder.map(({ slot, level }) => `${slot}-${level}`));

  return (
    <div className="touch-pan-x overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto grid w-full min-w-[520px] max-w-[760px] grid-cols-[repeat(19,minmax(26px,1fr))] gap-[3px] sm:min-w-[560px]">
        <span className="grid place-items-center text-[13px] font-medium text-[var(--ui-muted)]">레벨</span>
        {Array.from({ length: 18 }, (_, index) => index + 1).map((level) => (
          <span key={`level-${level}`} className="grid place-items-center text-xs font-medium tabular-nums text-[var(--ui-muted)]">
            {level}
          </span>
        ))}

        {SKILLS.map((slot) => (
          <div key={slot} className="contents">
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-[var(--ui-surface)]">
              {abilityIcons?.[slot] ? (
                <Image src={abilityIcons[slot]} alt="" fill sizes="36px" className="object-cover" />
              ) : null}
              <span className="absolute bottom-0 left-0 grid h-4 min-w-4 place-items-center rounded-tr bg-black/70 px-0.5 text-xs font-medium leading-none text-white">
                {SKILL_KEY[slot]}
              </span>
            </div>

            {Array.from({ length: 18 }, (_, index) => index + 1).map((level) => {
              const learned = selected.has(`${slot}-${level}`);

              return (
                <span
                  key={level}
                  className={`grid aspect-square w-full place-items-center rounded-md text-xs font-medium tabular-nums ${
                    learned
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "bg-[var(--ui-surface)] text-transparent"
                  }`}
                >
                  {learned ? level : "·"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
