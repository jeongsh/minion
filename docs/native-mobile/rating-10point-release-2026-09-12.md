# 앱 팬 평점 10점 표시 및 Android 배포

- 요청: 웹에만 반영된 10점 표시를 앱에 반영하고 빌드·배포.
- 코드: `3ce28eda`에 포함됨. 작업 중 별도 커밋 작업에서 기존 세트 요청 변경과 함께 커밋됐다.
- 웹 원본: `lib/fan-rating-display.ts`, 경기의 `set-rating-form.tsx`와 `rating-comment-list.tsx`, 선수의 `fan-review-list.tsx`와 `player-detail-view.tsx`.
- 앱의 `mobile/lib/fan-rating-display.ts`가 웹의 순수 표시 함수를 재노출한다. 경기 평균·내 평점·리뷰·별점 선택 접근성 라벨·선택값과 선수 평균·리뷰에 적용했다.
- 표시만 2배 환산하며 저장값, API 요청·응답, 별 5개의 반쪽 선택 구조, 레이아웃과 폰트는 유지한다. DB 변경 없음.
- `OWNER-A.md`, `OWNER-B.md`는 현재 저장소에 없으므로 사용자 지침에 따라 현재 `README.md`를 실행 기준으로 적용했다. 잠금 파일 변경 없음.

## 검증

- 모바일 typecheck 통과. lint 오류 0, 기존 경고 2(community-directory-nav, schedule-match-list).
- 키보드 계약 테스트 4개 통과. diff 공백 검사 통과.
- null/undefined/NaN, 0.5, 1, 3.75, 4.5, 5의 표시 변환 8개 확인.
- 실제 release sourcemap에 두 변경 컴포넌트와 공용 환산 함수 포함 확인. `/ 10` 표시 및 기존 `rating: selectedRating` 제출 확인.
- release bundle에 운영 API `https://minion.fan` 포함, 개발 LAN API 주소 미포함 확인.
- 실제 HLE–T1 3세트 데이터에서 Doran 평균과 리뷰 점수가 웹·Expo Web 양쪽에서 10.0으로 표시됨. 라이트·다크 캡처: `artifacts/rating-10point-2026-09-12/`.
- 화면 비교 한계: 앱은 비로그인, 웹은 로그인 상태다. 앱 캡처는 390×844, 웹은 viewport 요청에도 실제 캡처가 375×812로 반환됐다. 기존 화면 간격·레이아웃 차이가 있어 전체 1px 일치 판정은 하지 않았다. 앱 입력창의 실기기 동작 및 iPhone/Android Expo Go 검증은 연결된 기기가 없어 미실행이다. 웹 입력 DOM에서 1.0~10.0 라벨 및 10.0 / 10을 확인했다. 실제 평점 제출은 수행하지 않았다.

## 배포

- Google Play 기존 최신 versionCode 20 확인 후 로컬 Gradle `bundleRelease`로 21 생성. EAS 원격 versionCode도 21로 동기화.
- 업로드 키 SHA-256: `A3:4D:36:03:63:97:66:C8:FB:16:10:6C:D2:39:18:DF:6B:25:D4:5E:4A:20:8F:31:DC:9B:4D:14:ED:E4:A0:00`. 기존 배포 AAB와 새 AAB 모두 일치.
- AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab` (85,331,790 bytes).
- AAB SHA-256: `755BEB84691EF635E296D71893CC754BE9462121A30A59E72AC5572AEF8F7DB7`.
- EAS Submit: https://expo.dev/accounts/lckminions-team/projects/minion/submissions/6d41b525-09c7-4f76-b7b1-b5e15acc897f
- EAS 제출 상태 FINISHED, alpha / COMPLETED. 2026-09-12 17:24 KST 제출 완료.
- Google Play 확인 상태: versionCode 21, 비공개 테스트 Alpha, **검토 중**. 테스터 제공 완료는 아직 확인되지 않았다.
