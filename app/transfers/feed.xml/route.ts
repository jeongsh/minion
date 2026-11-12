import { getTransferMarket } from "@/lib/transfers/data";
import { recentTransferEvents, transferEventHeadline } from "@/lib/transfers/seo";
import { marketEvents, transferArticleUrl, transferMarketUpdatedAt, transferSeason } from "@/lib/transfers/types";
import { siteBaseUrl } from "@/lib/site";

// 관리자 저장 시 revalidatePath로 즉시 갱신하고, 원문 동기화 반영을 위해 10분마다 다시 만든다.
export const revalidate = 600;

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]!);
}

/** 네이버 서치어드바이저·구글에 제출하는 이적시장 RSS. 사이트 화면에는 노출하지 않는다. */
export async function GET() {
  const baseUrl = siteBaseUrl();
  const pageUrl = `${baseUrl}/transfers`;
  const market = await getTransferMarket().catch(() => null);
  const season = market?.season ?? transferSeason();
  const items = market ? recentTransferEvents(marketEvents(market), 50) : [];

  const itemXml = items.map(({ event, time }) => {
    const title = transferEventHeadline(event);
    const article = transferArticleUrl(event);
    const description = [
      `${season} LCK 스토브리그 ${title}.`,
      event.contractUntil ? `계약 기간 ${event.contractUntil}까지.` : "",
      article ? `출처: ${article}` : "",
    ].filter(Boolean).join(" ");
    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(pageUrl)}</link>
      <guid isPermaLink="false">${escapeXml(`minion-transfer:${season}:${event.id}`)}</guid>
      <pubDate>${new Date(time).toUTCString()}</pubDate>
      <category>${escapeXml(event.provenance === "rumor" ? "루머" : event.provenance === "report" ? "거피셜" : "오피셜")}</category>
      <description>${escapeXml(description)}</description>
    </item>`;
  }).join("\n");

  const lastBuild = market ? new Date(transferMarketUpdatedAt(market)).toUTCString() : new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`LCK 이적시장 실시간 ${season} 스토브리그 | MINION`)}</title>
    <link>${escapeXml(pageUrl)}</link>
    <atom:link href="${escapeXml(`${baseUrl}/transfers/feed.xml`)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(`${season} LCK 스토브리그 오피셜·거피셜·루머 이적 소식을 실시간으로 전합니다.`)}</description>
    <language>ko</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${itemXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600",
    },
  });
}
