# 모바일 일정과 대회 필터

## 변경

- 웹 일정은 모바일 상단 드롭다운을 숨기고 기존 주간 날짜 바, 캘린더 버튼, 필터 버튼과 시트를 복원했다. 앱 일정은 이미 같은 구성이어서 유지했다.
- 웹과 앱 대회는 우측 하단 필터 버튼에서 연도, 대회, 시즌 구간과 세부 단계를 선택한다. POM, 순위, 플레이인, 플레이오프와 로드 투 MSI를 모두 노출한다.
- 본문 제목에는 현재 대회, 시즌 구간, 단계와 보기 방식을 표시한다. 예: `Worlds 스위스 대진표`, `LCK 3-4라운드 POM 순위`.
- PC의 상단 드롭다운은 유지하고 LCK 상세 탭을 복원했다.
- 잠금 파일과 폰트, 번들 자산은 변경하지 않았다. 앱 모달은 기존 BottomSheet 경로를 사용한다.
- 앱 POM과 순위는 웹과 같은 표 헤더, 열, 48px 행으로 맞췄다. 일정과 대회 시트는 웹에 맞는 16px 패딩과 버튼 크기를 사용한다.
- Worlds 스위스는 웹과 앱이 같은 서버 계산과 공용 배치 상수를 사용한다. 플레이인과 토너먼트는 단계 이름과 BO 정보를 맞췄다.

## 웹 근거와 앱 대응

| 웹 | 앱 |
| --- | --- |
| `app/schedule/page.tsx`, `schedule-filters.tsx` | 기존 `schedule.tsx`와 크기를 맞춘 `schedule-filter-sheet.tsx` |
| `app/tournaments/[segment]/page.tsx`, `tournament-filters.tsx` | `mobile/app/(tabs)/tournaments.tsx`, `tournament-filter-sheet.tsx` |
| AdaptiveDialog의 필터 링크 선택 후 닫기 | BottomSheet에서 선택 콜백과 닫기 |
| URL의 year, split, phase, view, bracketStage | 같은 필터를 모바일 API 쿼리로 전달 |
| getLckDefaultView, selectLckPomPointMatches, groupWorldsStages | 모바일 API가 같은 함수 사용 |

## API 영향

후속 웹 일치 작업은 기존 필드를 유지하면서 선택적 `swissBracket`, `worldsPhase`, 경기의 `bestOf`를 추가한다. 앱의 스위스 대진표는 웹과 같은 서버 계산 결과와 공용 좌표 상수를 사용하며 구버전 앱은 추가 필드를 무시할 수 있다.

`/api/mobile/v1/tournaments/[segment]`의 응답 필드는 유지했다. LCK 기본 화면과 정규시즌 누적 POM 범위를 웹과 통일했다. Worlds의 `bracketStages`와 `activeBracketStageId`는 `playin`, `swiss`, `knockout`을 사용한다. 기존 스테이지 ID로 요청해도 해당 단계로 매핑한다. 데이터 조회와 권한 경로는 기존 서비스를 유지한다.

## 검증

- 웹과 앱 타입 검사 통과.
- 웹 변경 파일 ESLint, 타이포그래피 검사 통과.
- 앱 lint는 오류 없음. 기존 경고 2건은 community-directory-nav와 schedule-match-list에 남아 있다.
- 키보드 계약 검사 4건 통과. 모바일 API 계약 검사는 4건 통과, 기존 경기 상세 인증의 `optional`을 `public`으로 기대하는 1건 실패다. 인증 코드는 변경하지 않았다.
- 로컬 API에서 LCK 컵 POM, 1-2라운드 로드 투 MSI, 3-4라운드 플레이인, Worlds 스위스와 토너먼트 선택을 확인했다.
- 390×844 웹에서 일정의 주간 바와 하단 버튼, 필터 모달, 대회 전환, POM 전환과 모달 닫힘을 확인했다. Expo Web에서도 대회 모달과 POM 전환을 확인했다.
- 라이트와 다크 캡처: `artifacts/mobile-filters-2026-10-19/`. 필터와 POM은 웹/Expo Web 양쪽을 저장했다.

## 남은 검증

- 연결된 Android 기기가 없고 iPhone 실행 환경이 없어 실기기 스크롤, safe area와 뒤로가기 확인은 미실행이다.
- 390×844 Expo Web에서 표, 필터 시트와 스위스 대진표를 라이트와 다크로 확인했다. 데스크톱 브라우저의 웹 스크롤바 폭과 기존 잠금 영역의 헤더 차이가 있어 전체 화면의 네이티브 1px 일치 판정은 완료하지 않았다.
