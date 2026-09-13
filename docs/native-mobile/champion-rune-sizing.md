# 챔피언 앱 룬 크기 조정 — 2026-09-13

- 기준: `README.md`, 웹 `components/champions/champion-detail.tsx`. `OWNER-A.md`는 현재 저장소에 없으며 README가 지정한 단일 실행 기준을 적용했다.
- API: 챔피언 상세 route → `getMobileChampionDetail` → `buildMobileBuild` → 웹과 동일한 `buildRuneBuildGrid`. 기존 이미지 URL, 선택 상태, 행 순서 및 API 계약을 유지했다.
- 핵심/일반/파편 크기: 모바일 36/30/28px, 640px 이상 40/34/32px. 내부 여백 4/2/2px, 행 간격과 최소 높이를 웹에 맞췄다.
- 두 열 가로 배치, 1.2:1 비율, 최대 폭 440px, 열 간격 8px, 파편 위 여백 8px. 비선택 이미지는 불투명도 0.32와 grayscale, 슬롯 배경은 웹의 라이트·다크 색상이다.
- 세트 앱 `match-player-build-panel.tsx`는 이미 동일 크기와 가로 배치가 반영되어 있어 추가 수정하지 않았다.
- 타입 검사 통과. 앱 린트 오류 없음, 기존 다른 화면 경고 2건. diff 공백 검사 통과.
- 실행 확인: 오리아나 웹/Expo Web 390×844 라이트·다크 캡처를 대화 실행 기록에 남겼다. DOM 실측 핵심 룬 36px, 파편 28px, 파편 위 간격 8px. Expo Web 768px에서 핵심 룬 40px, 파편 32px 확인.
- 한계: 웹은 123픽, 앱 API는 122픽으로 캐시 데이터 차이가 있다. 룬 구성은 같지만 완전히 동일한 응답 스냅샷 비교는 아니다. 기존 셸·스크롤바 여백 차이가 있어 전체 화면 1px 일치로 판정하지 않는다. iPhone/Android Expo Go 실기기 확인은 미실행. 잠금 파일 및 네이티브 런타임 변경 없음.
