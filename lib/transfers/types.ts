export const TRANSFER_ROLES = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;
export type TransferRole = (typeof TRANSFER_ROLES)[number] | "COACH";
export type TransferKind = "renew" | "transfer" | "loan" | "leave" | "retire" | "inactive" | "promote" | "demote";
export const TRANSFER_KIND_LABELS: Record<TransferKind, string> = {
  renew: "재계약", transfer: "이적", loan: "임대", leave: "계약 종료", retire: "은퇴", inactive: "휴식 / 군 복무", promote: "콜업", demote: "센드다운",
};
export type TransferPerson = { name: string; realName: string; wikiUrl: string };
export type TransferSlot = { role: TransferRole; previous: TransferPerson[]; next: TransferPerson[]; renewed: boolean };
export type TransferRoster = { team: string; slots: TransferSlot[] };
export type TransferEvent = {
  id: string; player: string; realName: string; role: TransferRole; kind: TransferKind;
  from: string; to: string; date: string | null; contractUntil: string | null;
  sourceUrl: string; references: string[]; provenance: "namuwiki" | "official" | "report";
};
export type TransferFaCandidate = { player: string; team: string; role: TransferRole };
export type TransferSnapshot = {
  version: 1; season: number; rosters: TransferRoster[]; events: TransferEvent[];
  faCandidates: TransferFaCandidate[]; sourceUrl: string; sourceUpdatedAt: string | null;
  contractYears?: Record<string, number>;
};
export type TransferMarket = {
  season: number; snapshot: TransferSnapshot; manual_events: TransferEvent[];
  content_hash: string; checked_at: string; synced_at: string; auto_sync: boolean;
};

export function transferSeason(now = new Date()) {
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric" }).format(now));
  const month = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", month: "numeric" }).format(now));
  return month <= 2 ? year - 1 : year;
}

export function namuTransferUrl(season: number) {
  return `https://namu.wiki/w/${encodeURIComponent("LCK 스토브리그")}/${season}`;
}

export function normalizeTransferName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s._-]+/g, "");
}

const TEAM_ALIASES: Record<string, string[]> = {
  GEN: ["GEN", "Gen.G", "Gen.G Esports", "젠지"], HLE: ["HLE", "Hanwha Life Esports", "한화생명 이스포츠"],
  T1: ["T1"], DK: ["DK", "Dplus Kia", "디플러스 기아"], KT: ["KT", "kt Rolster", "kt 롤스터"],
  BFX: ["BFX", "FOX", "BNK FEARX", "BNK 피어엑스"], BRO: ["BRO", "HANJIN BRION", "한진 브리온", "OKSavingsBank BRION"],
  NS: ["NS", "Nongshim RedForce", "농심 레드포스"], KRX: ["KRX", "DRX", "KIWOOM DRX", "키움 DRX"],
  DNS: ["DNS", "DNF", "DN SOOPers", "DN Freecs", "DN 수퍼스"],
};
export function lckTeamCode(value: string): string | null {
  const clean = normalizeTransferName(value);
  return Object.entries(TEAM_ALIASES).find(([, aliases]) => aliases.some((a) => normalizeTransferName(a) === clean))?.[0] ?? null;
}

export function marketEvents(market: TransferMarket): TransferEvent[] {
  const manual = new Map(market.manual_events.map((e) => [e.id, e]));
  const identity = (e: TransferEvent) => [normalizeTransferName(e.player), e.kind, e.date, lckTeamCode(e.from) ?? normalizeTransferName(e.from), lckTeamCode(e.to) ?? normalizeTransferName(e.to)].join(":");
  const confirmed = new Set(market.manual_events.filter((e) => e.provenance === "official").map(identity));
  return [...market.snapshot.events.filter((e) => !manual.has(e.id) && !confirmed.has(identity(e))), ...manual.values()]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.player.localeCompare(b.player));
}

export function movementCategory(event: TransferEvent) {
  if (event.kind !== "transfer" && event.kind !== "loan") return event.kind;
  const from = lckTeamCode(event.from), to = lckTeamCode(event.to);
  return from && to ? "domestic" : to ? "incoming" : from ? "outgoing" : "tracked";
}

export function latestPlayerEvents(events: TransferEvent[]) {
  const map = new Map<string, TransferEvent>();
  for (const event of events) {
    const key = normalizeTransferName(event.player);
    const prev = map.get(key);
    if (!prev || (event.date ?? "") > (prev.date ?? "") || (event.date === prev.date && prev.kind === "leave" && event.kind !== "leave")) map.set(key, event);
  }
  return [...map.values()];
}
