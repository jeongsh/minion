import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getAllTeams, getMatchById, getTournaments } from "@/lib/data/lck";
import { getPredictionMarketData, predictionMarketForMatch } from "@/lib/predictions";
import { siteBaseUrl } from "@/lib/site";
import type { Team } from "@/lib/types";

// 공유 카드는 기본 내장 글꼴(라틴 문자)만 쓴다. 팀 약칭, 대회명, 스코어, 날짜가 모두 영문과 숫자라
// 한글 글꼴을 따로 내려받지 않아도 되고, 한글 설명은 og:title과 og:description이 맡는다.
export const alt = "MINION match card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// 스코어와 예측 비율이 바뀌므로 오래 굳히지 않는다.
export const revalidate = 600;

const BACKGROUND = "#141517";
const INK = "#ffffff";
const MUTED = "#9aa0aa";
const TRACK = "#2a2d33";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstLabel(iso: string) {
  const date = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} KST`;
}

/** 어두운 배경에서 보이지 않는 팀 색은 밝은 중립색으로 바꾼다. */
function barColor(team: Team | undefined) {
  const color = team?.primaryColor;
  if (!color || !/^#[\da-f]{6}$/i.test(color)) return "#6b7280";
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.1 ? "#e5e7eb" : color;
}

const IMAGE_TYPES: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

/** public 아래 이미지를 data URI로 읽는다. 배포 환경에 파일이 없으면 사이트 주소에서 받고, 그래도 없으면 글자만 그린다. */
async function publicImage(path: string | undefined | null): Promise<string | null> {
  if (!path || !path.startsWith("/")) return null;
  const type = IMAGE_TYPES[path.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return null;
  try {
    const data = await readFile(join(process.cwd(), "public", ...path.split("/").filter(Boolean)));
    return `data:${type};base64,${data.toString("base64")}`;
  } catch {
    try {
      const response = await fetch(new URL(path, siteBaseUrl()), { signal: AbortSignal.timeout(4000) });
      if (!response.ok) return null;
      return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
    } catch {
      return null;
    }
  }
}

function TeamBlock({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 340 }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={logo} width={180} height={180} style={{ objectFit: "contain" }} />
      ) : (
        <div style={{ display: "flex", width: 180, height: 180 }} />
      )}
      <div style={{ display: "flex", marginTop: 20, fontSize: 64, color: INK }}>{name}</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const match = await getMatchById(matchId);

  const [teams, tournaments, market, brandLogo] = await Promise.all([
    getAllTeams(),
    getTournaments(),
    match ? getPredictionMarketData(undefined, match.id).catch(() => null) : Promise.resolve(null),
    publicImage("/logo.svg"),
  ]);
  const teamA = match ? teams.find((team) => team.id === match.teamAId) : undefined;
  const teamB = match ? teams.find((team) => team.id === match.teamBId) : undefined;
  const logoPath = (team: Team | undefined) => team?.logoWhiteUrl || team?.logoUrl;
  const [logoA, logoB] = await Promise.all([publicImage(logoPath(teamA)), publicImage(logoPath(teamB))]);

  const tournamentName = (match && tournaments.find((item) => item.id === match.tournamentId)?.name) || "LCK";
  const hasScore = Boolean(match) && (match!.teamAScore !== null || match!.teamBScore !== null);
  const prediction = match && market
    ? predictionMarketForMatch(
        market.bets.filter((bet) => match.status === "completed" || bet.status !== "refunded"),
        match.id,
        match.teamAId,
        match.teamBId,
        match.status === "completed",
      )
    : null;
  const showPrediction = Boolean(prediction && prediction.totalStake > 0);

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: BACKGROUND, padding: "56px 64px", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 36, color: INK }}>{tournamentName}</div>
            {match ? <div style={{ display: "flex", marginTop: 6, fontSize: 26, color: MUTED }}>{kstLabel(match.matchDate)}</div> : null}
          </div>
          {brandLogo ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={brandLogo} width={171} height={39} />
          ) : (
            <div style={{ display: "flex", fontSize: 36, color: "#03DE8A" }}>minion</div>
          )}
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <TeamBlock name={teamA?.shortName ?? "TBD"} logo={logoA} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 360 }}>
            {hasScore ? (
              <div style={{ display: "flex", alignItems: "center", fontSize: 150, color: INK }}>
                <div style={{ display: "flex" }}>{match!.teamAScore ?? 0}</div>
                <div style={{ display: "flex", margin: "0 28px", fontSize: 90, color: MUTED }}>:</div>
                <div style={{ display: "flex" }}>{match!.teamBScore ?? 0}</div>
              </div>
            ) : (
              <div style={{ display: "flex", fontSize: 96, color: MUTED }}>VS</div>
            )}
          </div>
          <TeamBlock name={teamB?.shortName ?? "TBD"} logo={logoB} />
        </div>

        {showPrediction ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 120, fontSize: 40, color: INK }}>{prediction!.teamAPercent}%</div>
            <div style={{ display: "flex", flex: 1, height: 20, borderRadius: 10, overflow: "hidden", background: TRACK }}>
              <div style={{ display: "flex", width: `${prediction!.teamAPercent}%`, height: "100%", background: barColor(teamA) }} />
              <div style={{ display: "flex", flex: 1, height: "100%", marginLeft: prediction!.teamAPercent > 0 && prediction!.teamBPercent > 0 ? 6 : 0, background: barColor(teamB) }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", width: 120, fontSize: 40, color: INK }}>{prediction!.teamBPercent}%</div>
          </div>
        ) : (
          <div style={{ display: "flex", height: 20 }} />
        )}
      </div>
    ),
    { ...size },
  );
}
