# 앱 댓글 작성자 메뉴 수정

- 웹 기준은 `components/community/author-menu.tsx`와 `components/community/comment-list.tsx`다. 이미지와 닉네임에서 같은 작성자 메뉴를 열고, 아래 공간이 부족하면 위로 배치하는 동작을 앱에 반영했다.
- `mobile/components/community/community-post-screen.tsx`의 댓글과 답글 이미지를 기존 `CommunityAuthor`에 연결했다. 작성자, 댓글 증거, 차단 후 갱신 콜백은 닉네임 메뉴와 동일하다. 프로필, 작성글, 작성 댓글 목적지와 기존 API 계약은 유지했다.
- `CommunityAuthor`는 모달 루트의 실제 크기와 좌표를 측정하고 트리거의 창 좌표를 모달 좌표로 변환한다. Android 모달의 상태 표시줄과 내비게이션 바를 투명하게 설정하고, 안전 영역 안에서 위아래 방향과 최대 높이를 결정한다. 높이가 부족하면 내부 스크롤로 모든 항목에 접근한다.
- 키보드 회피와 하단 inset은 기존 `KeyboardAwareView`를 사용한다. 별도 키보드 이벤트나 높이 보정은 추가하지 않았다. 잠금 파일과 백엔드는 변경하지 않았다.
- 사용자 요청으로 메뉴를 열 때 이미지와 닉네임에 표시하던 강조 테두리를 제거했다. 웹 작성자 버튼의 포커스 링도 제거했다.

## 검증

- 앱 타입 검사 통과. 앱 린트 오류 없음. 기존 경고 2개는 유지했다.
- 기존 키보드 및 비회원 커뮤니티 계약 검사 8개 통과.
- 실제 위치 계산 콜백을 추출하여 창 원점 차이, 하단 48px inset, 가로 화면과 좁은 화면 등 72개 조건을 검증했다.
- 실제 `CommunityAuthor`를 React Native Web으로 격리 렌더링하여 이미지와 닉네임, 회원과 비회원 메뉴, 바깥 클릭 닫기, 프로필과 활동 탭 목적지, 낮은 화면의 내부 스크롤 등 9개 시나리오를 검증했다. API 저장은 호출하지 않았다.
- 390×844 라이트와 다크의 격리 캡처에서 메뉴 전체와 위쪽 배치를 확인했다. 임시 검사 코드는 `.tmp/check-community-author.mjs`, 결과는 `.tmp/app-author-validation.json`, 캡처는 `.tmp/app-author-390-light.png`와 `.tmp/app-author-390-dark.png`다. 인증과 테마, 아바타, 키보드 컨테이너는 격리 검사 대역을 사용했으므로 전체 화면의 네이티브 검증을 대체하지 않는다.
- 연결된 Android 기기가 없다. Android와 iPhone 실기기의 시스템 바, 키보드 반복, 뒤로가기 검증과 웹/앱 전체 화면 1px 비교는 미실행이다. Android 빌드와 배포는 수행하지 않았다.
- `mobile/AGENTS.md`가 참조한 `docs/native-mobile/OWNER-B.md`는 현재 저장소에 없다. 실제로 존재하는 `docs/native-mobile/README.md`와 현재 웹 구현을 기준으로 진행했다.
