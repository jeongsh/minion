# 홈 대회 메타와 선수 빌드 카드 동기화

2026-10-31 사용자 요청으로 앱의 두 카드 비율과 이미지 가장자리를 현재 웹에 맞췄다.

## 변경 범위

- 웹 원본: `components/domain/home-insights.tsx`의 `ChampionArt`, `HomeMetaSection`, `HomeBuildSection`.
- 앱 구현: `mobile/components/home/home-insights.tsx`의 같은 두 영역과 공용 `ChampionArt`.
- 앱 로딩: `mobile/components/home/home-loading-skeleton.tsx`에서 마지막 두 영역의 카드 비율만 수정했다. POM 비율은 유지했다.
- 잠금 홈 파일, API, 데이터 선정, 테마, 내비게이션과 광고는 변경하지 않았다.

| 항목 | 웹 | 앱 |
| --- | --- | --- |
| 카드 비율 | `aspect-[2/3]` | `aspectRatio: 2 / 3` |
| 이미지 좌우 | `-6%` | `left`, `right`: `-6%` |
| 이미지 상단과 하단 | `top: -6%`, `bottom: 0` | 동일 |
| 이미지 채움과 위치 | `object-cover object-top` | `contentFit="cover"`, `contentPosition="top"` |

검은 프레임은 Data Dragon 로딩 이미지에 포함되어 있으므로 이미지 프레임을 카드 밖으로 확장하고 카드의 기존 overflow clipping을 유지한다. 하단 정보용 그라데이션과 클릭 목적지는 유지했다.

## 데이터 흐름 확인

앱 홈은 `/api/mobile/v1/home`의 `insights`를 사용한다. 이 API와 웹 홈은 같은 `getHomeInsights` 서비스를 사용하며, `championArtwork`가 같은 이미지 URL을 생성한다. API 및 응답 계약 변경은 없다.

## 검증 결과

- 앱 TypeScript 검사 통과.
- 앱 전체 린트 오류 0개. 기존 `community-directory-nav.tsx`와 `schedule-match-list.tsx` 경고 각 1개는 유지했다.
- 변경 파일 `git diff --check` 통과.
- Expo Web 앱을 390 × 844에서 실행해 실제 홈 데이터와 이미지 로딩, 라이트 및 다크 화면을 확인했다. 캡처는 작업 채팅에 남겼다.
- 같은 데이터의 모바일 웹과 앱 카드에서 폭 156.171875px, 높이 234.25px를 측정했다. 웹은 세로 스크롤바를 고려해 405px 뷰포트를 사용했다.
- 이미지 프레임도 양쪽에서 폭 174.890625px, 높이 248.296875px, 카드 기준 왼쪽 -9.359375px, 위쪽 -14.046875px로 같았다.
- 앱 가로 스크롤로 뒤쪽 Delight와 Hans Sama 카드를 확인했다. 자야 로딩 이미지의 검은 상단 및 측면 프레임이 노출되지 않았다.

## 검증 한계

위 측정은 Expo Web의 카드 외곽과 이미지 프레임 비교다. 화면 전체의 웹/네이티브 1px 일치 검증은 완료하지 않았다. iPhone 및 Android 실기기, safe area와 네이티브 스크롤 확인은 미실행이다. Android 빌드 보류 방침을 유지했으며 iOS/Android 빌드, 배포와 스토어 업로드는 실행하지 않았다.
