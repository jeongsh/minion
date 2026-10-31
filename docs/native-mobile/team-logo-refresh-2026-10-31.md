# 새로고침 후 팀 로고 재시도

2026-10-31 사용자 보고: 증분 동기화로 추가된 경기는 홈에 표시되지만 당겨서 새로고침해도 KC와 MKOI 로고가 보이지 않는다.

## 확인한 사실

- 운영 `/api/mobile/v1/home`은 해당 경기의 `/logos/kc.svg`, `/logos/mkoi.svg` 주소를 반환한다. 두 원본 및 LOS와 HLE 원본은 HTTP 200과 SVG 본문으로 응답했다.
- 연결된 Android 설치본은 versionCode 33, versionName 1.0.2다. APK의 번들에서 SVG 캐시 v1과 로고 다운로드 코드를 확인했다. 저장소는 캐시 v2다.
- 기존 `CachedTeamSvg`의 다운로드 effect는 URL이 바뀔 때만 실행한다. 다운로드 실패 후 API 새로고침으로 같은 URL이 전달되면 effect가 실행되지 않으므로 빈 로고가 계속 유지될 수 있다.
- 기기에 남은 로그에서는 최초 로고 실패 기록을 확보하지 못했다. 이번 보고의 최초 실패 원인은 확정하지 않았다.

## 통합 변경 범위

잠금 공용 로고 `mobile/components/data/team-logo.tsx`의 다운로드 재시도 조건만 수정한다. 웹 근거는 `components/ui/team-logo.tsx`의 동일한 URL과 크기 선택이다. 앱의 `useCachedQuery`는 API 응답을 새 객체로 교체하므로, 새 팀 객체를 받으면 SVG 로드를 다시 실행한다. 성공한 로고는 기존 캐시와 진행 중 요청을 공유하고, 실패한 요청은 같은 URL로 다시 다운로드한다. 오류 로그에는 실패한 URL을 포함한다.

로고 자산, 화면 배치, 테마 선택, API 계약과 홈 파일은 변경하지 않는다. Android 빌드와 기기 설치는 실행하지 않는다.

## 검증

- 실제 컴포넌트와 캐시 모듈을 TypeScript 변환 후 격리 실행했다. 첫 다운로드 실패, 일반 렌더링에서 재요청 없음, 같은 URL의 새 팀 응답에서 복구, 동시 다운로드 공유, 성공 후 캐시 재사용, 28px 크기 유지와 오류 URL 기록을 확인했다.
- `npm.cmd --prefix mobile run typecheck` 통과.
- `npm.cmd --prefix mobile run lint` 오류 없음. 기존 경고 2건 유지.
- `git diff --check` 통과.
- 수정 코드를 설치한 iPhone 및 Android 실기기 검증과 라이트 및 다크 캡처 비교는 미실행이다. 현재 설치본 33에는 이번 변경이 반영되지 않는다.
