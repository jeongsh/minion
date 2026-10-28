# iOS 커뮤니티 사진첩 업로드 수정

2026-10-28 사용자 요청. 화면 구성과 잠금 파일은 변경하지 않는다.

## 원인과 변경

- 이전 `60a55457`의 HEIC 대응은 `mobile/lib/profile-image.ts`의 프로필 선택에만 적용됐다. 커뮤니티의 `community-rich-editor.tsx`는 사진첩 원본 URI, 원본 파일명과 MIME을 그대로 multipart로 보냈다. 서버는 실제 바이트가 PNG, JPEG, WebP, GIF인지 검사하므로 HEIC와 HEIF 또는 MIME 불일치를 거절한다.
- 웹 원본 `components/community/editor/editor-image-upload.ts`는 정지 이미지를 최대 1920px, 품질 0.85로 압축하고 GIF 원본은 유지한다. 네이티브도 `mobile/lib/community-image.ts`에서 같은 크기와 품질로 WebP를 실제 생성하고, 생성 파일의 URI와 일치하는 파일명 및 MIME을 전송한다. PNG와 WebP의 투명도는 보존한다.
- 사진 선택기에 iOS 호환 representation을 지정하지만 이 옵션만으로 변환됐다고 가정하지 않는다. 파일명과 MIME이 누락되거나 원본 HEIC 정보가 남아도 정지 이미지는 실제로 재인코딩한다. GIF는 캐시 URI의 확장자를 우선 확인하고 원본을 전송해 애니메이션을 보존한다.
- 사진 선택과 변환 실패는 기존 오류 처리에서 알리고 업로드 상태를 해제한다. 원본 선택 제한 20MB, API 전송 제한 6MB와 4096px, 서버의 실제 바이트 및 MIME 검사, 인증과 저장 계약은 유지한다. 프로필, 웹 업로드 및 DB는 수정하지 않는다.

## 검증

- 임시 업로드 회귀 검사 9개와 기존 서버 이미지 검증 및 프로필 회귀 검사 10개 통과. 임시 테스트 파일은 프로젝트 커밋 규칙에 따라 제외했다.
- 업로드 회귀 검사는 네이티브 선택기와 변환기를 모의했다. HEIC와 HEIF 메타데이터, MIME 누락과 불일치, 세로 사진과 작은 이미지, 투명도, GIF 원본 유지, 여러 장 선택, 취소와 실패 처리를 확인했다. Sharp로 실제 생성한 결과 바이트를 기존 서버 검증기에 전달하고, 실제 편집기의 사진 첨부 콜백이 변환 파일만 업로드하는지도 확인했다. iOS의 HEIC 디코딩 자체를 실행한 검사는 아니다.
- 앱 타입 검사 통과. 앱 lint는 기존 경고 2개이며 오류 없음.
- 편집기 브리지, 게시글 이미지 및 임베드, 키보드 계약 검사 14개 통과. 기본 sandbox 경로에는 브라우저가 없어 기존 로컬 Playwright 브라우저 경로를 지정해 재실행했다.

## 미확인 및 배포

- 실제 신고 사진과 iPhone이 없어 운영 오류 재현, iPhone의 HEIC 및 iCloud 선택과 업로드는 미확인이다. 화면 변경이 없어 별도 디자인 검증은 수행하지 않았다.
- 기존 `expo-image-manipulator` 14.0.8을 사용한다. 이전 프로필 수정이 포함된 바이너리를 기준으로 네이티브 의존성 변경은 없다. 그보다 오래된 바이너리는 이 모듈 포함 여부를 확인해야 한다.
- 앱에 이번 JavaScript 수정이 반영돼야 사용자에게 적용된다. iOS 및 Android 빌드, 운영 배포와 스토어 제출은 실행하지 않았다.

참고: [Expo SDK 54 ImagePicker 문서](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/imagepicker.mdx), [Expo SDK 54 ImageManipulator 문서](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/imagemanipulator.mdx). 설치된 17.0.11 선택기와 14.0.8 변환기의 iOS 소스도 확인했다.
