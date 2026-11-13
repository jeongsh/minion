# 커뮤니티 동영상 첨부 (앱)

2026-11-13 사용자 요청. 웹 게시글 에디터에 추가한 동영상 첨부(`e71d07a3`, 진행률 `189abfdd`)를 Android와 iOS 앱에 옮긴다. 잠금 파일은 변경하지 않는다.

## 웹 원본

- `components/community/editor/Toolbar.tsx`: 사진 첨부 버튼 하나가 로그인 회원(`allowEmbeds`)에게 사진과 동영상을 함께 받는다. 동영상은 MP4, WEBM, MOV, 50MB, 글당 3개.
- `components/community/editor/editor-image-upload.ts`: 서버에서 서명 업로드 URL을 받아 Storage에 직접 PUT(XHR 진행률)하고 서버 검증 후 `video` 노드를 넣는다. 업로드 중 placeholder에 `%`를 표시한다.
- `components/community/editor/post-content-viewer.tsx`: `<video controls playsinline preload="metadata">`, 폭 100%, 최대 높이 640px.
- 비회원 글의 동영상은 `lib/community/limits.ts`에서 거절한다.

## 서버

- 서명·검증 로직을 `lib/community/video-upload.ts`로 옮겨 웹 `/api/community/upload/video`와 앱 `/api/mobile/v1/community/upload/video`가 같은 코드를 쓴다. 앱 경로는 Bearer 인증 필수다.
- contracts: `communityVideoUpload` 경로, `MobileCommunityVideoSignDto`, `MobileCommunityVideoConfirmDto` 추가.
- `lib/mobile/community.ts`의 빈 글 판정에 `video`를 포함했다.

## 앱

- `mobile/lib/community-video.ts`: 웹과 같은 형식·크기 한도. 서명 요청 후 XHR PUT으로 진행률을 받고 검증을 요청한다.
- `community-rich-editor.tsx`: 로그인 회원은 사진 선택기에서 동영상도 고른다(iOS는 H.264 1920x1080으로 내보내 Android와 웹에서도 재생되게 한다). 업로드 중 placeholder에 `%`를 표시하고, 편집기 HTML에 `video` 블록을 넣고 다시 `video` 노드로 읽는다. 기존 글의 동영상도 보존한다.
- `community-rich-editor.web.tsx`(Expo Web): 기존 글의 `video` 노드를 보존한다.
- `community-post-content.tsx`: WebView 안의 `<video>`로 재생하고 원본 비율로 높이를 정하되 최대 640px로 제한한다.
- `community-utils.ts`의 빈 글 판정에 `video`를 포함했다.

## 검증

- 웹·앱 타입 검사 통과, 앱 린트 오류 없음(기존 경고 2건), 변경 파일 ESLint 통과.
- 로컬 서버에서 앱 경로의 비로그인 요청이 `UNAUTHENTICATED`로 거절되는 것을 확인했다. Storage 서명 업로드, Range 검증과 MIME 차단은 웹 작업 때 실제 버킷으로 확인했다.
- 미실행: iPhone과 Android 실기기의 선택, 업로드, 재생. 로그인 상태 업로드. 라이트·다크 1px 캡처 비교.

## 2026-11-13 iOS 28·Android 43 배포

- 사용자가 빌드와 배포를 요청했고, Google Play 프로덕션 전체 출시를 따로 확인받았다. 대상 커밋은 `e2cb360d`, 서버 변경은 같은 커밋을 `dev`에 푸시해 운영에 반영했다(운영 `/api/mobile/v1/community/upload/video` 401 확인).
- iOS: EAS Build `e2ee4e14-2121-4233-bd5b-1e98d20c6a36`로 1.0.4(28) 빌드 완료, 자동 제출 `b3a2982a-35dd-4187-9c0b-897b74456045`로 App Store Connect 업로드를 예약했다. 업로드 완료 여부와 심사 제출은 확인하지 않았다.
- Android: 로컬 Gradle `:app:bundleRelease`로 1.0.4(43) 빌드(2분 36초). AAB `mobile/store-assets/minion-1.0.4-43.aab`, 82,962,662 bytes, SHA-256 `e991fa8ccfc22eb7f86df7cea93258ba8e13d08fc15604dd491a21e55d60356b`. JAR 서명 검증, 업로드 인증서 SHA-256이 기존과 같음(`A3:4D:…:A0:00`), Hermes 번들의 운영 API 포함과 LAN 주소 미포함, 동영상 업로드 경로와 에디터 명령 포함을 확인했다.
- EAS Submit `4c385d61-29a0-44b2-b268-9904eec2657b`(store-release, 프로덕션, completed)로 Google Play 제출에 성공했다. Play Console 검토 상태는 확인하지 않았다. EAS 원격 versionCode는 맞추지 않았다.
