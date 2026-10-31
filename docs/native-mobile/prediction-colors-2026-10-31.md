# 승부예측 선택 색상 웹 동기화

## 변경 범위

- 사용자 요청으로 웹 승부예측의 라이트모드 선택 색상을 앱에 반영했다.
- `mobile/components/predictions/prediction-match-card.tsx`만 수정했다.
- 공용 로고, 테마 provider, 홈, 헤더, 독바 및 iOS 승부예측 제외 경로는 수정하지 않았다.
- 선택 상태는 기존 `match.myBet.teamId`와 양쪽 팀 ID로 판단한다. API, 인증 및 저장 동작은 변경하지 않았다.

## 웹 기준

- 원본은 `app/globals.css`, `app/predictions/prediction-board.tsx`, `components/domain/prediction-match-bar.tsx`, `components/ui/team-logo.tsx`다.
- `lib/prediction-colors.ts`의 플랫폼 독립 함수를 공유해 검정 팀 분류와 선택색 농도를 동일하게 계산한다.
- 일반 팀은 최대 68% 농도를 시작 지점부터 카드 폭 18%까지 유지하고 50%에서 흰색으로 전환한다.
- 검정 팀은 실제 검정으로 시작해 18%까지 유지하고 40%에서 흰색으로 전환한다. 선택한 이름은 흰색, 중앙 비율과 반대편 이름은 기존 라이트 색상을 유지한다.
- 흰색 로고는 기존 API `logoDark` 자산을 해당 카드의 TeamLogo 입력에만 전달한다. G2처럼 별도 흰색 자산이 없는 경우 기존 로고를 유지한다.
- 다크모드의 방사형 그라데이션과 42% 농도는 유지한다.
- `OWNER-A.md`는 현재 저장소에서 찾을 수 없어서 README의 실행 기준과 기존 카드 구현을 따랐다. Expo 54 문서 주소는 현재 latest로 리다이렉트되어 설치된 SDK 및 react-native-svg 15.12.1 구현도 확인했다.

## 검증

- 앱 타입 검사 통과.
- 앱 전체 린트 오류 없음. 기존 경고 2건은 이번 범위 밖이다.
- 키보드 계약 검사 4건 통과.
- 변경 파일의 `git diff --check` 통과.
- Expo Web에서 390×844 라이트 및 다크를 실행했다. 실제 조회 응답의 선택 상태만 브라우저에서 대체했으며 POST와 DELETE는 차단했다. 실제 회원 정보와 예측은 저장하지 않았다.
- 동일한 LOS/TSW 데이터와 50% 비율로 웹과 앱 카드를 비교했다. 카드 크기는 양쪽 모두 358×76px이었다. 검정 구간, 흰색 이름과 로고, 중앙 비율 및 반대편 표시를 확인했다.
- 캡처: `.tmp/prediction-app-light-card.png`, `.tmp/prediction-app-dark-card.png`, `.tmp/prediction-app-reference-light-card.png`, `.tmp/prediction-app-reference-dark-card.png`.

## 검증 제한

- 네이티브 iPhone 및 Android Expo Go 실기기와 전체 화면의 1px 비교는 미실행이다. Expo Web 검증을 네이티브 완료 판정으로 대체하지 않는다.
- 기존 완료 경기의 다크모드 전체 투명도는 웹 0.8, 앱 1로 서로 다르다. 이번 요청은 다크모드 보존이므로 변경하지 않았다.
- iOS 참여 화면 제외 정책을 유지했다. Android 빌드, EAS Build 및 배포는 실행하지 않았다.
