# 모바일웹 디자인·성능 기준선

- viewport: 390×844
- 테마: light, dark
- 화면: home, schedule, match, community, community-post
- 성능 표본: 화면별 새 페이지 3회, 중앙값
- 측정 원본: `metrics.json`

이미지는 현재 모바일웹의 비교 원본이다. 네이티브 앱 캡처는 파일명을 유지하고 별도 `native/` 디렉터리에 저장해 image diff 입력으로 사용한다.

이 결과는 Chromium Android 에뮬레이션이다. 실제 Android 기기 측정 시 기기명, Android/Chrome 버전, 네트워크 조건, 배터리 절전 상태를 `metrics.json`과 별도 결과 파일에 반드시 기록한다.
