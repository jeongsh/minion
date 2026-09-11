# 유튜브·인스타그램 수집 운영

## 자동 복구와 감지

- `sync-youtube.yml`: 15분 간격 예약. 공식 YouTube Data API로 최근 7일을 대조해 누락을 보충한다. WebSub와 독립 실행한다. GitHub Actions 예약은 지연될 수 있어 15분 이내 반영을 보장하지는 않는다.
- `renew-youtube-websub.yml`: 매일 구독 갱신. 일시 오류는 한 번 재시도하고, 연속 3개 채널 실패 시 중단하여 장애를 명시한다. 갱신 실패를 성공으로 처리하지 않는다.
- `sync-instagram.yml`: 하루 두 번 공개 게시물 수집. 저장된 세션이 로그인/빈 결과 오류를 내면 로그인 없는 공개 프로필로 한 번 재시도한다. 로그인 확인·빈 피드·HTTP 오류·페이지네이션 실패를 기록한다. 모든 계정이 0건이면 실패다. 비활성화된 스토리는 감시 대상이 아니다.
- `monitor-social.yml`: 수집 작업 종료 직후와 매시간 실행. 최근 실패, 과도하게 지연된 실행, 장시간 정상 실행이 없는 상태를 확인한다. YouTube API 90분, Instagram 30시간, WebSub 36시간이 기준이다. 새 게시물이 없는 정상 채널을 장애로 판단하지 않는다.
- 운영 결과는 GitHub Actions summary와 `social-health` artifact에 저장한다. `DISCORD_SOCIAL_WEBHOOK_URL`을 설정하면 새 장애 발생 시 한 번만 해당 운영 채널에 알린다. 같은 장애가 지속되거나 실패 유형만 바뀌면 재발송하지 않는다. 정상·진행·부분 복구·완전 복구·완료 알림은 보내지 않는다. 정상 복구는 상태에만 저장하고 이후 다시 실패하면 새 장애로 알린다. 미설정 시 Discord 발송은 하지 않는다.
- GPT/Codex 자동 감시는 사용하지 않는다. GitHub Actions가 PC와 무관하게 수집 실패를 감지하고 기존 디스코드 운영 채널에 “연결을 확인하고 다시 연결해 주세요”라는 알림을 보낸다. GPT의 자동 조사·수정·정책 확인은 실행하지 않는다.

## 장애 대응

1. GitHub `2yongtech2/minion`의 네 수집/감시 워크플로 최신 실행과 summary를 확인한다. 성공 배지만 보지 말고 checked/failed/errors와 원본 대비 누락도 확인한다.
2. YouTube WebSub 503 중에도 API 수집이 정상인지 확인한다. API 키/쿼터 오류는 원인을 구분하고 반복 호출을 피한다. 수동 보충은 `node --experimental-strip-types scripts/sync-youtube-videos.ts --recent --no-notify`로 할 수 있다.
3. Instagram 로그인/인증 확인/접근 제한은 오류를 숨기거나 우회하지 않는다. 공개 프로필 재시도 후에도 실패하면 세션 재인증 필요 여부와 응답 형식을 조사한다. 모든 계정이 빈 결과인 경우 성공으로 표시하지 않는다.
   현재 PC에서 공개 프로필이 정상 조회되는 경우 `node --experimental-strip-types scripts/sync-instagram.ts --only=teams --no-notify`로 운영자 확인하에 보충할 수 있다. 이것이 서버 로그인 문제까지 해결했다는 뜻은 아니다. `--no-notify`는 과거 누락분 보충 시 팬 알림을 발송하지 않는다.
4. 수정은 실제 API·DB·사이트 결과로 검증한다. 사용자 작업 파일은 보존한다. 이미 저장된 데이터는 삭제하지 않는다.
5. 스케줄러 자체가 멈추면 같은 스케줄러의 감시도 멈출 수 있다. 필요 시 운영자가 네 워크플로의 마지막 실행 시간을 확인한다.

## 정책·API 변경 확인

- https://developers.google.com/youtube/v3/revision_history
- https://developers.google.com/youtube/terms/revision-history
- https://developers.google.com/youtube/v3/guides/push_notifications
- https://developers.facebook.com/docs/instagram-platform/changelog

문서 변경 자체를 장애로 확정하거나 알림을 보내지 않는다. 현재 수집 방식에 영향을 주는 폐기 일정·인증·요청 한도·정책 변경인지 확인하고 근거와 대응을 상태 파일에 기록한다. 사전 공지 없는 변경도 실제 수집 실패/빈 결과 감지로 확인한다.
