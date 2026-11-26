import { isUnconfirmedTransfer, latestPlayerEvents, lckTeamCode, marketEvents, normalizeTransferName, type TransferEvent, type TransferMarket, type TransferRoster } from "./transfers.ts";

export function transferEventsInStorageOrder(moves: TransferEvent[], market: TransferMarket) {
  const order = new Map([...market.snapshot.events, ...market.manual_events].map((event, index) => [event.id, index]));
  return [...moves].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
}

export function transferContract(playerName: string, team: string, events: TransferEvent[], registered?: { team: string | null; until: string | null }) {
  const name = normalizeTransferName(playerName);
  const latest = latestPlayerEvents(events.filter((e) => !isUnconfirmedTransfer(e) && normalizeTransferName(e.player) === name))[0];
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
  for (const event of latestPlayerEvents(events.filter((e) => !isUnconfirmedTransfer(e)))) {
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
    if (destination && ["renew", "transfer", "loan", "promote", "return"].includes(event.kind)) {
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

// Unconfirmed reports stay out of the resolved roster; this projects them onto one team's view with a badge.
export function reportedRosterChanges(team: string, reported: TransferEvent[], season: number) {
  const arrivals = reported.filter((e) => lckTeamCode(e.to) === team && (e.kind === "renew"
    ? (!e.contractUntil || Number(e.contractUntil.slice(0, 4)) > season) && (!e.date || e.date >= `${season}-09-01` || Boolean(e.contractUntil && Number(e.contractUntil.slice(0, 4)) > season))
    : isTransferArrival(e, team)));
  const departures = reported.filter((e) => e.kind !== "renew" && lckTeamCode(e.from) === team && lckTeamCode(e.to) !== team);
  const leaving = new Set(reported.filter((e) => e.kind !== "renew" && lckTeamCode(e.to) !== team).map((e) => normalizeTransferName(e.player)));
  return { arrivals, departures, leaving };
}

export function isTransferArrival(event: TransferEvent, team: string) {
  return event.kind === "promote" || event.kind === "return" ||
    ((event.kind === "transfer" || event.kind === "loan") && lckTeamCode(event.from) !== team);
}

export function departuresForTeam(team: string, rosters: TransferRoster[], events: TransferEvent[]) {
  const origin = rosters.find((r) => r.team === team);
  const names = new Set(origin?.slots.flatMap((s) => s.previous.map((p) => normalizeTransferName(p.name))) ?? []);
  return latestPlayerEvents(events.filter((e) => !isUnconfirmedTransfer(e)))
    .filter((e) => e.kind !== "renew" && lckTeamCode(e.to) !== team && (lckTeamCode(e.from) === team || names.has(normalizeTransferName(e.player))));
}

export function transferRosterViews(market: TransferMarket, events = marketEvents(market)) {
  const latest = latestPlayerEvents(events.filter((event) => !isUnconfirmedTransfer(event)));
  const confirmedByPlayer = new Map(latest.map((event) => [normalizeTransferName(event.player), event]));
  const reported = latestPlayerEvents(events.filter(isUnconfirmedTransfer)).filter((event) => {
    const confirmed = confirmedByPlayer.get(normalizeTransferName(event.player));
    return !confirmed || (confirmed.date ?? "") < (event.date ?? "");
  });
  const hiddenTags = new Set(market.hidden_roster_tags);

  return resolveTransferRosters(market.snapshot.rosters, events, market.season).map(({ team, slots }) => {
    const reports = reportedRosterChanges(team, reported, market.season);
    const confirmedDepartures = departuresForTeam(team, market.snapshot.rosters, events);
    const departureNames = new Set(confirmedDepartures.map((event) => normalizeTransferName(event.player)));
    const departures = [...confirmedDepartures, ...reports.departures.filter((event) => !departureNames.has(normalizeTransferName(event.player)))];
    const nextNames = new Set(slots.flatMap((slot) => slot.next.map((person) => normalizeTransferName(person.name))));
    const confirmedArrivals = latest.filter((event) => lckTeamCode(event.to) === team && isTransferArrival(event, team) && nextNames.has(normalizeTransferName(event.player)));
    const arrivalsByPlayer = new Map(confirmedArrivals.map((event) => [normalizeTransferName(event.player), event]));
    const renewalsByPlayer = new Map(latest.filter((event) => event.kind === "renew" && lckTeamCode(event.to || event.from) === team)
      .map((event) => [normalizeTransferName(event.player), event]));
    const rosterReports = reports.arrivals.filter((event) => !arrivalsByPlayer.has(normalizeTransferName(event.player)));

    return {
      team,
      arrivals: [...confirmedArrivals, ...rosterReports.filter((event) => event.kind !== "renew")],
      departures,
      slots: slots.map((slot) => {
        const slotReports = rosterReports.filter((event) => event.role === slot.role);
        const slotNames = new Set(slot.next.map((person) => normalizeTransferName(person.name)));
        const next = [
          ...slot.next.filter((person) => !reports.leaving.has(normalizeTransferName(person.name))),
          ...slotReports.filter((event) => !slotNames.has(normalizeTransferName(event.player))).map((event) => ({ name: event.player, realName: event.realName, wikiUrl: "" })),
        ];
        return {
          ...slot,
          next: next.map((person) => {
            const name = normalizeTransferName(person.name);
            const report = slotReports.find((event) => normalizeTransferName(event.player) === name);
            const arrival = arrivalsByPlayer.get(name);
            const event = report ?? arrival ?? renewalsByPlayer.get(name);
            if (!event) return { person, tag: null };
            const label = report ? (report.provenance === "rumor" ? "루머" : "거피셜") : arrival ? "합류" : "재계약";
            const key = JSON.stringify([team, slot.role, name, label, event.id]);
            return { person, tag: { key, label, event, hidden: label !== "루머" && hiddenTags.has(key) } };
          }),
        };
      }),
    };
  });
}

export function manageableRosterTags(market: TransferMarket) {
  return transferRosterViews(market).flatMap(({ team, slots }) => slots.flatMap(({ next }) => next.flatMap(({ person, tag }) =>
    tag && tag.label !== "루머" ? [{ ...tag, team, person }] : [],
  )));
}
