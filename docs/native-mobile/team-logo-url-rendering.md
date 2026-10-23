# 팀 로고 URL 렌더링 수정

2026-10-23 사용자 요청으로 `71ed6a46`의 팀별 로컬 PNG 치환을 제거한다. 잠금 영역인 팀 자산의 변경은 해당 커밋이 추가한 대체 PNG 9개 삭제로 한정한다. 웹 원본 `components/ui/team-logo.tsx`처럼 API의 로고 URL과 다크 모드용 URL을 사용한다. 원본 `public/logos/*.svg`와 API 계약, 로고 크기 및 배경은 변경하지 않는다.

## 원인 조사

- 대체 대상 CFO, DCG, IG, LGD, MVK, VIT, WE의 SVG 9개는 모두 base64 PNG를 `image`로 포함하고 `patternContentUnits="objectBoundingBox"`와 `use`를 통해 그린다. T1과 Gen.G 같은 일반 벡터 경로 SVG와 구조가 다르다.
- 설치된 `expo-image` 3.0.11의 iOS 구현은 `SDImageSVGCoder`를 등록한다. 이 디코더는 Apple CoreSVG를 사용하며, 같은 내장 이미지/pattern 구조의 누락 문제가 [Expo 공식 저장소 이슈](https://github.com/expo/expo/issues/23669)에 보고돼 있다. [디코더 문서](https://github.com/SDWebImage/SDWebImageSVGCoder)도 SVG별 호환성 제한을 설명한다.
- 따라서 iOS 디코더의 해당 SVG 구조 호환성 문제가 가장 유력한 원인이다. 이번 환경에서는 iPhone에서 수정 전 증상을 직접 재현하지 못했다.
- PNG 치환은 이 SVG 디코딩을 건너뛰는 효과가 있지만, 작성자의 선택 이유는 커밋에 기록돼 있지 않다. PNG를 사용한 의도는 이 효과에 근거한 추정이다.

## 변경

- 네이티브에서는 SVG URL을 이미 설치된 `react-native-svg` 15.12.1의 `SvgUri`에 그대로 전달한다. 특정 팀 이름, 별칭, 파일명 목록으로 치환하지 않는다. 쿼리와 해시, 대문자 SVG 확장자도 처리한다.
- URL을 key로 사용해 팀이나 테마가 바뀔 때 이전 SVG 로딩 상태를 분리한다.
- 웹에서는 기존 `expo-image`를 유지한다. 브라우저가 원본 SVG를 표시하므로 별도 SVG 텍스트 fetch와 CORS 설정 변경이 필요 없다. 네이티브에서도 PNG/WebP 등은 기존 `expo-image`를 사용한다.
- `plain`, 72% 크기, 원형 배경, 다크 모드용 로고 선택 및 URL 미설정 시 placeholder를 유지한다.
- `SvgUri`는 네이티브 SVG의 텍스트를 fetch하므로 기존 `expo-image`의 이미지 디스크 캐시와 150ms 전환을 사용하지 않는다. 별도 캐시나 의존성은 추가하지 않았다.

## 검증

- `npm.cmd --prefix mobile run typecheck`: 통과.
- `npm.cmd --prefix mobile run lint`: 오류 없음. 기존 경고 2개 유지.
- 실제 컴포넌트 함수를 추출한 플랫폼/상대 및 절대 URL/확장자/테마/크기/빈 상태 검사 14건 통과. 네이티브 UI를 실행한 검사는 아니다.
- 실제 컴포넌트의 네이티브 SVG 분기를 브라우저용 `react-native-svg`에 연결한 격리 환경에서 원본 URL의 `img`와 비교했다. 문제 SVG 9개와 T1, Gen.G를 390/768/1440px 라이트/다크에서 확인한 66건 모두 픽셀 차이 0, 브라우저 실행 오류 0이었다. 화면과 결과는 `.tmp/team-logo-url/`에 있다.
- 이 비교는 SVG 파싱 및 브라우저 렌더링 검증이다. 앱 전체 화면 비교, iOS CoreSVG의 수정 전 재현, iPhone/Android 네이티브 렌더링 및 실기기 검증은 미실행이다. Android 빌드는 사용자 지침에 따라 실행하지 않았다.
