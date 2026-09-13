# 웹·앱 상세페이지 성능 점검 — 2026-09-13

공개 웹 65개 경로, 앱용 API 29개 경로의 순차 3회 요청(87회), Expo Web 35개 화면 경로를 점검했다. 경기·선수·챔피언·팀·팬페이지·영상·허브/팀 게시글·작성자·문의·세트 평가 스냅샷 등 상세 화면 유형을 포함한다. 각 상세 유형의 실제 데이터 표본을 사용했으며, 모든 선수·게시글 ID를 전수 방문한 것은 아니다.

불필요한 기록 더보기 대기, 챔피언 참조 데이터의 중복 조회, 선수 상세의 순차 로딩, 앱 상세 재진입 요청을 개선했다. **코드는 로컬 반영 상태이며 운영 배포와 앱 배포 빌드는 하지 않았다.**

## 측정 조건과 범위

- 운영: `https://minion.fan`, 비로그인. API에는 앱과 동일한 installation ID 헤더를 사용했다. 최초 헤더 없는 탐색에서 나온 게시판 API 500은 앱 요청 형식이 아니므로 기준 측정에서 제외했다. 올바른 헤더로 측정한 87회는 모두 200이다.
- 기본 웹: Chromium, 390×844, 경로마다 새 context, CPU/네트워크 제한 없음, DOMContentLoaded 후 4초 관찰. 보충 9개 경로는 3초 관찰. 전부 최종 HTTP 200 및 pageerror 0건이다. 로그인 보호 화면은 로그인 이동/비로그인 초기 상태만 확인했다.
- 제한 조건: CPU 4배 slowdown, 4Mbps 다운로드/1Mbps 업로드, 지연 80ms, OS 로컬 폰트 비활성, 새 context, DOMContentLoaded 후 8초 관찰. 8개 경로의 단일 표본이다.
- 앱 실행: Expo SDK 54 **Web production export**의 Chromium 실행. 테스트용 정적 서버와 로컬 Next production API를 사용했다. 네이티브 앱의 시작 시간·JS/UI FPS 측정이 아니다.
- 앱의 35개 경로 중 7개는 첫 정적 테스트 서버가 디렉터리를 HTML보다 먼저 찾는 문제로 빈 404를 반환했다. 서버를 고쳐 재측정했으며 최초 결과를 성공으로 집계하지 않았다.
- 관리자 화면, 실제 로그인 후 개인 데이터·권한별 화면, iPhone/Android 실기기는 미검증이다. `adb devices`에 연결 기기가 없었다. 폼 전송, DB 스키마 변경, 서비스 데이터 수정은 하지 않았다. 공개 페이지 방문은 일반 열람과 같은 조회 집계 등을 유발할 수 있다.
- API 첫 요청은 강제 cold start가 아니다. HIT/MISS/STALE을 원자료에 보존했다. 실험 표본으로 p95나 현장 Core Web Vitals를 주장하지 않는다.
- 브라우저 바이트는 관찰 종료까지 완료된 CDP encodedDataLength 합계이며, API 본문 바이트는 압축 해제 후 크기다. 다운로드가 끝나지 않은 폰트·이미지는 누락되므로 전송량은 하한일 수 있다. Early Hints의 responseStart를 서버 TTFB로 사용하지 않고 finalResponseHeadersStart도 기록했다.

## 운영에서 상대적으로 느린 구간

| 대상 | API 첫 표본 | 뒤이은 캐시 HIT | 응답 본문 |
| --- | ---: | ---: | ---: |
| 챔피언 바이 빌드 | 1,654ms | 80 / 54ms | 269,757B |
| 챔피언 오리아나 빌드 | 1,337ms | 30 / 40ms | 234,807B |
| 선수 Faker 상세 | 1,085ms | 35 / 37ms | 260,098B |
| 선수 Chovy 상세 | 677ms | 41 / 35ms | 224,543B |
| 뉴스 | 1,102ms | 원자료 참조 | 6,593B |
| 경기 데이터 | 217ms | 36 / 33ms | 48,477B |
| 경기 프리뷰 | 185ms | 33 / 32ms | 9,008B |
| 경기 평가 | 206ms | 30 / 30ms | 13,509B |
| 허브 게시글 상세 | 182ms | 176 / 166ms, 모두 MISS | 11,735B |

이전의 서버 지역 변경은 운영 응답 `icn1::hnd1`에서 확인됐다. 경기 API의 탭별 응답 분리도 실제 운영에 반영돼 있다. 게시글은 개인화 가능 응답이므로 private/no-store를 유지했다.

기본 웹 65개 표본의 LCP는 모두 2초 미만이었다. 제한 조건에서는 홈 3,060ms, 선수 상세 2,688ms, 챔피언 상대 전적 2,412ms가 관찰됐다. 선수 상세의 완료된 폰트 전송만 **3,286,840B**, 페이지 합계는 4,384,560B였다. 다른 화면의 짧은 LCP를 전체 미디어/폰트 로딩 완료로 해석하면 안 된다.

폰트 전달량과 CDN 원본 이미지 크기는 남은 개선 후보다. 다만 기존 기록에 폰트 서브셋과 게임 이미지 로컬 파생본을 철회한 결정이 있어 이번에 다시 도입하지 않았다. 챔피언 빌드는 CDN 미스 시 원시 픽밴/이벤트 로딩이 여전히 크며, 캐시 미스의 장기 분포와 서버 내 단계별 시간을 별도로 계측할 필요가 있다.

## 반영한 개선과 검증

### 1. 선수 기록·리뷰의 인위적 대기 제거

웹과 앱은 이미 메모리에 있는 기록을 3개씩, 리뷰를 5개씩 추가하면서 매번 450ms 타이머를 기다렸다. 청크 크기·순서·로딩 표시·취소 처리는 유지하고 다음 작업에서 추가하도록 타이머 지연을 0으로 바꿨다.

변경 후 실제 스크롤로 최근 경기 3개를 추가했을 때 컨테이너 높이 증가까지 웹 **38ms**, Expo Web **23ms**였다. 변경 전 450ms는 코드에 있던 최소 인위적 대기이며 변경 전 전체 렌더링 시간을 실측한 값은 아니다.

대상: `app/players/[playerSlug]/{recent-match-history-modal,fan-review-list}.tsx`, `mobile/components/players/{player-recent-matches,player-fan-reviews}.tsx`.

### 2. 챔피언 참조 데이터 재사용

챔피언 이름·메타데이터 확인에 팀·선수·대회·경기·세트까지 불러오던 경로를 챔피언 목록만 읽도록 좁혔다. 상세 페이지/API가 이미 받은 참조 스냅샷을 이름 조회와 상세 집계에 전달한다. React의 `cache()`는 Server Component 밖에서 같은 방식으로 메모이제이션하지 않으므로 API에서는 명시적인 참조 재사용이 필요하다. [React 공식 문서](https://react.dev/reference/react/cache#pitfall-calling-a-memoized-function-outside-of-a-component-will-not-use-the-cache)

내부 함수에 선택 인자로 기존 참조 데이터를 전달하는 변경이며, 공개 DTO·API URL·권한·캐시 TTL·통계의 계산/정렬 계약은 바꾸지 않았다. DB 마이그레이션도 없다.

공개 DB에 읽기 전용으로 접근한 별도 Node 실행에서 변경 전 소스 스냅샷과 비교했다. React 컴포넌트 메모이제이션 없이 Next 데이터 캐시를 모사한 실험이다.

| 항목 | 변경 전 | 변경 후 |
| --- | ---: | ---: |
| 메타데이터 조회 DB 요청 | 6회 | 1회 |
| 메타데이터 조회 전송 | 614,198B | 25,975B |
| 메타데이터 조회 표본 시간 | 252ms | 53ms |
| 오리아나 전체 상세 DB 요청 | 39회 | 33회 |
| 오리아나 전체 상세 DB 전송 | 8,131,784B | 7,517,586B |
| 오리아나 전체 상세 표본 시간 | 990ms | 1,280ms |

전체 상세 시간은 오히려 늘어난 단일 표본이므로 **전체 API 응답 시간이 개선됐다고 결론 내리지 않는다**. 확인된 효과는 중복 요청·전송량 감소다. 727세트, 선수 스탯 1,230행, 빌드 이벤트 5,570행과 디렉터리 집계의 JSON 해시는 모두 동일했다.

### 3. 선수 상세의 독립 조회 병렬화

선택된 경기로부터 패치 목록을 먼저 구하고, 리그 벤치마크 집계와 주문·룬 카탈로그를 같은 Promise.all에서 읽도록 변경했다. 오류는 같은 병렬 작업에서 처리해 미처리 Promise 거부가 생기지 않게 했다. 화면에 사용하는 경기·카탈로그 순서는 유지했다.

공개 DB 클라이언트를 주입한 동일 실행에서 Faker(54매치), Chovy(51매치)의 변경 전후 모바일 DTO 해시가 일치했다. 이 검사는 공개 조회값 기준이며 서비스 역할 전용 데이터 전체의 동등성 검사로 확대 해석하지 않는다. 병렬화 단독의 운영 시간 절감량은 측정하지 않았다.

대상: `lib/mobile/player-detail.ts`, `app/players/[playerSlug]/player-detail-view.tsx`.

### 4. 앱 선수·챔피언 상세의 짧은 캐시 재사용

기존 공용 캐시의 staleTimeMs를 두 상세 화면에서 30초로 설정했다. 이는 서버의 기존 5분 데이터 캐시보다 짧다. 강제 새로고침·변경 후 무효화는 기존대로 즉시 네트워크를 사용하며, 개인화 응답의 정책은 그대로 유지한다.

Expo Web의 라이트·다크에서 상세 → 목록 → 같은 상세 진입을 확인했고, 두 화면 모두 추가 상세 API 요청은 0회였다. 공용 캐시 테스트 22개에서 요청 병합, 만료, 강제 갱신, 계정 변경 격리, 무효화, 취소를 확인했다.

## 검증 결과와 미완료 항목

- 웹 production build 성공, 정적 경로 179개 생성.
- 웹 typecheck, 변경 파일 ESLint, lint:typography, git diff --check 통과.
- 앱 typecheck 및 lint 통과. 기존 경고 2건: community-directory-nav의 useMemo 의존성, schedule-match-list의 불필요한 eslint-disable.
- Expo Web production export 성공(79개 정적 경로). 기존 개발 서버 8081과 별도 8083은 응답이 지연돼 이 방식으로 대체했다. 개발 서버 타임아웃을 출시 앱 성능 수치로 집계하지 않았다.
- 공용 캐시 테스트 22/22 통과.
- 모바일 API 계약 테스트 4/5 통과. 기존 테스트 `packages/contracts/mobile-v1.test.ts:19`는 경기 상세 인증을 public으로 기대하지만 현재 계약은 optional이다. 이번 변경에 계약/테스트 파일 수정은 없으며 이 실패를 숨기거나 인증을 변경하지 않았다.
- 웹 선수/챔피언 상세의 390×844 라이트·다크 캡처에서 pageerror와 가로 넘침 없음. 앱 같은 화면 캡처도 저장했다.
- Expo 정적 Web 직접 진입에서는 팬 경로 7개와 고객센터 목록에서 React hydration 오류 #418이 있었다. 콘텐츠/API는 표시됐지만 이를 무오류 통과로 처리하지 않는다. 네이티브에서의 재현 여부는 확인하지 않았다. 게시글 WebView는 Expo Web에서 지원되지 않는다.
- 웹/앱 캡처에는 선수 팀 정보 줄바꿈, 챔피언 간격, 앱 독바 테마 등 1px를 넘는 차이가 보인다. 이번 diff는 스타일/잠금 파일을 바꾸지 않았지만, 웹·앱 시각 동등성 전체를 통과했다고 할 수 없다.
- 실제 Android/iPhone 시작 시간·스크롤 프레임·키보드·safe area·뒤로가기, 로그인 상태 및 저사양 실기기 검증은 남아 있다.

## 재현 및 원자료

기본 운영 점검은 `node scripts/audit-page-performance.mjs [origin] [output-directory]`로 실행한다. 대표 상세 ID를 공개 API/페이지에서 찾아 측정하며 GET과 페이지 방문만 수행한다.

- [기본 웹/API 결과](../artifacts/performance-audit-2026-09-13/measurements.json), [상세 유형 보충 결과](../artifacts/performance-audit-2026-09-13/supplement.json)
- [제한 조건 결과](../artifacts/performance-audit-2026-09-13/constrained-measurements.json)
- [DB 요청·전송·해시 비교](../artifacts/performance-audit-2026-09-13/query-comparison.json)
- [기록 추가 시간](../artifacts/performance-audit-2026-09-13/history-append.json)
- [Expo 실행/캐시/캡처 검증](../artifacts/performance-audit-2026-09-13/expo-qa.json), [정적 서버 수정 후 재검증](../artifacts/performance-audit-2026-09-13/expo-qa-retry.json)
- [DB 비교 실행 코드](../artifacts/performance-audit-2026-09-13/verify-queries.mjs), [선수 DTO 비교 실행 코드](../artifacts/performance-audit-2026-09-13/verify-players.mjs)

`artifacts/`는 저장소에서 무시되는 로컬 측정 자료다. 서버 변경은 웹/API 배포 뒤, 앱 캐시·대기 변경은 새 앱 반영 뒤 운영에서 재측정해야 한다.
