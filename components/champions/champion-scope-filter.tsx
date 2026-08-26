import { ChampionUrlDropdown } from "@/components/champions/champion-url-dropdown";

export type ChampionScopeOption = {
  value: string;
  label: string;
};

type ChampionScopeFilterProps = {
  action: string;
  seasons: number[];
  season: number;
  tournaments: ChampionScopeOption[];
  tournament: string;
  patches: string[];
  patch: string;
  hidden?: Record<string, string | undefined>;
  setCount: number;
  showSetCount?: boolean;
  layout?: "inline" | "sidebar";
};

export function ChampionScopeFilter(props: ChampionScopeFilterProps) {
  const seasonOptions = props.seasons.map((value) => ({ value: String(value), label: `${value} 시즌` }));
  const tournamentOptions = [{ value: "all", label: "전체 대회" }, ...props.tournaments];
  const patchOptions = [{ value: "all", label: "전체 패치" }, ...props.patches.map((value) => ({ value, label: value }))];

  if (props.layout === "sidebar") {
    return (
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--ui-muted)]">통계 범위</legend>
        <div className="grid gap-1.5">
          <ChampionUrlDropdown
            ariaLabel="시즌 선택"
            options={seasonOptions}
            selected={String(props.season)}
            paramName="season"
            preserve={props.hidden}
            resetKeys={["tournament", "patch", "page"]}
            omitValues={[]}
            triggerClassName="min-h-11 w-full justify-between px-3 !font-medium hover:bg-[var(--ui-card-hover)]"
          />
          <ChampionUrlDropdown
            ariaLabel="대회 선택"
            options={tournamentOptions}
            selected={props.tournament}
            paramName="tournament"
            preserve={props.hidden}
            resetKeys={["patch", "page"]}
            triggerClassName="min-h-11 w-full justify-between px-3 !font-medium hover:bg-[var(--ui-card-hover)]"
          />
          <ChampionUrlDropdown
            ariaLabel="패치 선택"
            options={patchOptions}
            selected={props.patch}
            paramName="patch"
            preserve={props.hidden}
            resetKeys={["page"]}
            triggerClassName="min-h-11 w-full justify-between px-3 !font-medium hover:bg-[var(--ui-card-hover)]"
          />
        </div>
      </fieldset>
    );
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-none" aria-label="챔피언 통계 범위">
        <ChampionUrlDropdown
          ariaLabel="시즌 선택"
          options={seasonOptions}
          selected={String(props.season)}
          paramName="season"
          preserve={props.hidden}
          resetKeys={["tournament", "patch", "page"]}
          omitValues={[]}
          triggerClassName="h-10 w-full justify-between whitespace-nowrap rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 !font-medium transition-colors hover:border-[var(--ui-ink)] sm:w-[8rem] sm:px-3"
        />
        <ChampionUrlDropdown
          ariaLabel="대회 선택"
          options={tournamentOptions}
          selected={props.tournament}
          paramName="tournament"
          preserve={props.hidden}
          resetKeys={["patch", "page"]}
          triggerClassName="h-10 w-full justify-between whitespace-nowrap rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 !font-medium transition-colors hover:border-[var(--ui-ink)] sm:w-[11rem] sm:px-3"
        />
        <ChampionUrlDropdown
          ariaLabel="패치 선택"
          options={patchOptions}
          selected={props.patch}
          paramName="patch"
          preserve={props.hidden}
          resetKeys={["page"]}
          triggerClassName="h-10 w-full justify-between whitespace-nowrap rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 !font-medium transition-colors hover:border-[var(--ui-ink)] sm:w-[8rem] sm:px-3"
        />
      {props.showSetCount === false ? null : (
        <span className="col-span-3 mt-1 shrink-0 px-2 text-right text-[13px] font-normal tabular-nums text-[var(--ui-muted)] sm:col-span-1 sm:mt-0 sm:self-center">
          {props.setCount.toLocaleString("ko-KR")}세트
        </span>
      )}
    </div>
  );
}
