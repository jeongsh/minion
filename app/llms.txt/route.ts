import { NextResponse } from "next/server";

import { siteBaseUrl } from "@/lib/site";

// AI 검색과 답변 엔진이 사이트 구성을 파악하도록 주는 안내 문서(llmstxt.org 형식).
// 사이트맵에 올린 공개 경로만 적고, 화면에 실제로 있는 내용만 설명한다.
export function GET() {
  const base = siteBaseUrl();
  const body = `# MINION

> MINION은 LCK(리그 오브 레전드 챔피언스 코리아) 경기 일정과 결과, 경기별 프리뷰, 팬 승부예측, 팀과 선수 기록, 이적시장 소식을 한국어로 제공하는 팬 사이트입니다.

경기 데이터는 Leaguepedia 등 공개 경기 기록을 바탕으로 집계합니다. 경기 프리뷰의 한 줄 평과 관전 포인트는 AI가 작성하며, 전적과 지표는 실제 경기 기록에서 계산합니다. 승부예측은 사이트 안에서만 쓰는 포인트(LP)로 참여하는 팬 참여 기능이고 현금이나 경품으로 바꿀 수 없습니다.

## 경기

- [경기 일정과 결과](${base}/schedule): LCK와 국제 대회의 월별 일정, 결과, 경기별 프리뷰로 가는 링크
- 경기 상세 \`${base}/matches/{경기 ID}\`: 예정 경기는 프리뷰(AI 승리 확률, 한 줄 평, 관전 포인트, 맞대결 전적, 최근 5경기 흐름, 시리즈 스코어 분포, 1세트 승률, 첫 킬과 첫 타워, 첫 전령, 첫 바론 획득률, 진영별 승률, 라인별 15분 골드 격차, 챔피언 우선순위)를, 끝난 경기는 세트별 스코어와 선수 기록, 밴픽, 팬 평가를 보여줍니다. 전체 경기 주소는 [사이트맵](${base}/sitemap.xml)에 있습니다.
- [승부예측](${base}/predictions): 이번 주 경기별 팬 예측 비율과 예측 랭킹

## 팀, 선수, 챔피언

- [팀](${base}/teams): LCK 팀 목록과 팀별 페이지
- [선수](${base}/players): 선수 목록과 선수별 기록
- [챔피언](${base}/champions): 대회에서 쓰인 챔피언 목록과 챔피언별 기록

## 소식

- [이적시장](${base}/transfers): LCK 이적, 계약, 로스터 변동
- [뉴스](${base}/news): LCK 관련 기사 모음

## 안내

- [서비스 소개](${base}/about)
- [고객센터](${base}/support)
`;
  return new NextResponse(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
