import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { lckTeamCode, namuTransferUrl, normalizeTransferName, TRANSFER_ROLES, type TransferEvent, type TransferFaCandidate, type TransferKind, type TransferPerson, type TransferRole, type TransferRoster, type TransferSnapshot } from "./types.ts";

type Cell = { text: string; html: string; element: Element };

function cleanText($: CheerioAPI, element: Element) {
  const clone = $(element).clone();
  clone.find(".wiki-fn-content, .wiki-edit-section, script, style").remove();
  clone.find("br").replaceWith(" ");
  return clone.text().replace(/\s+/g, " ").trim();
}

// Preserve merged dates, teams and positions. DOM table indexes are deliberately not used.
function tableGrid($: CheerioAPI, table: Element): Cell[][] {
  const grid: Cell[][] = [];
  $(table).find("tr").filter((_, tr) => $(tr).closest("table")[0] === table).each((rowIndex, row) => {
    grid[rowIndex] ??= [];
    let col = 0;
    $(row).children("td,th").each((_, element) => {
      while (grid[rowIndex][col]) col++;
      const rowspan = Math.min(100, Math.max(1, Number($(element).attr("rowspan")) || 1));
      const colspan = Math.min(20, Math.max(1, Number($(element).attr("colspan")) || 1));
      const cell = { text: cleanText($, element), html: $(element).html() ?? "", element };
      for (let y = 0; y < rowspan; y++) {
        grid[rowIndex + y] ??= [];
        for (let x = 0; x < colspan; x++) grid[rowIndex + y][col + x] = cell;
      }
      col += colspan;
    });
  });
  return grid;
}

function roleOf(value: string): TransferRole | null {
  const match = value.toUpperCase().match(/\b(TOP|JGL|MID|BOT|SUP|SPT|ADC)\b/);
  if (match) return ({ SPT: "SUP", ADC: "BOT" }[match[1]] ?? match[1]) as TransferRole;
  if (/감독|코치/.test(value)) return "COACH";
  return null;
}

function people($: CheerioAPI, cell?: Cell): TransferPerson[] {
  if (!cell) return [];
  const result: TransferPerson[] = [];
  $(cell.element).find("a.wiki-link-internal").each((_, el) => {
    if ($(el).parents("del,s").length) return;
    const value = cleanText($, el);
    const match = value.match(/^([^()]+)\(([^()]+)\)$/);
    if (!match || !/[A-Za-z0-9]/.test(match[2])) return;
    const href = $(el).attr("href") ?? "";
    result.push({ name: match[2].trim(), realName: match[1].trim(), wikiUrl: href.startsWith("/w/") ? `https://namu.wiki${href}` : "" });
  });
  return [...new Map(result.map((p) => [normalizeTransferName(p.name), p])).values()];
}

function parsedDate(text: string, year: number): string | null {
  const match = text.match(/(?:(20\d{2})년\s*)?(\d{1,2})월\s*(\d{1,2})일/);
  if (!match) return null;
  const value = `${match[1] ?? year}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : null;
}

function references($: CheerioAPI, cells: Cell[]) {
  const links = new Set<string>();
  for (const cell of new Set(cells)) {
    $(cell.element).find("a").each((_, a) => {
      const href = $(a).attr("href") ?? "";
      if (/^https:\/\//.test(href) && !new URL(href).hostname.endsWith("namu.wiki")) links.add(href);
      if (/^#fn-/.test(href)) {
        const footnote = $("[id]").filter((_, e) => $(e).attr("id") === href.slice(1)).parent();
        footnote.find('a[href^="https://"]').each((_, ref) => { links.add($(ref).attr("href")!); });
      }
    });
  }
  return [...links].slice(0, 5);
}

export function parseNamuTransferDocument(html: string, season: number): TransferSnapshot {
  const $ = load(html);
  const title = $("h1").first().text();
  if (!title.includes(`LCK 스토브리그/${season}`)) throw new Error("나무위키 문서 제목을 확인할 수 없습니다. 기존 데이터를 유지합니다.");
  const sourceUrl = namuTransferUrl(season);
  const rosters: TransferRoster[] = [], allEvents: TransferEvent[] = [], faCandidates: TransferFaCandidate[] = [];
  let section = "";
  let timelineTables = 0;
  $("h2,h3,h4,h5,h6,table").each((_, element) => {
    if (/^h[2-6]$/.test(element.tagName)) { section = $(element).text().replace(/\[편집\]/g, ""); return; }
    if ($(element).parents("table").length) return;
    const grid = tableGrid($, element);
    const header = grid.find((row) => row.some((cell) => cell.text === "닉네임") && row.some((cell) => cell.text === "일자"));
    if (header) {
      const kind: TransferKind | null = /재계약|계약 연장/.test(section) ? "renew" : /이적/.test(section) ? "transfer" : /임대/.test(section) ? "loan" : /은퇴/.test(section) ? "retire" : /군 복무|휴식/.test(section) ? "inactive" : /행보 미정|계약 종료/.test(section) ? "leave" : /콜업/.test(section) ? "promote" : null;
      if (!kind) return;
      timelineTables++;
      let year = season;
      const nameIndex = header.findIndex((c) => c.text === "닉네임");
      const dateIndex = header.findIndex((c) => c.text === "일자");
      const realIndex = header.findIndex((c) => c.text === "이름");
      const roleIndex = header.findIndex((c) => c.text === "포지션");
      const fromIndex = header.findIndex((c) => /^(원소속 팀|소속 팀|마지막 소속 팀)$/.test(c.text));
      const toIndex = header.findIndex((c) => /^(이적 팀|현소속 팀)$/.test(c.text));
      const untilIndex = header.findIndex((c) => c.text === "기간");
      for (const row of grid.slice(grid.indexOf(header) + 1)) {
        const distinct = [...new Set(row)];
        if (distinct.length === 1) { const match = distinct[0].text.match(/^(20\d{2})년$/); if (match) year = Number(match[1]); continue; }
        const player = row[nameIndex]?.text;
        if (!player || !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,49}$/.test(player)) throw new Error("이적 표의 선수 이름 형식이 바뀌었습니다. 기존 데이터를 유지합니다.");
        const roleCell = row[roleIndex];
        const role = roleOf(`${roleCell?.text ?? ""} ${roleCell ? $(roleCell.element).find("img").map((_, i) => $(i).attr("alt")).get().join(" ") : ""}`);
        const date = parsedDate(row[dateIndex]?.text ?? "", year);
        if (!role || !date || fromIndex < 0) throw new Error("이적 표의 날짜, 포지션 또는 팀을 확인할 수 없습니다. 기존 데이터를 유지합니다.");
        const from = row[fromIndex]?.text ?? "";
        const to = kind === "renew" ? from : toIndex >= 0 ? row[toIndex]?.text ?? "" : "";
        const eventKind = kind === "promote" && lckTeamCode(from) && !lckTeamCode(to) ? "demote" : kind;
        allEvents.push({ id: `wiki:${eventKind}:${date}:${normalizeTransferName(player)}`, player, realName: row[realIndex]?.text ?? "", role, kind: eventKind, from, to, date, contractUntil: untilIndex >= 0 ? parsedDate(row[untilIndex]?.text ?? "", year) : null, sourceUrl, references: references($, row), provenance: "namuwiki" });
      }
      return;
    }
    const tableTitle = grid[0]?.map((c) => c.text).find((text) => lckTeamCode(text));
    if (tableTitle && grid[1]?.some((c) => c.text === String(season)) && grid[1]?.some((c) => c.text === String(season + 1))) {
      const slots: TransferRoster["slots"] = [];
      const seen = new Set<string>();
      for (const row of grid.slice(3)) {
        const role = roleOf(row[0]?.text ?? "");
        if (!role || seen.has(role)) continue;
        seen.add(role);
        // First line of each role is the main roster; following lines are reserves/academy.
        const previousCell = people($, row[2]).length ? row[2] : row[1];
        slots.push({ role, previous: people($, previousCell), next: people($, row[3]), renewed: /\[RS\]/.test(row[3]?.html ?? "") });
      }
      if (TRANSFER_ROLES.some((role) => !slots.some((s) => s.role === role && s.previous.length))) throw new Error(`${tableTitle} 로스터 표가 불완전합니다. 기존 데이터를 유지합니다.`);
      rosters.push({ team: lckTeamCode(tableTitle)!, slots });
      return;
    }
    if (grid[0]?.some((c) => c.text.includes(`${season} LCK 스토브리그 팀별 FA 현황`))) {
      for (const row of grid.slice(2)) {
        const team = lckTeamCode(row[0]?.text ?? "");
        if (!team) continue;
        TRANSFER_ROLES.forEach((role, i) => {
          const cell = row[i + 3];
          if (!cell) return;
          const clone = $(cell.element).clone();
          clone.find("del,s,.wiki-fn-content").remove();
          clone.find("a.wiki-link-internal").each((_, a) => {
            const player = $(a).text().trim();
            if (/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,49}$/.test(player)) faCandidates.push({ player, team, role });
          });
        });
      }
    }
  });
  if (rosters.length !== 10 || new Set(rosters.map((r) => r.team)).size !== 10 || timelineTables < 3) throw new Error("LCK 10개 팀과 이적 표를 모두 확인하지 못했습니다. 기존 데이터를 유지합니다.");
  const cohort = new Set(rosters.flatMap((r) => r.slots.flatMap((s) => s.previous.map((p) => normalizeTransferName(p.name)))));
  // Keep tracking a player who leaves LCK, becomes FA, then signs abroad.
  for (const e of allEvents) if (lckTeamCode(e.from) || lckTeamCode(e.to)) cohort.add(normalizeTransferName(e.player));
  const events = allEvents.filter((e) => lckTeamCode(e.from) || lckTeamCode(e.to) || cohort.has(normalizeTransferName(e.player)));
  const contractYears: Record<string, number> = {};
  // The article also states some contracts only to year precision. Keep that precision.
  $(".wiki-paragraph").each((_, element) => {
    const text = cleanText($, element);
    if (!/잔여 계약 기간|시즌 종료 후 FA|년까지 계약/.test(text)) return;
    const match = text.match(/^([A-Za-z0-9][A-Za-z0-9 _.-]{0,49})\s+\(20\d{2}~(20\d{2})\)/)
      ?? text.match(/^([A-Za-z0-9][A-Za-z0-9 _.-]{0,49})\s+-\s+(20\d{2})년까지 계약/);
    if (match && cohort.has(normalizeTransferName(match[1]))) contractYears[normalizeTransferName(match[1])] = Number(match[2]);
  });
  return { version: 1, season, rosters, events: [...new Map(events.map((e) => [e.id, e])).values()], faCandidates, contractYears, sourceUrl, sourceUpdatedAt: $("time[datetime]").first().attr("datetime") ?? null };
}
