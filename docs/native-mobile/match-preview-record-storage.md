# 경기 시작 전 매치 조회 실패 수정

2026-10-23

## 원인

세트가 없는 매치는 앱의 기본 `tab=data` 요청에서도 프리뷰를 조회한다. 웹과 모바일 API는 `supplementMatchBriefingData`를 호출해 요청 중 Leaguepedia 경기, 선수 기록과 타임라인을 보충했다. 생성 작업에서도 같은 자료를 수집했지만 DB에는 AI 문구만 저장했다.

공개 API의 TL vs CFO 예정 경기 조회가 23,528ms 걸렸다. 앱의 `fetchMobileQuery`는 20,000ms에 요청을 중단하므로 화면의 공통 오류 상태가 표시될 수 있다. iOS 전용 오류라는 근거는 확인되지 않았다.

## 변경 계약

- 외부 경기 기록과 공식 파워랭킹은 프리뷰 생성 작업에서 수집한다.
- 기존 `match_ai_previews.content.briefingData` JSON에 원본 경기, 세트, 선수 기록과 파워랭킹을 저장한다. 테이블, RLS와 모바일 v1 응답 구조는 변경하지 않는다.
- 웹 `app/matches/[matchId]/page.tsx`와 모바일 API는 `getStoredMatchBriefingData`로 DB 자료만 조회한다. 프리뷰 미생성 또는 구버전 자료에서도 외부 수집을 시작하지 않는다.
- 저장한 source ID를 기존 병합 함수에 전달하므로 이후 정규 동기화로 생긴 경기와 중복하지 않는다. 누락 지표를 0으로 바꾸지 않는다.
- 경기 ID, 참가 팀과 예정 시각이 다른 자료는 사용하지 않는다.
- 기존 프리뷰에는 생성 lease와 생성 시각 조건을 적용해 수집 자료만 추가한다. AI 문구, 생성 시각과 비용 원장은 바꾸지 않는다.
- 생성 자동화는 기존 프리뷰 자료가 없으면 AI 재호출 없이 보충한다. 일회성 보충 스크립트는 기본 dry run이며 `--write`로 저장하고, 기본 예정 경기 범위를 `--all`로 확장할 수 있다.

## 검증

- 웹과 모바일 타입 검사 통과.
- 모바일 lint 오류 없음. 기존 경고 2건 유지.
- 웹 타이포그래피 검사, 변경 파일 ESLint와 `git diff --check` 통과.
- 저장 자료 JSON 왕복, 통계 복원, 정규 동기화와 중복 방지, 참가 팀과 일정 변경 시 무효화, 조회 경로의 외부 수집 차단을 포함한 관련 회귀 검사 23건 통과.
- 수정된 로컬 API에서 예정 경기, 팀 미정 경기와 완료 경기 모두 HTTP 200 확인.
- 기존 예정 경기 8건의 DB 자료 보충 완료. TL vs CFO는 보충 후 수정된 로컬 API에서 2,670ms에 HTTP 200으로 응답했고 양 팀 최근 5경기와 13/18세트 통계를 확인했다. 변경 전 수치는 운영 API, 변경 후 수치는 로컬 API 측정으로 환경 차이가 있다.
- iPhone 실기기 재검증과 서버 배포는 미실행. 화면 구조와 스타일은 변경하지 않았으며 Android 빌드는 실행하지 않았다.

```powershell
node --env-file=.env.local --experimental-strip-types scripts/backfill-match-briefing-snapshots.ts --write
node --experimental-strip-types --test lib/match-briefing-stats.test.ts lib/match-preview-facts.test.ts lib/match-preview-policy.test.ts
```
