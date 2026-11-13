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
