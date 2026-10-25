import type { LiveMatchResponse } from "@/app/api/matches/[matchId]/live/route";

const requests = new Map<string, { until: number; promise: Promise<LiveMatchResponse> }>();

/** The header and open match share one bounded live request per polling tick. */
export function readLiveMatch(matchId: string, force = false): Promise<LiveMatchResponse> {
  const current = requests.get(matchId);
  if (current && (current.until === Number.POSITIVE_INFINITY || (!force && current.until > Date.now()))) return current.promise;
  const promise = fetch(`/api/matches/${encodeURIComponent(matchId)}/live`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
    .then(response => {
      if (!response.ok) throw new Error("라이브 정보를 불러오지 못했습니다.");
      return response.json() as Promise<LiveMatchResponse>;
    });
  const entry = { until: Number.POSITIVE_INFINITY, promise };
  requests.set(matchId, entry);
  void promise.then(() => {
    entry.until = Date.now() + 2000;
    window.setTimeout(() => { if (requests.get(matchId) === entry) requests.delete(matchId); }, 2000);
  }, () => { if (requests.get(matchId) === entry) requests.delete(matchId); });
  return promise;
}
