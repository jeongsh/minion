"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminActionClient } from "@/lib/auth/admin";
import { syncTransferMarket } from "@/lib/transfers/sync";
import { syncTransferTeams } from "@/lib/transfers/teams";
import { lckTeamCode, normalizeTransferName, TRANSFER_KIND_LABELS, TRANSFER_ROLES, transferSeason, type TransferEvent, type TransferMarket } from "@/lib/transfers/types";

function refresh() { revalidatePath("/transfers"); revalidatePath("/admin/transfers"); }

export async function syncTransfersAction(season: number) {
  const client = await createSupabaseAdminActionClient();
  if (!Number.isInteger(season) || season < 2026 || season > transferSeason()) return { error: "지원하지 않는 스토브리그 연도입니다.", message: "" };
  const messages: string[] = [], errors: string[] = [];
  try {
    const result = await syncTransferMarket(client, { season });
    messages.push(result.skipped ? "최근 나무위키 동기화가 완료되었습니다." : result.changed ? "나무위키 변경 내용을 반영했습니다." : "나무위키에 새 변경 내용이 없습니다.");
  } catch (error) { errors.push(error instanceof Error ? error.message : "나무위키 동기화에 실패했습니다."); }
  try {
    const result = await syncTransferTeams(client, season);
    messages.push(result.created ? `해외팀 ${result.created}개를 등록했습니다.` : "해외 주요 리그 팀 목록을 확인했습니다.");
    if (result.unresolved.length) errors.push(`Leaguepedia에서 확인하지 못한 팀: ${result.unresolved.join(", ")}`);
  } catch (error) { errors.push(error instanceof Error ? error.message : "해외팀 동기화에 실패했습니다."); }
  refresh(); revalidatePath("/teams"); revalidatePath("/admin/teams");
  return { message: messages.join(" "), error: errors.length ? [...messages, ...errors].join(" ") : null };
}

export async function setTransferAutoSyncAction(season: number, enabled: boolean) {
  const client = await createSupabaseAdminActionClient();
  if (!Number.isInteger(season) || typeof enabled !== "boolean") throw new Error("잘못된 요청입니다.");
  const { data, error } = await client.from("lck_transfer_markets").update({ auto_sync: enabled }).eq("season", season).select("season");
  if (error || !data?.length) throw new Error("먼저 문서를 동기화해 주세요.");
  refresh();
}

export async function saveTransferEventAction(form: FormData) {
  const client = await createSupabaseAdminActionClient();
  const value = (key: string) => String(form.get(key) ?? "").trim();
  const season = Number(value("season"));
  const kind = value("kind") as TransferEvent["kind"], role = value("role") as TransferEvent["role"];
  const provenance = value("provenance") as TransferEvent["provenance"];
  const player = value("player"), from = value("from"), date = value("date"), sourceUrl = value("sourceUrl");
  let to = value("to");
  const toTeamId = value("toTeamId");
  if (toTeamId) {
    if (!/^[0-9a-f-]{36}$/i.test(toTeamId)) return { error: "새 팀을 다시 선택해 주세요." };
    const { data: team, error: teamError } = await client.from("teams").select("name").eq("id", toTeamId).single();
    if (teamError || !team) return { error: "새 팀을 다시 선택해 주세요." };
    to = team.name;
  }
  if (!Number.isInteger(season) || season < 2026 || season > transferSeason() || !Object.hasOwn(TRANSFER_KIND_LABELS, kind) || ![...TRANSFER_ROLES, "COACH"].includes(role) || !["official", "report", "namuwiki"].includes(provenance)) return { error: "입력 항목을 확인해 주세요." };
  if (!player || player.length > 50 || from.length > 100 || to.length > 100 || !from || (["transfer", "loan", "renew", "promote", "demote"].includes(kind) && !to)) return { error: "선수와 이전 팀, 새 팀을 확인해 주세요." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || Number(date.slice(0, 4)) < season - 1 || Number(date.slice(0, 4)) > season + 1) return { error: "발표일을 확인해 주세요." };
  try { const url = new URL(sourceUrl); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); } catch { return { error: "출처의 HTTPS 링크가 필요합니다." }; }
  const { data, error } = await client.from("lck_transfer_markets").select("*").eq("season", season).single();
  if (error) return { error: "먼저 문서를 동기화해 주세요." };
  const market = data as TransferMarket;
  const original = [...market.snapshot.events, ...market.manual_events].find((e) => e.id === value("id"));
  if (to && !toTeamId && (!original || original.to !== to)) return { error: "등록된 팀에서 새 팀을 선택해 주세요." };
  const known = market.snapshot.rosters.some((r) => r.slots.some((s) => s.previous.some((p) => normalizeTransferName(p.name) === normalizeTransferName(player)))) || [...market.snapshot.events, ...market.manual_events].some((e) => normalizeTransferName(e.player) === normalizeTransferName(player));
  if (!lckTeamCode(from) && !lckTeamCode(to) && !known) return { error: "LCK 합류, 이탈 또는 이번 시즌 추적 선수만 등록할 수 있습니다." };
  const id = value("id") || `manual:${randomUUID()}`;
  if (value("id") && ![...market.snapshot.events, ...market.manual_events].some((e) => e.id === id)) return { error: "수정할 기록을 찾지 못했습니다." };
  const contractUntil = value("contractUntil") || null;
  if (contractUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(contractUntil) || !Number.isFinite(Date.parse(contractUntil)) || new Date(contractUntil).toISOString().slice(0, 10) !== contractUntil || contractUntil < date)) return { error: "계약 종료일을 확인해 주세요." };
  if (["leave", "retire", "inactive"].includes(kind) && to) return { error: "계약 종료, 은퇴, 휴식은 새 팀을 비워 주세요." };
  if (kind === "renew" && (lckTeamCode(from) ?? normalizeTransferName(from)) !== (lckTeamCode(to) ?? normalizeTransferName(to))) return { error: "재계약은 이전 팀과 새 팀이 같아야 합니다." };
  const event: TransferEvent = { id, player, realName: original?.realName ?? "", role, kind, from, to, date, contractUntil, sourceUrl, references: [], provenance };
  const events = [...market.manual_events.filter((e) => e.id !== id), event];
  const { data: updated, error: updateError } = await client.from("lck_transfer_markets").update({ manual_events: events }).eq("season", season).eq("manual_events", JSON.stringify(market.manual_events)).select("season");
  if (updateError || !updated?.length) return { error: "다른 관리 작업과 겹쳤습니다. 새로고침 후 다시 저장해 주세요." };
  refresh(); return { error: null };
}

export async function removeTransferOverrideAction(season: number, id: string) {
  const client = await createSupabaseAdminActionClient();
  if (!Number.isInteger(season) || typeof id !== "string" || id.length > 150) throw new Error("잘못된 요청입니다.");
  const { data, error } = await client.from("lck_transfer_markets").select("manual_events").eq("season", season).single();
  if (error) throw new Error("기록을 읽지 못했습니다.");
  const previous = data.manual_events as TransferEvent[];
  const { data: updated, error: updateError } = await client.from("lck_transfer_markets").update({ manual_events: previous.filter((e) => e.id !== id) }).eq("season", season).eq("manual_events", JSON.stringify(previous)).select("season");
  if (updateError || !updated?.length) throw new Error("다른 관리 작업과 겹쳤습니다. 새로고침 후 다시 시도해 주세요.");
  refresh();
}
