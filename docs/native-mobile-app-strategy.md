# MINION 네이티브 모바일 앱 전략 — 요약

현재 실행 문서는 [`docs/native-mobile/README.md`](./native-mobile/README.md)다.

## 목표

Expo + React Native 앱에서 기존 웹 모바일의 디자인·정보·동작을 **1px 단위로 동일하게 재현**한다. 앱용 재해석이나 리디자인은 하지 않는다.

## 구조

- 웹/API: 기존 Next.js 유지
- 앱: `mobile/`의 Expo SDK 54 + Expo Router
- DB/Auth/Storage: 기존 Supabase 유지
- 공개 화면 데이터: `/api/mobile/v1/*` 집계 API
- 공용화: DTO, 검증, 포맷, 도메인 로직
- 비공용: 웹 React 컴포넌트와 CSS. 앱에서는 수치와 동작을 React Native로 정확히 번역한다.

## 제품 범위

포함: 홈, 일정, 대회, 승부예측, 경기 상세·라이브·평점, 팀·선수, 팬페이지, 뉴스·소셜·영상, 커뮤니티, 인증·프로필·알림·딥링크.

제외: 관리자 화면, 운영/동기화 도구, 주간 리포트 전체.

## 보안 경계

- 앱에는 publishable key만 포함하며 서버 비밀키를 넣지 않는다.
- 커뮤니티 쓰기, 신고, LP, 업로드 검수, 비회원 처리 등 권한 작업은 Next API를 통과한다.
- Supabase 직접 접근은 인증과 RLS로 제한된 사용자 데이터에만 허용한다.

## 현재 단계

- 완료·잠금: 공통 헤더, 로컬 내비게이션, 독바, 홈, 홈 캘린더, Footer.
- 제로베이스: 그 밖의 모바일 라우트 UI.
- 유지: 모바일 읽기 API, 계약, API client, 캐시.
- 분담: [A — 매치·탐색](./native-mobile/OWNER-A.md), [B — 팀·선수·팬](./native-mobile/OWNER-B.md).

기능 연결만으로 완료 처리하지 않는다. 웹/앱의 390×844 라이트·다크 캡처 비교와 실제 iOS·Android 검증이 필수다.
