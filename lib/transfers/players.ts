import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { fetchAuthenticatedLeaguepediaApi } from "../sync/leaguepedia-api.ts";
import { TRANSFER_ROLES, type TransferRole } from "./types.ts";

type PlayerRole = Exclude<TransferRole, "COACH">;
const ROLE_MAP: Record<string, PlayerRole> = { top: "TOP", jungle: "JGL", jgl: "JGL", mid: "MID", middle: "MID", bot: "BOT", bottom: "BOT", adc: "BOT", support: "SUP", sup: "SUP" };
type CargoPlayer = { OverviewPage: string; ID: string; Name: string; Role: string; NationalityPrimary: string; Birthdate: string };
type PlayerRow = { name: string; position: string; real_name: string | null; leaguepedia_page: string | null; source_player_id: string | null };
const PLAYER_FIELDS = "name, position, real_name, leaguepedia_page, source_player_id";

function pageName(input: string) {
  let page = input.trim();
  if (/^https?:\/\//i.test(page)) {
    const url = new URL(page);
    if (url.hostname !== "lol.fandom.com" || !url.pathname.startsWith("/wiki/")) throw new Error("리그피디아 선수 문서 링크를 입력해 주세요.");
    page = decodeURIComponent(url.pathname.slice(6));
  }
  page = page.replace(/_/g, " ").trim();
  if (!page || page.length > 200 || /[\x00-\x1f|]/.test(page)) throw new Error("선수 닉네임 또는 리그피디아 문서명을 확인해 주세요.");
  return page;
}

export async function importTransferPlayer(client: SupabaseClient, input: string) {
  const page = pageName(input);
  const quoted = `'${page.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  const response = await fetchAuthenticatedLeaguepediaApi(new URLSearchParams({
    action: "cargoquery", format: "json", tables: "Players",
    fields: "OverviewPage,ID,Name,Role,NationalityPrimary,Birthdate",
    where: `OverviewPage=${quoted} OR ID=${quoted}`, limit: "10",
  }));
  if (!response.ok) throw new Error(`리그피디아 조회에 실패했습니다 (${response.status}). 잠시 후 다시 시도해 주세요.`);
  const body = await response.json() as { cargoquery?: { title: CargoPlayer }[]; error?: { code?: string } };
  if (body.error || !body.cargoquery) throw new Error("리그피디아 조회를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  const rows = body.cargoquery.map(({ title }) => title);
  const exact = rows.filter((row) => row.OverviewPage.toLowerCase() === page.toLowerCase());
  const matches = exact.length ? exact : rows;
  if (!matches.length) throw new Error("선수를 찾지 못했습니다. 리그피디아 선수 문서명이나 링크를 입력해 주세요.");
  if (matches.length !== 1) throw new Error("같은 닉네임의 선수가 여러 명입니다. 리그피디아 선수 문서 링크를 입력해 주세요.");
  const row = matches[0];
  const position = ROLE_MAP[row.Role?.trim().toLowerCase()];
  if (!position) throw new Error("선수 포지션을 확인할 수 없습니다. 감독과 코치는 이름을 직접 입력해 주세요.");
  const name = row.ID?.trim();
  if (!name || name.length > 50 || !row.OverviewPage) throw new Error("리그피디아 선수 정보가 올바르지 않습니다.");
  const sourceId = `lp:${row.OverviewPage}`;
  const [{ data: existing, error: readError }, { data: bySource, error: sourceError }] = await Promise.all([
    client.from("players").select(PLAYER_FIELDS).ilike("name", name.replace(/[\\%_]/g, "\\$&")),
    client.from("players").select(PLAYER_FIELDS).eq("source_player_id", sourceId).maybeSingle(),
  ]);
  if (readError) throw new Error("기존 선수 정보를 확인하지 못했습니다.");
  if (sourceError) throw new Error("기존 선수 정보를 확인하지 못했습니다.");
  let saved = bySource as PlayerRow | null;
  if (!saved && existing?.length) {
    saved = (existing as PlayerRow[]).find((player) => player.leaguepedia_page === row.OverviewPage) ?? null;
    if (!saved) throw new Error("같은 닉네임의 선수가 이미 등록되어 있습니다. 선수 관리에서 리그피디아 연결을 확인해 주세요.");
  }
  if (!saved) {
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
    const { data, error } = await client.from("players").insert({
      name, slug: `${baseSlug}-${createHash("sha256").update(row.OverviewPage).digest("hex").slice(0, 10)}`,
      real_name: row.Name?.trim() || null, position,
      nationality: row.NationalityPrimary?.trim() || null,
      birth_date: /^\d{4}-\d{2}-\d{2}$/.test(row.Birthdate ?? "") ? row.Birthdate : null,
      leaguepedia_page: row.OverviewPage, source_player_id: sourceId,
      imported_scope: "manual", is_lck_player: false, is_starter: false, team_id: null,
    }).select(PLAYER_FIELDS).single();
    if (error) throw new Error(error.code === "23505" ? "이미 등록된 선수입니다. 새로고침 후 다시 선택해 주세요." : "선수를 저장하지 못했습니다. 다시 시도해 주세요.");
    saved = data as PlayerRow;
  }
  if (!TRANSFER_ROLES.includes(saved.position as PlayerRole)) throw new Error("등록된 선수의 포지션을 선수 관리에서 확인해 주세요.");
  return { name: saved.name, position: saved.position as PlayerRole, keywords: [saved.real_name ?? "", row.OverviewPage].filter(Boolean) };
}
