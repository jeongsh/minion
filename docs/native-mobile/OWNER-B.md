# 담당 B — 팀·선수·팬

이 문서 하나를 B 담당의 실행 기준으로 사용한다. 목표는 새 UI 제작이 아니라 **웹 모바일을 1px 단위로 복제**하는 것이다.

## 소유 범위

| 순서 | 앱 파일 | 웹 기준 | 주요 서버/API |
| ---: | --- | --- | --- |
| 1 | `mobile/app/(tabs)/teams.tsx` | `app/teams/page.tsx`, `components/domain/team-card.tsx` | `/api/mobile/v1/teams` |
| 2 | `mobile/app/(tabs)/teams/[teamSlug].tsx` | 팀 목록의 상세 진입과 웹 팬 정보 구조 | `/api/mobile/v1/teams/{slug}` |
| 3 | `mobile/app/(tabs)/players.tsx` | `app/players/page.tsx`, `components/domain/player-directory.tsx` | `/api/mobile/v1/players` |
| 4 | `mobile/app/(tabs)/players/[playerSlug].tsx` | `app/players/[playerSlug]/**` | `/api/mobile/v1/players/{slug}` |
| 5 | `mobile/app/(tabs)/fan/[team]/index.tsx` | `app/fan/[teamSlug]/page.tsx`, `components/fan/**` | 팀 상세 API |
| 6 | `mobile/app/(tabs)/fan/[team]/schedule.tsx` | `app/fan/[teamSlug]/matches/page.tsx` | 팀 일정 데이터 |
| 7 | `mobile/app/(tabs)/fan/[team]/players.tsx` | `app/fan/[teamSlug]/players/**` | 팀 상세 API |
| 8 | `mobile/app/(tabs)/fan/[team]/community.tsx` | `app/fan/[teamSlug]/community/**` | 커뮤니티 API는 계약 후 연결 |
| 9 | `mobile/app/(tabs)/fan/[team]/social.tsx` | `app/fan/[teamSlug]/instagram/page.tsx`, `components/fan/fan-instagram-*` | 팀 상세 API |
| 10 | `mobile/app/(tabs)/fan/[team]/videos.tsx` | `app/fan/[teamSlug]/videos/**`, `components/fan/fan-video-*` | 팀 상세 API |

`mobile/app/(tabs)/fan/index.tsx`는 직접 진입 폴백만 담당한다. 독바의 팬 선택 로직은 수정하지 않는다.

## 절대 구현 규칙

1. 해당 웹 경로를 390×844로 열고 라이트·다크, 로딩·빈 상태·데이터 상태를 캡처한다.
2. 웹 JSX와 CSS/Tailwind 및 브라우저 computed style을 읽어 수치를 기록한 뒤 구현한다.
3. 콘텐츠 순서, 팀 테마, 스와이퍼, 스크롤 위치, 모달, 외부 링크, 활성 탭을 웹과 동일하게 만든다.
4. 폰트 파일·weight·size·line-height, 색상·alpha, padding·gap·border·radius·이미지 비율을 그대로 옮긴다.
5. SVG·팀 로고·아이콘은 웹과 같은 자산을 쓴다. 임의 Lucide 대체나 텍스트 로고는 금지한다.
6. 레이아웃 좌표·크기는 반올림을 포함해 최대 1px 차이만 허용한다. 눈으로만 보고 “비슷하다”고 완료하지 않는다.
7. 동일 데이터·상태의 앱 캡처를 웹 위에 50% 투명도로 겹쳐 차이를 고친다. 라이트·다크 모두 통과해야 한다.
8. 임시 디자인이나 데이터만 연결된 화면을 만들지 않는다. 한 화면을 완성한 뒤 다음 화면으로 간다.

## 팬 탭 불변 동작

- 최애팀이 없으면 팬 독바를 눌러 팀 선택 모달을 연다.
- 모달의 팀 선택은 팬페이지 이동만 수행하고 최애팀을 자동 등록하지 않는다.
- 최애팀 설정·해제는 웹처럼 팬페이지의 별 버튼에서만 한다.
- 최애팀이 있으면 독바에 팀 로고가 표시되고 해당 팬페이지로 이동한다.
- 팬 로컬 탭은 홈·일정·선수·커뮤니티·소셜·영상 순서와 팀 accent를 유지한다.

## 수정 금지

- 홈·Footer: `mobile/app/(tabs)/index.tsx`
- 헤더·로컬 내비: `mobile/components/minion-screen.tsx`
- 독바와 팬 선택 동작: `mobile/components/minion-dock.tsx`
- 홈 캘린더: `mobile/components/home/home-calendar-dialog.tsx`
- A 소유의 매치·탐색 라우트

공통 파일 변경이 필요하면 구현을 우회하지 말고 A와 웹 근거를 공유해 별도 통합 변경으로 합의한다.

## 화면별 완료 기록

각 화면을 끝낼 때 아래 형식으로 PR/작업 기록에 남긴다.

```text
화면:
웹 원본 경로/컴포넌트:
검증 상태: 390×844 light / dark / iOS / Android
최대 레이아웃 차이:
동작 확인: scroll / swipe / modal / navigation / loading / empty / error
의도적으로 남은 차이: 없음 (있으면 완료 아님)
```

마지막에 실행:

```powershell
npm.cmd --prefix mobile run typecheck
npm.cmd --prefix mobile run lint
```
