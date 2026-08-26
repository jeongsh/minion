# 푸시 알림 개발 규칙

이 문서는 모바일 푸시 알림 기능을 만들거나 새 알림 종류를 추가할 때 지켜야 할 규칙을 정리한다. 초안은 Claude가 작성했고, 이후 실제 운영하면서 맞는 방향으로 계속 고쳐나간다.

## 1. 현재 상태

| 알림 종류 | 화면 토글 | 기본값 | 실제 푸시 발송 |
| --- | --- | --- | --- |
| 인앱 알림 | `인앱 알림` | 켜짐 | 해당 없음(브라우저/앱 켜져있을 때만 동작하는 별도의 기존 시스템, 로컬스토리지 기반) |
| 경기 시작 | `경기 시작` | 켜짐(옵트아웃) | ✅ 구현됨 |
| 경기 주요 이벤트 | `경기 주요 이벤트` | 꺼짐(옵트인) | ✅ 구현됨 |
| 세트 평가 오픈 | `세트 평가 오픈` | 켜짐 | ✅ 구현됨 |

- 설정 데이터는 기존 `user_notification_preferences` 테이블을 그대로 쓴다. 새 알림 타입을 추가해도 새 설정 테이블을 만들지 않는다 — 컬럼을 추가하고 위 표를 갱신한다.
- 토큰 저장은 `push_tokens` 테이블(user_id, expo_push_token, platform). 발송 헬퍼는 `lib/notify/push.ts`의 `sendExpoPushNotifications`.

## 2. 설계 원칙

### 2.1 발송 트리거는 서버 부하/리소스가 가장 적게 드는 방식으로 고른다
원칙은 "기존 트리거 재사용"이 아니라 **서버 부하와 리소스 소모를 최소화하는 것**이다. 기존 트리거 재사용은 그 목적을 위한 대표적인 수단일 뿐이고, 상황에 따라 가벼운 새 크론이 오히려 더 저렴할 수 있다. 매번 후보들을 비교해서 가장 싼 방식을 고른다.
- 예: "경기 주요 이벤트"는 새 크론 없이 `app/api/matches/[matchId]/live/route.ts`(유저가 라이브 탭을 볼 때만 도는 기존 폴링)에 얹었다 — 이미 나가는 요청에 얹는 게 새 폴링을 도는 것보다 저렴했기 때문.
- 예: "경기 시작"은 재사용할 기존 트리거가 없어서(아무도 안 보고 있어도 발송돼야 함) 새 크론을 만들었다 — 대신 크론 자체를 우리 DB만 조회하는 가벼운 쿼리로 유지해 비용을 낮췄다(외부 API 호출 없음). 이런 경우 `private.invoke_*_automation()` + `cron.schedule(...)` 패턴을 따른다(`supabase/migrations/20260702012441_schedule_lolesports_rating_automation.sql` 등 기존 예시 참고).

### 2.2 발송 시각은 "예정"이 아니라 "실제로 일어난 시점" 기준
경기 지연 등으로 예정 시각이 부정확할 수 있으면, 가능한 한 실제 이벤트가 감지된 시점에 맞춰 발송한다. "경기 시작"은 예정 시각 크론이지만, 크론 자체가 "지나간 예정 시각"을 찾는 방식이라 5~10분 전 예고가 아니라 시작 시점에 맞춰 보낸다.

### 2.3 옵트인/옵트아웃 기본값을 반드시 확인하고 필터링 방향을 맞춘다
`user_notification_preferences`의 각 컬럼은 기본값이 다르다(예: `match_start_enabled` 기본 true, `match_events_enabled` 기본 false). 새 알림을 추가할 때:
- 기본 켜짐(옵트아웃)이면: 명시적으로 `false`인 유저만 제외한다(설정 행이 아예 없는 유저도 포함해야 함).
- 기본 꺼짐(옵트인)이면: 명시적으로 `true`인 유저만 포함한다.
반대로 하면 대량 오발송 또는 대량 누락이 난다.

### 2.4 중복 발송 방지는 메모리가 아니라 DB로 한다
동시 요청/재시도가 겹칠 수 있으므로, in-memory 플래그로 막지 않는다.
- 1회성 이벤트(경기 시작): `matches.start_notification_sent_at` 같은 완료 마커 컬럼 + `is("...", null)` 조건.
- 반복 이벤트(경기 이벤트): `dedupe_key` 유니크 인덱스 + `upsert(..., { onConflict, ignoreDuplicates: true }).select(...)` — 응답으로 돌아온 행만 "이번에 실제로 새로 생긴" 것이므로 그 행에 대해서만 발송한다.

### 2.5 발송은 유저가 기다리는 응답을 막지 않는다
라이브 폴링처럼 유저 화면이 응답을 기다리는 경로에서는 `void sendX(...).catch(console.error)` 형태로 fire-and-forget 처리한다. 크론처럼 원래 백그라운드인 경로는 await해도 된다.

### 2.6 만료/무효 토큰은 발송 직후 정리한다
Expo 응답의 `DeviceNotRegistered` 티켓은 `push_tokens`에서 바로 삭제한다(`lib/notify/push.ts`가 이미 `invalidTokens`를 돌려준다).

### 2.7 포그라운드(앱 켜져있을 때)는 시스템 배너 대신 인앱 토스트
`mobile/lib/push-notifications.ts`의 `Notifications.setNotificationHandler`가 포그라운드 알림의 시스템 배너를 끄고, `subscribeToForegroundPushToasts`가 기존 토스트(`useMinionShell().showToast`)로 대신 띄운다. 새 알림 타입을 추가해도 이 동작은 공통이라 손댈 필요 없다.

### 2.8 발송량이 많을 수 있는 알림은 사전에 확인받는다
킬처럼 한 경기에 수십 번 발생하는 이벤트를 실제 푸시로 보낼지는 스팸 체감이 큰 제품 결정이다. 새로 이런 알림을 추가할 때는 "OO까지 다 보낼지, 주요 오브젝트만 보낼지" 미리 확인하고 진행한다.

### 2.9 메시지는 항상 간결하고 보기 쉽게 쓴다
알림 제목/본문은 길게 설명하지 않는다. 불필요한 조사·감탄부호·수식어를 빼고 핵심만 남긴다(예: "Faker킬 (Chovy)"). 잠금화면/알림함에서 한눈에 읽혀야 한다.

### 2.10 발송 전 반드시 유저의 알림 설정을 확인한다
어떤 알림이든 예외 없이 발송 직전에 해당 유저의 `user_notification_preferences` 값을 확인한 뒤에만 보낸다. "일단 보내고 나중에 걸러낸다"처럼 설정 확인을 생략하거나 뒤로 미루는 구현은 금지한다.

### 2.11 알림 관련 코드는 항상 최적화하고, 운영에 필요한 것만 남긴다
불필요한 추상화·중복 로직·과한 방어 코드를 만들지 않는다. 디버그용 로그(`console.log('[push] ...')` 등)나 테스트 전용 우회 코드는 목적을 다하면 제거한다 — 운영에 실제로 필요한 코드만 남긴다.

## 3. 새 알림 타입을 추가할 때 체크리스트

1. `user_notification_preferences`에 컬럼이 필요하면 마이그레이션 추가 + 위 표 갱신
2. 발송 트리거: 부하가 가장 적은 방식 비교해서 선택(2.1)
3. 대상 유저 필터링: 발송 직전 알림 설정 확인(2.10), 옵트인/아웃 방향 확인(2.3), 토큰 있는 유저만
4. 중복 방지 방식 결정(2.4)
5. 메시지 문구: 한국어, 간결하고 보기 쉽게(2.9, 예: "Faker킬 (Chovy)")
6. `lib/notify/push.ts`의 `sendExpoPushNotifications` 재사용, 새 발송 유틸 만들지 않기
7. 디버그 로그·임시 코드 제거(2.11)
8. 타입체크·lint·`npm test` 통과 확인

## 4. 로컬 테스트 환경(한 번만 하면 됨)

- **Expo Go로는 안 됨** — SDK 53부터 원격 푸시가 제거됨. `expo-dev-client` 설치 후 `npx expo run:android`로 만든 전용 dev client 앱으로만 테스트 가능.
- **Android 에뮬레이터**: `Device.isDevice`가 `false`로 나온다 — 에뮬레이터 테스트를 막지 않으려면 이 값으로 등록 로직을 막지 않는다.
- **Android는 Firebase(FCM V1) 설정이 필수**:
  1. Firebase 콘솔에서 프로젝트 생성, Android 앱 추가(패키지명 `com.minion.app`)
  2. `google-services.json` 다운로드 → `mobile/google-services.json`(gitignore됨) → `app.json`의 `android.googleServicesFile`로 연결
  3. Firebase 콘솔 "프로젝트 설정 > 서비스 계정"에서 비공개 키(JSON) 생성
  4. `npx eas-cli@latest credentials` → Android → **"Google Service Account"**(Push Notifications 메뉴 아님) → 서비스 계정 키 업로드
  5. google-services.json을 바꾸면 네이티브 재빌드(`npx expo run:android`) 필요
- **에뮬레이터 API 접근**: `next.config.ts`의 `allowedDevOrigins`에 `10.0.2.2` 포함 필요(에뮬레이터는 PC의 실제 LAN IP가 아니라 `10.0.2.2`로 호스트에 접근함). `mobile/.env`의 `EXPO_PUBLIC_API_URL`도 에뮬레이터 테스트 중엔 `http://10.0.2.2:3000`으로.
- 테스트 발송: https://expo.dev/notifications 에 토큰 붙여넣고 바로 보내볼 수 있다(크론/실제 이벤트를 기다릴 필요 없음).

## 5. 알려진 제약

- iOS는 로컬(Windows) 빌드 불가 — Mac 또는 EAS 클라우드 빌드 필요.
- 앱스토어에 올리지 않을 경우, iOS 사용자는 PWA(홈 화면에 추가)로만 앱과 유사한 경험 제공 가능. PWA 푸시는 Expo 네이티브와 별개 구현(Web Push API, iOS 16.4+)이 필요.
