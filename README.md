# LCK Hub

LCK 통합 허브와 팀별 팬 사이트를 하나의 Next.js App Router 프로젝트 안에서 제공하는 MVP입니다.

## 기술 스택

- React
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel 배포 기준 라우팅 및 환경 변수 구조

## 로컬 실행

```bash
npm install
npm run dev
```

Supabase 프로젝트 설정은 `.env.local`에 있습니다.

- `NEXT_PUBLIC_SUPABASE_URL=https://mqmexfcxxtwluiwheqhj.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

앱에서는 publishable key만 사용합니다. `service_role` 키는 공개 클라이언트 코드에 넣으면 안 됩니다.

## Supabase MCP

프로젝트 범위를 고정한 MCP 설정은 `.mcp.json`에 있습니다.

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=mqmexfcxxtwluiwheqhj"
    }
  }
}
```

MCP로 확인한 프로젝트 정보는 다음과 같습니다.

- ref: `mqmexfcxxtwluiwheqhj`
- name: `minion`
- status: `ACTIVE_HEALTHY`
- region: `ap-northeast-1`

새 Codex 세션에서 Supabase 도구가 보이지 않으면, MCP 서버 OAuth 인증을 완료한 뒤 세션을 다시 불러오면 됩니다.

## 라우트

LCK 통합 허브:

- `/`
- `/schedule`
- `/standings`
- `/matches/[matchId]`
- `/matches/[matchId]/sets/[setId]`
- `/teams`
- `/teams/[teamSlug]`
- `/players`
- `/players/[playerSlug]`
- `/stats`
- `/stats/teams`
- `/stats/players`
- `/stats/champions`
- `/stats/form`
- `/stats/fan-ratings`
- `/stats/pom`
- `/community`

팀별 팬 사이트:

- `/fan/[teamSlug]`
- `/fan/[teamSlug]/news`
- `/fan/[teamSlug]/players`
- `/fan/[teamSlug]/matches`
- `/fan/[teamSlug]/community`
- `/fan/[teamSlug]/info`

관리자:

- `/admin`
- `/admin/matches`
- `/admin/sets`
- `/admin/stats`
- `/admin/teams`
- `/admin/players`
- `/admin/ratings`
- `/admin/fan-sites`

## 설계 메모

- `/teams/[teamSlug]`는 LCK 허브 안의 중립적인 팀 상세 페이지입니다.
- `/fan/[teamSlug]`는 팀별 테마가 적용되는 팬 사이트입니다.
- 팬 사이트별 차이는 팀 테마 토큰으로만 주입합니다.
- 팬 평점은 커뮤니티 반응 지표이며 최근 폼과 6각형 계산에서 제외합니다.
- 최근 폼과 6각형 값은 경기 스탯 라인에서만 계산합니다.

## Supabase 스키마

스키마 초안은 `supabase/schema.sql`에 있습니다. 아직 원격 Supabase 프로젝트에는 적용하지 않았습니다.

새 Supabase public 테이블이 Data API에 자동 노출되지 않을 수 있으므로, 스키마에는 명시적인 `GRANT` 문과 RLS 정책을 함께 포함했습니다.
