import { latestPlayerEvents, lckTeamCode, normalizeTransferName, type TransferEvent, type TransferMarket, type TransferRoster } from "./transfers.ts";

export function transferEventsInStorageOrder(moves: TransferEvent[], market: TransferMarket) {
  const order = new Map([...market.snapshot.events, ...market.manual_events].map((event, index) => [event.id, index]));
  return [...moves].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
}

export function transferContract(playerName: string, team: string, events: TransferEvent[], registered?: { team: string | null; until: string | null }) {
  const name = normalizeTransferName(playerName);
  const latest = latestPlayerEvents(events.filter((e) => e.provenance !== "report" && normalizeTransferName(e.player) === name))[0];
  if (latest) {
    if (["leave", "retire", "inactive"].includes(latest.kind) && lckTeamCode(latest.from) === team) return { until: null, source: latest.sourceUrl, ended: latest.kind !== "inactive" };
    if (lckTeamCode(latest.to) === team) return { until: latest.contractUntil, source: latest.sourceUrl, ended: false };
    if (lckTeamCode(latest.from) === team) return { until: null, source: latest.sourceUrl, ended: true };
    // A new contract elsewhere must not inherit the previous team's registered expiry.
    return { until: null, source: "", ended: false };
  }
  return { until: registered?.team === team ? registered.until : null, source: "", ended: false };
}

export function resolveTransferRosters(rosters: TransferRoster[], events: TransferEvent[], season?: number) {
  const result = rosters.map((roster) => ({ ...roster, slots: roster.slots.map((slot) => ({ ...slot, previous: slot.previous.map((person) => ({ ...person })), next: slot.next.map((person) => ({ ...person })) })) }));
  for (const event of latestPlayerEvents(events.filter((e) => e.provenance !== "report"))) {
    const key = normalizeTransferName(event.player);
    const destination = lckTeamCode(event.to);
    // Early-season moves concern the current lineup, not necessarily next year's roster.
    if (season && event.date && event.date < `${season}-09-01` && !(event.kind === "renew" && event.contractUntil && Number(event.contractUntil.slice(0, 4)) > season)) continue;
    if (season && event.kind === "renew" && event.contractUntil && Number(event.contractUntil.slice(0, 4)) <= season) continue;
    for (const roster of result) {
      for (const slot of roster.slots) {
        if (event.kind !== "renew" && (roster.team !== destination || ["leave", "retire", "inactive", "demote"].includes(event.kind))) slot.next = slot.next.filter((p) => normalizeTransferName(p.name) !== key);
      }
    }
    if (destination && ["renew", "transfer", "loan", "promote"].includes(event.kind)) {
      const slot = result.find((r) => r.team === destination)?.slots.find((s) => s.role === event.role);
      if (slot) {
        const person = slot.previous.find((p) => normalizeTransferName(p.name) === key) ?? { name: event.player, realName: event.realName, wikiUrl: "" };
        if (!slot.next.some((p) => normalizeTransferName(p.name) === key)) slot.next.push(person);
        if (event.kind === "renew") slot.renewed = true;
      }
    }
  }
  return result;
}

export function departuresForTeam(team: string, rosters: TransferRoster[], events: TransferEvent[]) {
  const origin = rosters.find((r) => r.team === team);
  const names = new Set(origin?.slots.flatMap((s) => s.previous.map((p) => normalizeTransferName(p.name))) ?? []);
  return latestPlayerEvents(events.filter((e) => e.provenance !== "report"))
    .filter((e) => e.kind !== "renew" && lckTeamCode(e.to) !== team && (lckTeamCode(e.from) === team || names.has(normalizeTransferName(e.player))));
}
