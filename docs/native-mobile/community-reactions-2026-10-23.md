# 앱 게시글과 댓글 반응 즉시 반영

- 웹 원본은 `components/community/reaction-buttons.tsx`다. 추천, 취소, 비추천 전환 시 선택 상태와 양쪽 개수를 먼저 변경하고, 저장 실패 시 직전 값으로 복원한다.
- 앱의 `mobile/components/community/community-post-screen.tsx`에 같은 동작을 적용했다. 게시글, 댓글, 답글의 반응 버튼이 처리 로직을 공유한다. 대상별 처리 중 재입력을 차단하고 비활성 접근성 상태를 제공한다.
- 기존 모바일 반응 API와 인증, 비회원 식별 계약을 유지했다. 성공 응답의 `state`, `honorCount`, `dislikeCount`를 반영한 뒤 기존 캐시 갱신을 유지한다. 응답 후 재조회가 진행되는 동안 즉시 반영한 값이 이전 값으로 돌아가지 않도록 한다.
- 레이아웃, 아이콘, 글꼴, 간격과 잠금 파일은 변경하지 않았다. 기존 실패 알림을 유지한다.

## 검증

- 앱 타입 검사 통과. 앱 린트는 오류 없이 기존 경고 2개가 남는다.
- 비회원 커뮤니티 계약과 키보드 계약 총 8개 통과.
- 실제 반응 버튼 함수를 추출해 React Native Web으로 렌더링한 격리 검사 24개 통과. 게시글과 댓글 각각의 추천, 취소, 전환, 지연 성공, 실패 복원과 중복 요청 차단을 확인했다. 서버 집계 보정과 후속 캐시 데이터 동기화도 확인했다.
- 실제 API 저장은 호출하지 않았다. 임시 검사와 390px 캡처는 `.tmp/check-mobile-reactions.mjs`, `.tmp/mobile-reaction-390.png`에 있다.
- iPhone과 Android 실기기 검증, 웹과 앱 390×844 라이트/다크 전체 화면 1px 비교는 미실행이다. Android 빌드와 배포는 수행하지 않았다.

## iOS 테스트 배포

- 사용자 요청으로 EAS production iOS `1.0.2 (9)` 빌드를 수행했다. 빌드 `ad91787c-8147-4d89-b2eb-72f93bce454b`가 2026-10-23 19:35 KST에 성공했다.
- 자동 제출 `faef2e6c-7e77-4138-9442-a8130419905b`도 성공해 TestFlight 업로드가 완료됐다. App Store 정식 심사 제출과 Android 빌드는 수행하지 않았다.
- App Store Connect 조회에서 빌드 9의 `processingState=VALID`, `internalState=IN_BETA_TESTING`을 확인했다. 내부 테스터가 TestFlight에서 설치할 수 있는 상태다. 조회 결과는 `.tmp/community-reactions-testflight-status.json`에 저장했다.
