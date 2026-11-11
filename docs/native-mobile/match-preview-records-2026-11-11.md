# 매치 프리뷰 전적 카드와 순서 동기화 (2026-11-11)

웹 프리뷰 탭(`app/matches/[matchId]/match-preview.tsx`, `match-preview-records.tsx`)의 현재 구성을 앱에 맞춘다.

## 계약 변경

- `MobileMatchPreviewCharts.records`(선택 필드) 추가: `{ headToHead, teams: [teamA, teamB] }`. 타입은 `packages/contracts/src/preview-records.ts`의 `PreviewHeadToHead`, `PreviewTeamRecord`다. 이 필드가 없는 응답에서는 앱이 최근 흐름, 시리즈 흐름 카드와 맞대결 합계를 내지 않는다.
- `preview.meetings`는 최근 5경기에서 6경기로 늘렸다(웹 `meetings.slice(0, 6)`). 합계는 전체 맞대결 기준이다.
- 표본 기준(`RECORD_MIN_SAMPLE`), `recordRate`, 첫 오브젝트 키와 라벨, 경기 시간 표기는 contracts로 옮겨 웹과 앱이 같은 코드를 쓴다. 계산(`buildMatchPreviewRecords`, `buildHeadToHead`)은 서버에서만 하고 API가 웹과 같은 보충 표본으로 호출한다.

## 화면 변경

- `mobile/components/matches/match-preview-tab.tsx`: 웹 순서로 재배치. 승리 확률과 한 줄 평, 관전 포인트, 맞대결, 최근 흐름과 시리즈 흐름, 팀 성향 레이더와 파워랭킹, 첫 드래곤과 진영별 승률, 라인별 골드 격차, 챔피언 우선순위 맵, 리그 간 전력 비교, AI 예측 적중률.
- 웹에서 없앤 표본, 기준 캡션과 AI 브리핑의 기준 날짜를 앱에서도 없앴다. 기준 날짜 자리에 공유 버튼을 둔다(OS 공유 시트, 주소는 `mobileApiOrigin` + `/matches/{id}`).
- `mobile/components/matches/match-preview-records.tsx` 신규: 웹 `MatchRecordCards`의 구조와 수치를 옮겼다.
- `mobile/components/predictions/prediction-match-card.tsx`: 시간 옆에 경기 상세 링크. 예정 경기는 녹색 "프리뷰", 끝난 경기는 회색 "경기 결과", 팀 미정이면 없음. iOS는 승부예측 화면 자체가 없어 해당 없다.

## 검증

- 앱 타입 검사 통과, 린트 오류 없음(기존 경고 2건). 웹 타입 검사와 변경 파일 ESLint 통과.
- 로컬 API 응답에서 `records` 값 확인. Expo Web 390×844 다크에서 카드 순서, 전적 행의 값과 막대, 예측 화면 링크 색을 DOM으로 확인했다.
- 미실행: 라이트 확인, 웹과의 1px 캡처 비교, iPhone과 Android 실기기, 공유 시트 실제 동작. 잠금 파일 변경 없음.
