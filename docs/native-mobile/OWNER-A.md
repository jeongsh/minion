# 담당 A — 매치·탐색

이 문서 하나를 A 담당의 실행 기준으로 사용한다. 목표는 새 UI 제작이 아니라 **웹 모바일을 1px 단위로 복제**하는 것이다.

## 소유 범위

| 순서 | 앱 파일 | 웹 기준 | 주요 서버/API |
| ---: | --- | --- | --- |
| 1 | `mobile/app/(tabs)/schedule.tsx` | `app/schedule/page.tsx`, `components/domain/schedule-*` | `/api/mobile/v1/schedule` |
| 2 | `mobile/app/(tabs)/tournaments.tsx` | `app/tournaments/**` | `/api/mobile/v1/tournaments` |
| 3 | `mobile/app/(tabs)/predictions.tsx` | `app/predictions/**`, `components/domain/prediction-*` | 기존 계약 확인 후 연결 |
| 4 | `mobile/app/(tabs)/matches/[matchId].tsx` | `app/matches/[matchId]/**` | `/api/mobile/v1/matches/{id}`, `/live` |
| 5 | `mobile/app/(tabs)/news.tsx` | `app/news/page.tsx`, `components/news/**` | `/api/mobile/v1/news` |
| 6 | `mobile/app/(tabs)/search.tsx` | `components/layout/header-search.tsx`, `app/api/search/route.ts` | `/api/mobile/v1/search` |
| 7 | `mobile/app/(tabs)/community.tsx` | `app/community/page.tsx`, `components/community/community-feed*`, `post-list.tsx` | 커뮤니티 모바일 API는 계약 후 연결 |
| 8 | `mobile/app/(tabs)/champions.tsx`, `mobile/app/(tabs)/champions/[championSlug].tsx` | `app/champions/**`, `components/champions/**` | `/api/mobile/v1/champions`, `/api/mobile/v1/champions/{slug}` |

경기 상세의 하위 세트·라이브·평점 화면이 필요하면 A 범위에서 만든다. 관리 화면은 앱 범위가 아니다.

## 절대 구현 규칙

1. 해당 웹 경로를 390×844로 열고 라이트·다크, 로딩·빈 상태·데이터 상태를 캡처한다.
2. 웹 JSX와 CSS/Tailwind 및 브라우저 computed style을 읽어 수치를 기록한 뒤 구현한다.
3. 콘텐츠 순서, 필터, 스와이퍼, 스크롤 위치, 모달, 외부 링크, 활성 독바를 웹과 동일하게 만든다.
4. 폰트 파일·weight·size·line-height, 색상·alpha, padding·gap·border·radius·이미지 비율을 그대로 옮긴다.
5. SVG·로고·아이콘은 웹과 같은 자산을 쓴다. 임의 Lucide 대체나 텍스트 로고는 금지한다.
6. 레이아웃 좌표·크기는 반올림을 포함해 최대 1px 차이만 허용한다. 눈으로만 보고 “비슷하다”고 완료하지 않는다.
7. 동일 데이터·상태의 앱 캡처를 웹 위에 50% 투명도로 겹쳐 차이를 고친다. 라이트·다크 모두 통과해야 한다.
8. 임시 디자인이나 데이터만 연결된 화면을 만들지 않는다. 한 화면을 완성한 뒤 다음 화면으로 간다.

## 수정 금지

- 홈·Footer: `mobile/app/(tabs)/index.tsx`
- 헤더·로컬 내비: `mobile/components/minion-screen.tsx`
- 독바와 팬 선택 동작: `mobile/components/minion-dock.tsx`
- 홈 캘린더: `mobile/components/home/home-calendar-dialog.tsx`
- B 소유의 팀·선수·팬 라우트

공통 파일 변경이 필요하면 구현을 우회하지 말고 B와 웹 근거를 공유해 별도 통합 변경으로 합의한다.

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
