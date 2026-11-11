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

## 2026-11-11 웹·iOS 25·Android 41 배포

- 사용자가 빌드와 배포를 요청했고, 범위를 물어 웹 main 반영, iOS와 Android 빌드, Google Play 프로덕션 전체 출시를 각각 확인받았다. 대상 커밋은 `f153340c`다.
- 웹: `dev`를 푸시하고 `main`을 fast-forward했다. 운영 `https://minion.fan`의 경기 API에서 `records` 필드와 승부예측 보드의 프리뷰 링크를 확인했다.
- iOS: EAS Build `2ff8e2e4-cb3f-46c7-95d1-85e3b58ec41b`로 1.0.3(25)를 빌드하고 자동 제출 `615f101c-b738-4862-9d2f-c0a6b386e386`로 App Store Connect 업로드를 마쳤다. App Store 심사 제출은 하지 않았다.
- Android: 로컬 Gradle `:app:bundleRelease`로 1.0.3(41)을 빌드했다(2분 32초). AAB `mobile/store-assets/minion-1.0.3-41.aab`, 82,959,848 bytes, SHA-256 `724d4546053e592fff76a33dcb572d371680f1a1af410363eebaf502be7c9542`. JAR 서명 검증, 업로드 인증서 SHA-256이 기존과 같음(`A3:4D:…:A0:00`), Hermes 번들의 운영 API 포함과 LAN 주소 미포함, 새 화면 문구 포함을 확인했다.
- EAS Submit `eaed382f-8a2c-41a0-885c-7905909284d5`(store-release, 프로덕션, completed)로 Google Play 제출에 성공했다. Play Console의 검토 상태는 확인하지 않았다. EAS 원격 versionCode는 맞추지 않았다.
- 미실행: iPhone과 Android 실기기 확인, 라이트 모드와 웹 1px 캡처 비교.
- iOS 심사 제출: 사용자가 상용 배포와 업데이트 문구를 확인한 뒤, App Store Connect에서 1.0.3에 빌드 25를 붙이고 "이 버전에서 업그레이드된 사항"을 입력해 심사에 제출했다. 상태는 "심사 대기 중"이다. 출시 설정은 기존 값(승인 후 자동 출시, 모든 사용자 즉시, 평가 유지)을 유지했다.
