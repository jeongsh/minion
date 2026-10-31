# iOS IG 로고 반복 표시 수정

2026-10-29 사용자 요청에 따른 팀 자산 잠금 영역의 통합 수정이다.

- 웹 근거는 `components/ui/team-logo.tsx`와 원본 `public/logos/ig.svg`, `ig-white.svg`다. 앱도 같은 API URL을 사용한다.
- 기존 SVG는 rect에 objectBoundingBox pattern을 채우고 use로 내장 PNG를 참조한다. 첨부된 iOS 화면에서는 로고 아래에 이미지 일부가 반복된다. iOS 네이티브 재현은 미실행이며 pattern 렌더링 문제가 유력하다.
- 두 SVG의 pattern과 use를 제거하고 동일한 내장 PNG를 기존 rect 좌표와 크기의 image로 직접 그린다. 원본 PNG 바이트, 240×240 viewBox, 라이트 20/20/200/200 및 다크 20/31/200/178 배치를 보존한다. 로컬 PNG 치환이나 팀별 앱 분기는 추가하지 않는다.
- SVG 저장 캐시 키를 v2로 변경해 기존 24시간 캐시가 수정 전 자산을 재사용하지 않도록 한다. 자산 제공 서버에 수정본이 배포되어야 새 SVG를 받을 수 있다.
- mobile/AGENTS.md가 참조하는 OWNER-B.md는 현재 저장소에 없다. 현재 README와 웹 원본을 실행 기준으로 삼았다.

## 검증

- 모바일 타입 검사 통과. 모바일 린트 오류 없음, 기존 경고 2건 유지. git diff --check 통과.
- 두 SVG의 내장 PNG 바이트 동일성과 pattern/use/rect 제거를 검사했다. Sharp로 24/40/64/240px 렌더링을 실행하고 240px 수정 전후 비교 이미지를 확인했다. 원본 형태와 배치를 유지하며 반복되는 이미지가 없다. 렌더러의 pattern/image 보간 및 투명 픽셀 차이로 픽셀 완전 동일 검사는 통과하지 않았다.
- 브라우저 비교는 Playwright Chromium 미설치와 Edge 실행 실패로 수행하지 못했다. 1440/768/390px 브라우저 비교 및 웹/앱 라이트/다크 1px 비교는 미검증이다.
- iPhone 및 Android 실기기 검증과 빌드, 배포는 실행하지 않았다. 실제 iOS 해결 여부는 배포 후 확인이 필요하다.
