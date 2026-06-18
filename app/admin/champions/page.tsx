import { SectionHeader } from "@/components/layout/section-header";
import { getChampions } from "@/lib/data/lck";
import type { Champion } from "@/lib/types";
import { championImage } from "@/lib/champions";

import { updateChampionMappingAction } from "./actions";

function inputClassName() {
  return "min-w-0 rounded-md border border-border bg-background px-3 py-2 font-normal";
}

function ChampionMappingCard({ champion }: { champion: Champion }) {
  const previewUrl = championImage(champion);

  return (
    <form action={updateChampionMappingAction} className="flex h-full flex-col gap-4 rounded-md border border-border bg-surface p-4">
      <input type="hidden" name="championId" value={champion.id} />

      <div className="flex items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          {previewUrl ? (
            <img src={previewUrl} alt={`${champion.name} 이미지`} className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[10px] text-muted">NO IMG</span>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{champion.name}</h3>
          <p className="mt-1 text-sm text-muted">{champion.slug}</p>
          <p className="mt-1 text-sm text-muted">Data Dragon: {champion.ddragonId || "-"}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          챔피언명
          <input name="name" defaultValue={champion.name} required className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          이미지 URL
          <input name="imageUrl" defaultValue={champion.imageUrl ?? ""} placeholder="비우면 Data Dragon 기본 이미지 사용" className={inputClassName()} />
        </label>
      </div>

      <button type="submit" className="mt-auto rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
        저장
      </button>
    </form>
  );
}

export default async function AdminChampionsPage() {
  const champions = await getChampions();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="챔피언 관리" />

      <section className="flex flex-col gap-4" aria-labelledby="champion-mapping">
        <div>
          <h2 id="champion-mapping" className="text-xl font-semibold">
            이름 / 이미지 매핑
          </h2>
          <p className="mt-1 text-sm text-muted">
            수집된 챔피언의 표시 이름과 이미지 URL만 직접 수정합니다.
          </p>
        </div>

        {champions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {champions.map((champion) => (
              <ChampionMappingCard key={champion.id} champion={champion} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted">
            등록된 챔피언이 없습니다.
          </p>
        )}
      </section>
    </main>
  );
}
