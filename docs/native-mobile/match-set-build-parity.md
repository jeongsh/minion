# 세트 통계·선수 빌드 앱 대응

## 계약과 책임

- `/api/mobile/v1/matches/{matchId}?tab=data`의 `activeSet.playerBuilds`를 추가한다. 기존 캐시와 서버 배포 순서를 고려해 optional 필드이며 기존 응답 필드는 유지한다.
- `MobileChampionRef.slug`를 optional로 추가해 웹 초상화의 챔피언 상세 이동을 대응한다. 이전 캐시에 slug가 없으면 이동만 비활성화한다.
- 웹과 동일하게 `getPlayerBuildEvents`, `buildPlayerLoadoutTimeline`, `fetchFullRuneTrees`, `buildRuneBuildGrid`, `buildEmptyRuneBuildGrid`, `fetchChampionAbilityIcons`를 서버에서 사용한다. 앱은 가공 결과를 렌더링하며 DB를 직접 조회하지 않는다.
- 기존 경기 slug 경로에서도 세트를 조회할 수 있도록 `getMatchById`의 반환 ID로 `getSetsByMatchId`를 호출한다.
- 구매 취소·판매 취소, 10초 구매 묶음, 스킬 순서 계산은 기존 공용 함수를 그대로 사용한다. 스키마·권한·인증 변경은 없다.

## UI 대응

- 웹 `PlayerStatTable` → 앱 `MatchPlayerStatTable`: 제목 오른쪽 기본/통계 버튼, 같은 행 높이·초상화·이름, 통계의 스펠/룬 숨김, 모바일 DPM, 태블릿 KDA 열.
- 웹 `PlayerBuildPanel` → 앱 `MatchPlayerBuildPanel`: 양 팀 선수 선택, 룬 전체 트리와 파편, 구매 시점과 판매 표시, 1~18레벨 스킬 표. 세트·선수 변경 시 웹과 같은 선택 ID 유지 및 첫 선수 fallback.
- 웹 최신 룬 크기(36/30/28px, 640px 이상 40/34/32px)와 열 비율 1.2:1을 적용한다.
- 스킬 표는 웹처럼 내부 가로 스크롤을 사용한다. 구매 묶음은 줄바꿈한다.
- 캐시 유지·재시도는 기존 `useCachedQuery` 경로를 사용한다. 룬/구매 데이터가 없으면 웹과 같은 비선택 슬롯을 표시한다.

## 검증 기록

- 실제 HLE–T1 결승 1세트 API에서 10명 모두 룬 4행, 구매 묶음 17~30개, 스킬 레벨 16~18개 확인.
- Expo Web 390×844에서 실제 선수 통계 전환 및 선수 빌드 선택 확인. 기본/통계 행 높이 58/59px, 초상화 40px.
- 768px 기본/통계 행 높이 68/69px, 초상화 48px 확인. 테마와 화면 폭을 바꾼 뒤 재전환해 열 정렬 확인.
- 2세트 변경 시 T1/HLE 진영 및 럼블·판테온 등 챔피언 변경 확인. 스킬 표 가로 스크롤로 18레벨 접근 확인.
- 웹/Expo Web 라이트·다크 캡처를 대화 실행 기록에 남겼다. 웹 스크롤바와 기존 셸 여백 차이가 있어 전체 화면 좌표의 1px 일치는 통과로 판정하지 않는다.
- 웹/앱 타입 검사, 타이포그래피 검사, 변경 서버 파일 ESLint, diff 공백 검사 통과. 앱 린트 오류 없음(기존 다른 화면 경고 2건).
- Android·iOS Hermes 번들 export 검증. 배포용 APK/IPA 생성 또는 스토어 업로드는 하지 않는다.
- 네이티브 실기기 검증은 아직 미실행. 연결된 Android 기기가 없고 iPhone 실행 환경도 없어 iPhone/Android Expo Go의 스크롤·뒤로가기·safe area 및 네이티브 1px 완료 판정은 보류한다.
- 잠금 영역 파일은 수정하지 않는다. 기존 공용 셸의 웹/앱 차이는 이번 변경 범위에 포함하지 않는다.
