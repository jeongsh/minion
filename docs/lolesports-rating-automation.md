# LoL Esports 세트 종료 감지 및 평점 자동 오픈

검증일: 2026-07-01 (KST)

## 결론

2026년 lolesports.com은 과거 `esports-api.lolesports.com/persisted/gw/*` 대신 자체 GraphQL 프록시를 사용한다. 현재 사이트 번들, APQ manifest, 실제 POST 응답을 대조해 다음 경로를 확인했다.

- Endpoint: `POST https://lolesports.com/api/gql`
- 인증: Cookie, `Authorization`, Riot API key 모두 불필요
- 필수 Header:
  - `Content-Type: application/json`
  - `apollographql-client-name`: 비어 있지 않은 클라이언트 이름
  - `apollographql-client-version`: 비어 있지 않은 버전
- 요청 방식: 자유형 GraphQL은 거부된다. `extensions.persistedQuery.sha256Hash`에 현재 APQ manifest의 operation ID를 보내야 한다.
- `homeEvents` APQ ID (2026-07-01): `7246add6f577cf30b304e651bf9e25fc6a41fe49aeafb0754c16b5778060fc0a`
- 기본 추적 league ID: LCK `98767991310872058`, MSI `98767991325878492`, Worlds `98767975604431411`, First Stand `113464388705111224`

과거 REST gateway는 현재 사이트의 호출 경로가 아니므로 이 구현에서 사용하지 않는다.

## Request

```http
POST /api/gql HTTP/1.1
Host: lolesports.com
Content-Type: application/json
apollographql-client-name: LCKHub Minion
apollographql-client-version: 0.1.0

{
  "operationName": "homeEvents",
  "variables": {
    "hl": "ko-KR",
    "sport": ["lol"],
    "leagues": ["98767991310872058"],
    "eventDateStart": "2026-06-13T00:00:00.000Z",
    "eventDateEnd": "2026-06-15T00:00:00.000Z",
    "eventState": ["unstarted", "inProgress", "completed"],
    "eventType": "match",
    "pageSize": 40
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "7246add6f577cf30b304e651bf9e25fc6a41fe49aeafb0754c16b5778060fc0a"
    }
  }
}
```

`Origin`과 `Referer` 없이도 성공 응답을 확인했다. `apollographql-client-*` 두 헤더를 빼면 `401 No client headers set`이 반환됐다.

## Response 핵심 구조

2026-06-14 LCK T1 3:2 GEN 완료 경기에서 확인한 구조를 필요한 필드만 줄인 예시다.

```json
{
  "data": {
    "esports": {
      "events": [
        {
          "id": "115548128963037587",
          "startTime": "2026-06-14T06:00:00Z",
          "state": "completed",
          "league": { "id": "98767991310872058", "slug": "lck" },
          "matchTeams": [
            { "code": "T1", "result": { "gameWins": 3, "outcome": "win" } },
            { "code": "GEN", "result": { "gameWins": 2, "outcome": "loss" } }
          ],
          "match": {
            "id": "115548128963037587",
            "state": "completed",
            "strategy": { "type": "bestOf", "count": 5 },
            "games": [
              { "id": "115548128963037588", "number": 1, "state": "completed" },
              { "id": "115548128963037589", "number": 2, "state": "completed" },
              { "id": "115548128963037590", "number": 3, "state": "completed" },
              { "id": "115548128963037591", "number": 4, "state": "completed" },
              { "id": "115548128963037592", "number": 5, "state": "completed" }
            ]
          }
        }
      ]
    }
  }
}
```

2026-07-01 실제 라이브 경기에서도 `state: inProgress`, `gameWins: 0/0`, `games[0].state: inProgress` 응답을 확인했다.

## 종료 판정

- 세트 종료: `matchTeams[0|1].result.gameWins` 합계가 이전 DB 합계보다 증가한 경우
- 일관성 확인: 새 스코어 합계와 `match.games[].state === "completed"` 개수가 같을 때만 적용
- 경기 종료: `event.state === "completed"` 또는 `match.state === "completed"`
- 보조 종료 판정: 한 팀 점수가 `floor(bestOf / 2) + 1`에 도달
- 팀 순서: API 배열 순서를 믿지 않고 `code`/`name`을 로컬 팀과 매칭한 뒤 team A/B 점수를 정렬

스코어와 game state 중 하나가 먼저 갱신되는 짧은 구간에는 아무것도 변경하지 않고 다음 1분 Polling에서 재확인한다. 한 팀 점수만 여러 번 증가한 경우(예: 0:0 → 2:0)는 누락 세트를 보정할 수 있다. 양 팀 점수가 함께 증가한 경우(예: 0:0 → 2:1)는 세트별 승자 순서를 API 스코어만으로 확정할 수 없으므로 잘못 기록하지 않고 운영 경고를 남긴다.

## Polling과 Rate Limit

- Supabase Cron(`pg_cron`)이 보호된 Next.js Route를 1분마다 호출한다.
- 오늘 KST 경기 중 `match_date <= now`이고 아직 `completed`가 아닌 경기가 없으면 외부 API를 호출하지 않는다.
- 경기 시작 예정 시각 전에는 DB 조회만 수행하고 LoL Esports API Polling은 하지 않는다.
- lolesports.com 자체 현재 번들은 이벤트가 있을 때 120초, 없을 때 10분 Polling을 사용한다. 이 시스템의 60초는 세트 종료 알림 목적의 보수적인 추가 부하다.
- 공개된 Rate Limit 수치와 `X-RateLimit-*` 응답 헤더는 확인되지 않았다. 내부 비공식 API이므로 할당량을 보장할 수 없다. 이 구현은 모든 LCK 경기를 한 요청으로 조회해 최대 1 request/minute로 제한한다.
- APQ GET 응답에는 CDN 캐시가 개입할 수 있어 구현은 `POST`와 `cache: no-store`를 사용한다.

## Next.js 구조

- `lib/lolesports.ts`: APQ 호출과 응답 타입
- `lib/lolesports-match-matcher.ts`: 팀 매칭, 점수 정렬, 일관성 판정
- `lib/lolesports-rating-automation.ts`: 오늘 경기 조회, 외부 상태 대조, Supabase RPC, Discord outbox 처리
- `app/api/cron/lolesports-ratings/route.ts`: `CRON_SECRET`으로 보호된 Cron Route Handler
- `supabase/migrations/20260702010652_add_lolesports_rating_automation.sql`: 원자적 세트 오픈과 중복 방지
- `supabase/migrations/20260702012441_schedule_lolesports_rating_automation.sql`: Vault, `pg_cron`, `pg_net` 기반 1분 스케줄

DB 함수는 match row를 `FOR UPDATE`로 잠그고, `(match_id, set_number)` unique constraint와 outbox `dedupe_key`를 함께 사용한다. 같은 Cron이 중복 실행돼도 이미 `finished`/`data_synced`인 세트는 다시 열리지 않는다. Discord 전송 실패는 outbox에 남아 다음 실행에서 재시도된다.

## 환경 변수

```text
CRON_SECRET=<16자 이상의 랜덤 문자열>
DISCORD_MATCH_WEBHOOK_URL=https://discord.com/api/webhooks/...
NEXT_PUBLIC_SITE_URL=https://서비스-도메인
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Supabase Vault에는 다음 세 값을 저장한다. 비밀값은 migration 파일에 커밋하지 않는다.

```text
lckhub_automation_url=https://minion-mu-five.vercel.app
lckhub_automation_secret=<Vercel CRON_SECRET와 동일한 값>
lckhub_vercel_bypass=<Vercel Protection Bypass for Automation 값>
```

`lckhub_vercel_bypass`는 Vercel Firewall의 자동화 요청 차단을 통과시키는 전용 비밀값이다. Supabase Cron은 이를 `X-Vercel-Protection-Bypass` Header로 전달하며, 애플리케이션 인증은 별도의 `Authorization: Bearer <CRON_SECRET>` Header가 담당한다.

APQ ID가 변경된 경우에만 아래 값을 추가한다.

```text
LOLESPORTS_HOME_EVENTS_APQ_HASH=<현재 homeEvents operation id>
LOLESPORTS_LEAGUE_IDS=<쉼표로 구분한 league id 목록>
```

## 운영 주의사항

- 이 API는 Riot의 공개 개발자 API가 아니라 lolesports.com 내부 API다. 스키마나 APQ ID 변경 가능성이 있다.
- `PERSISTED_QUERY_NOT_IN_LIST`가 발생하면 현재 사이트의 APQ manifest에서 `homeEvents` ID를 갱신해야 한다.
- 자동 팀 매칭이 실패하면 관리자 경기 편집 화면의 `LoL Esports Match ID`에 `match.id`를 입력해 고정할 수 있다.
- 예정 시각보다 경기가 지연되면 예정 시각부터 `unstarted` 상태를 1분마다 확인한다. 실제 시작을 사전에 알 수 있는 push API는 현재 사이트에서 확인되지 않았다.
- Cron이 세트 두 개 이상 연속 누락돼 양 팀 점수가 모두 증가했다면 관리자 확인이 필요하다. 정상적인 1분 Polling에서는 각 스코어 변경마다 승리 팀을 확정해 `winner_team_id`와 `finished`를 함께 저장한다.
- Vercel Hobby의 Cron 시간 정밀도는 사용하지 않는다. Supabase Free의 `pg_cron`이 HTTP 요청을 생성하고 Vercel은 Route 실행만 담당한다.
- 매분 Route 호출은 월 약 43,200회로 Vercel Hobby의 월 1,000,000 function invocation 한도 안이다. 외부 LoL Esports API는 진행 대상 경기가 있을 때만 호출한다.
- `pg_net` HTTP 요청은 비동기이며 중복·지연 가능성이 있으므로 DB 처리는 반드시 현재처럼 idempotent해야 한다.
