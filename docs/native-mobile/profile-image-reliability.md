# 프로필 이미지 오류 수정

2026-10-23 사용자 요청에 따른 웹, Android, iOS 공용 이미지 처리 수정이다. 화면 배치와 헤더의 잠금 파일은 수정하지 않는다.

## 확인한 경로

- 웹 헤더: `app/layout.tsx` → `lib/auth/current-user.ts` → `components/layout/app-shell.tsx` → `components/rank/rank-avatar.tsx`.
- 앱 헤더: `mobile/providers/auth-provider.tsx` → `/api/mobile/v1/bootstrap` → `mobile/components/minion-screen.tsx` → `mobile/components/rank-avatar.tsx`.
- 웹 프로필 저장: `components/auth/profile-form.tsx` → `lib/auth/actions.ts`.
- 앱 프로필 저장: `mobile/components/account/profile-form.tsx`, `mobile/app/favorite-team.tsx` → `/api/mobile/v1/me`.

## 원인과 변경

- 프로필 선택은 선택기의 MIME이 없거나 PNG, JPEG, WebP 이외이면 차단했다. 글쓰기는 같은 클라이언트 검사가 없고 서버에서 실제 이미지 바이트를 검사한다. 따라서 글쓰기 성공이 프로필에서도 같은 입력을 받는다는 의미는 아니다.
- 설치된 Expo ImagePicker 17.0.11의 iOS 구현은 기본 representation이 `current`이고 원본 HEIC 등을 반환할 수 있다. 프로필과 가입 과정에 공용 선택 처리를 연결하고, 네이티브 사진은 ImageManipulator로 최대 512px JPEG를 실제로 생성한 뒤 전송한다. 원본 파일 이름이나 MIME만 바꾸는 방식은 사용하지 않는다.
- 웹과 앱 서버 저장은 `prepareProfileImage`를 공유한다. 파일의 실제 바이트를 해독하고 회전, 최대 크기와 WebP 변환을 적용한다. 해독 실패 시 원본을 그대로 공개 저장하지 않는다. GIF는 정지 프로필로 변환한다. 웹 선택에는 GIF와 AVIF도 허용한다. 서버 입력 제한 5MB와 기존 저장 버킷 정책은 유지한다.
- 웹 프로필 조회의 일시 오류를 한 번 재조회하고, 계속 실패하면 정상적인 빈 프로필로 반환하지 않는다. 앱 bootstrap과 내 정보 API도 조회 실패를 빈 프로필로 성공 처리하지 않는다.
- 앱 로그인 사용자 변경 후 React effect에서 프로필을 다시 읽는다. 서버 재조회는 캐시를 우회하고, 요청 순서와 사용자 ID가 모두 일치할 때만 결과를 반영한다. 오류 시 기존 viewer를 유지한다.
- 공용 웹 및 앱 아바타는 이미지 로딩 실패 시 기본 문자를 표시하고 1초, 2초 뒤 최대 두 번 자동 재시도한다. 웹은 네트워크 복구와 탭 복귀, 앱은 앱 복귀 시 실패한 이미지를 다시 요청한다. URL 변경 시 이전 실패 상태를 초기화한다. 정상 이미지 요청의 캐시는 유지한다.

## 검증

- 운영 DB 읽기 확인: 전체 프로필 16개 중 이미지가 설정된 7개 모두 공개 `profile-avatars` 객체가 존재했다. 실제 회원 정보와 파일은 변경하지 않았다.
- `npm.cmd run test:profile-image`: 16개 통과. PNG, JPEG, WebP, GIF, AVIF, TIFF 실제 인코딩, 회전과 축소, 손상 파일 및 SVG 거절을 확인했다. 네이티브 HEIC 및 MIME 누락, 원본 5MB 초과, 취소와 리소스 해제는 선택기와 변환기를 모의한 검사다. 서버 프로필 조회 실패와 실제 이미지 미설정을 구분하고 웹 재조회도 검사했다.
- `node --test tests/mobile/keyboard-layout-contract.test.mjs`: 4개 통과.
- 웹 및 앱 타입 검사 통과. 변경 웹 파일 ESLint 통과. 앱 lint는 기존 경고 2개이며 오류 없음. 웹 typography 일반 검사와 변경 파일 strict 검사 통과. Impeccable detector 결과 없음.
- 실제 웹 RankAvatar를 Chromium 격리 화면에 렌더링해 첫 503 이후 복구, 지속 실패 시 총 3회 제한, online 복구와 URL 변경 시 정상 표시를 확인했다. 1440px, 768px, 390px 라이트 및 다크에서 아바타 32px 크기와 가로 넘침 없음을 확인했다. 전체 로그인 화면의 검증이나 네이티브 화면 비교를 대체하지 않는다.

## 배포 및 미확인 조건

- `expo-image-manipulator` 14.0.8이 추가되어 Android와 iOS는 네이티브 앱을 다시 빌드해야 한다. 기존 바이너리에 JavaScript 업데이트만 배포하면 안 된다.
- 웹 및 API 배포는 별도로 필요하다. 이번 작업에서 운영 배포와 앱 빌드 및 스토어 업로드는 실행하지 않았다.
- 실제 iPhone의 HEIC/iCloud 사진 선택과 업로드, Android 사진 선택, 로그인 직후 및 네트워크 복구 후 헤더 표시, 390×844 웹과 네이티브 라이트 및 다크 비교는 실기기 확인이 남아 있다.
- 간헐적인 운영 장애 자체를 실기기에서 재현하지는 않았다. 확인된 오류 처리 결함과 업로드 형식 불일치 경로를 수정하고 격리 환경에서 실패 조건을 검증했다.
