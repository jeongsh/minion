# 유튜브·인스타그램 수집 운영

## 자동 복구와 감지

- `sync-youtube.yml`: 15분 간격 예약. 공식 YouTube Data API로 최근 7일을 대조해 누락을 보충한다. WebSub와 독립 실행한다. GitHub Actions 예약은 지연될 수 있어 15분 이내 반영을 보장하지는 않는다.
- `renew-youtube-websub.yml`: 6시간마다 구독 갱신. 일시 오류는 5·10·20초 간격으로 최대 세 번 재시도하고 (Retry-After는 최대 60초까지 준수, 더 길면 다음 실행으로 넘김), 연속 3개 채널 실패 시 중단하여 장애를 명시한다. 갱신 실패를 성공으로 처리하지 않는다.
- `sync-instagram.yml`: KST 10시와 22시에 Meta Graph API v26.0 Business Discovery로 게시물을 확인한다. `lib/scraper/instagram-graph.ts`의 검증된 선수 15명과 팀 10개만 수집한다. 나머지 계정은 요청 전에 제외하며 브라우저/쿠키 fallback은 없다. 사진, 릴스 썸네일, 캐러셀 첫 이미지를 기존 DB/R2 저장 경로로 전달한다. 기존 브라우저 수집과 같은 `/p/{shortcode}/` 키로 중복을 방지한다. 인증·권한·요청 제한 오류는 즉시 중단하고, 계정 오류도 실패 summary에 기록한다. 스토리는 수집하지 않는다.
- `check-instagram-session.yml`: 이름은 `Instagram API check`이며 공식 API 조회만 검증한다. `--check-api --username=t1lol`로 실행하며 DB/R2 저장 및 팬 알림은 하지 않는다. 수동 점검 워크플로도 기존 장애 감시 정책을 따른다.
- `monitor-social.yml`: 수집 작업 종료 직후와 매시간 실행. 최근 실패, 과도하게 지연된 실행, 장시간 정상 실행이 없는 상태를 확인한다. YouTube API 90분, Instagram 30시간, WebSub 36시간이 기준이다. 새 게시물이 없는 정상 채널을 장애로 판단하지 않는다.
- 운영 결과는 GitHub Actions summary와 `social-health` artifact에 저장한다. 장애가 1시간 뒤에도 복구되지 않았을 때 Discord로 한 번 알리며, 같은 장애가 지속되는 동안 중복 발송하지 않는다. 정상·진행·복구·완료 알림은 보내지 않는다. 비활성 워크플로는 제외한다. `DISCORD_SOCIAL_WEBHOOK_URL` 미설정 시 Discord 발송은 하지 않는다.
- GPT/Codex 자동 감시는 사용하지 않는다. GitHub Actions가 PC와 무관하게 수집 실패를 감지하고 기존 디스코드 운영 채널에 “연결을 확인하고 다시 연결해 주세요”라는 알림을 보낸다. GPT의 자동 조사·수정·정책 확인은 실행하지 않는다.

## 장애 대응

1. GitHub `2yongtech2/minion`의 네 수집/감시 워크플로 최신 실행과 summary를 확인한다. 성공 배지만 보지 말고 checked/failed/errors와 원본 대비 누락도 확인한다.
2. YouTube WebSub 503 중에도 API 수집이 정상인지 확인한다. API 키/쿼터 오류는 원인을 구분하고 반복 호출을 피한다. 수동 보충은 `node --experimental-strip-types scripts/sync-youtube-videos.ts --recent --no-notify`로 할 수 있다.
3. Instagram은 공식 API 인증과 응답 상태를 확인한다.
   - `.env.local` 및 GitHub Actions Secrets에 `INSTAGRAM_GRAPH_ACCESS_TOKEN`, `INSTAGRAM_GRAPH_USER_ID`가 필요하다. Graph API Explorer의 단기 토큰을 예약 수집에 사용하지 않는다. 장기 토큰의 실제 만료일을 확인하고 만료 전에 재발급해 갱신한다. 계정 연결 해제나 권한 철회로 조기 만료될 수도 있다. 값은 로그·커밋에 남기지 않는다.
   - `node --experimental-strip-types scripts/sync-instagram.ts --check-api --username=t1lol`로 API 연결을 확인한다. `--dry-run --max-posts=2`는 대상 전체를 DB 쓰기 없이 검사한다.
   - 실제 수집에서 `healthy=25`, `errors=0`, `checked`와 DB 결과를 확인한다. 대상 추가는 Business Discovery와 미디어 조회를 검증한 뒤 allowlist에 반영한다. Teddy는 프로필만 확인됐으므로 현재 제외한다.
   - 초기 복구는 `--no-notify` 또는 수동 실행의 `no_notify=true`를 사용한다. 예약 실행은 기존 새 게시물 알림 동작을 유지한다.
   - `INSTAGRAM_GRAPH_STOP`의 code=190은 토큰 오류, code=10/200은 권한 오류이며, HTTP 429 또는 code=4/17/32/613은 요청 제한이다. code=110/2207013만으로 개인 계정·삭제·연령 제한을 단정하지 않는다.
4. 수정은 실제 API·DB·사이트 결과로 검증한다. 사용자 작업 파일은 보존한다. 이미 저장된 데이터는 삭제하지 않는다.
5. 스케줄러 자체가 멈추면 같은 스케줄러의 감시도 멈출 수 있다. 필요 시 운영자가 네 워크플로의 마지막 실행 시간을 확인한다.

## 정책·API 변경 확인

- https://developers.google.com/youtube/v3/revision_history
- https://developers.google.com/youtube/terms/revision-history
- https://developers.google.com/youtube/v3/guides/push_notifications
- https://developers.facebook.com/docs/instagram-platform/changelog

문서 변경 자체를 장애로 확정하거나 알림을 보내지 않는다. 현재 수집 방식에 영향을 주는 폐기 일정·인증·요청 한도·정책 변경인지 확인하고 근거와 대응을 상태 파일에 기록한다. 사전 공지 없는 변경도 실제 수집 실패/빈 결과 감지로 확인한다.

## 반복 알림 및 페이지네이션 보정

- 감시 작업은 제공자별 장애 상태가 처음 발생하거나 바뀔 때만 실패한다. 같은 장애가 계속되면 경고와 summary/artifact를 유지하면서 감시 실행은 성공한다. 감시 성공과 수집 복구는 다르다. 정상 수집 후 같은 장애가 재발하면 다시 실패한다. 캐시가 소실되면 최초 알림이 다시 발생할 수 있다.
- Instagram 공식 API가 반환한 미디어 커서로 다음 페이지를 조회한다. 중복·비정상 커서는 실패 처리하며 Graph API의 `next` URL에 포함될 수 있는 토큰은 로그에 출력하지 않는다. 계정 사이 간격은 5초다.
