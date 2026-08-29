# 푸시 알림 개발 규칙

이 문서는 모바일 푸시 알림 기능을 만들거나 새 알림 종류를 추가할 때 지켜야 할 규칙을 정리한다. 초안은 Claude가 작성했고, 이후 실제 운영하면서 맞는 방향으로 계속 고쳐나간다.

## 1. 현재 상태

| 알림 종류 | 화면 토글 | 기본값 | 실제 푸시 발송 |
| --- | --- | --- | --- |
| 전체 알림 | `전체 알림` | 켜짐 | 팀·커뮤니티 알림의 마스터 스위치 |
| 커뮤니티 | `커뮤니티 알림` | 켜짐 | 내 글의 새 댓글·내 댓글의 새 답글을 알림함에 저장(원격 푸시 전) |
| 경기 시작·세트 평가 | 팀별 `경기` | 꺼짐(알림 벨을 직접 켜면 활성화) | ✅ 구현됨(모바일 푸시 + 웹/앱 토스트) |
| 경기 주요 이벤트 | 팀별 `라이브 경기` | 꺼짐 | ✅ 구현됨(모바일 푸시 + 웹/앱 토스트) |
| Instagram | 팀별 `Instagram` | 꺼짐 | ✅ 구현됨(팀·현재 소속 선수 게시물) |
| 동영상 | 팀별 `동영상` | 꺼짐 | ✅ 구현됨(팀·현재 소속 선수 영상) |
| 솔랭 | 팀별 `솔랭` | 꺼짐 | 설정 저장 구현됨, 시작 감지 소스 연결 전 |

- 전체 마스터와 커뮤니티 설정은 `user_notification_preferences.in_app_enabled`, `community_enabled`를 쓰고, 팀별 종류는 `fan_notification_subscriptions`의 알림 컬럼을 쓴다. 팔로우 팀마다 한 행만 유지한다.
- 토큰 저장은 `push_tokens` 테이블(user_id, expo_push_token, platform). 발송 헬퍼는 `lib/notify/push.ts`의 `sendExpoPushNotifications`.
- 팀 팔로우·최애팀 지정은 알림 수신 동의가 아니다. 새 팔로우 행은 모든 팀 알림을 끈 상태로 만들고, 사용자가 팬페이지 알림 벨이나 내 정보의 팀별 설정에서 직접 켠 종류만 발송한다.
- OS 푸시 허용 여부는 기기별이고, 알림 종류 설정은 계정에 동기화된다. 로그인·세션 복원에서는 이미 허용된 기기의 토큰만 동기화하며 OS 권한 팝업을 띄우지 않는다.
- 이 문서는 모바일 푸시 기준으로 쓰여있지만, 경기 이벤트는 웹에서 `components/match-activity/use-match-activity.ts`의 `publishNotification`을 통해 토스트(+ 알림함)로도 나간다. 팀 영상·소셜은 `team_content_notifications`를 웹/앱이 공통 조회하며, 새 서버 알림을 감지하면 토스트로도 보여준다.

## 2. 설계 원칙

### 2.1 발송 트리거는 서버 부하/리소스가 가장 적게 드는 방식으로 고른다
원칙은 "기존 트리거 재사용"이 아니라 **서버 부하와 리소스 소모를 최소화하는 것**이다. 기존 트리거 재사용은 그 목적을 위한 대표적인 수단일 뿐이고, 상황에 따라 가벼운 새 크론이 오히려 더 저렴할 수 있다. 매번 후보들을 비교해서 가장 싼 방식을 고른다.
- 예: "경기 주요 이벤트"는 새 크론 없이 `app/api/matches/[matchId]/live/route.ts`(유저가 라이브 탭을 볼 때만 도는 기존 폴링)에 얹었다 — 이미 나가는 요청에 얹는 게 새 폴링을 도는 것보다 저렴했기 때문.
- 예: "경기 시작"은 재사용할 기존 트리거가 없어서(아무도 안 보고 있어도 발송돼야 함) 새 크론을 만들었다 — 대신 크론 자체를 우리 DB만 조회하는 가벼운 쿼리로 유지해 비용을 낮췄다(외부 API 호출 없음). 이런 경우 `private.invoke_*_automation()` + `cron.schedule(...)` 패턴을 따른다(`supabase/migrations/20260702012441_schedule_lolesports_rating_automation.sql` 등 기존 예시 참고).
- 예: "팀 영상·소셜"은 YouTube WebSub와 Instagram 동기화가 새 행을 확인한 시점에 바로 발송한다. 별도 폴링 크론을 추가하지 않으며 `team_content_notifications.dedupe_key`로 재수집·동시 실행 중복을 막는다.

### 2.2 발송 시각은 "예정"이 아니라 "실제로 일어난 시점" 기준
경기 지연 등으로 예정 시각이 부정확할 수 있으면, 가능한 한 실제 이벤트가 감지된 시점에 맞춰 발송한다. "경기 시작"은 예정 시각 크론이지만, 크론 자체가 "지나간 예정 시각"을 찾는 방식이라 5~10분 전 예고가 아니라 시작 시점에 맞춰 보낸다.

### 2.3 전체 마스터와 팀별 설정을 모두 확인한다
발송 직전 `user_notification_preferences.in_app_enabled`가 꺼진 유저를 먼저 제외하고, 이벤트 팀의 `fan_notification_subscriptions` 알림 컬럼이 켜진 유저만 포함한다. 팀별 설정을 우회해 `team_fans`만으로 대상을 만들지 않는다.

### 2.4 중복 발송 방지는 메모리가 아니라 DB로, 조회와 마킹을 한 번에 원자적으로
동시 요청/재시도가 겹칠 수 있으므로, in-memory 플래그로 막지 않는다. "조회 → 발송 → 마킹" 순서로 짜면, 크론 실행이 겹칠 때(한 번의 실행이 다음 크론 주기를 넘기는 경우) 마킹되기 전에 두 실행이 같은 대상을 동시에 집어갈 수 있다 — 반드시 조회와 마킹을 하나의 원자적 UPDATE로 묶는다.
- 1회성 이벤트(경기 시작, 세트 평가 오픈): `matches.start_notification_sent_at` / `match_automation_events.push_delivered_at` 같은 완료 마커 컬럼에 대해 `UPDATE ... SET 마커 = now() WHERE 마커 IS NULL AND ... .select(...)` 형태로 조회와 마킹을 한 번에 한다(Postgres가 UPDATE 중 대상 행에 락을 걸어준다). "SELECT 후 개별 마킹"으로 짜지 않는다.
- 반복 이벤트(경기 이벤트): `dedupe_key` 유니크 인덱스 + `upsert(..., { onConflict, ignoreDuplicates: true }).select(...)` — 응답으로 돌아온 행만 "이번에 실제로 새로 생긴" 것이므로 그 행에 대해서만 발송한다.
- **주의**: 위 방식 모두 마킹이 발송보다 먼저(또는 발송과 동시에) 확정되므로, 그 항목은 두 번 다시 조회되지 않는다 — 즉 발송 자체가 실패해도 재시도되지 않는다. 그래서 여러 건을 한 번에 처리할 때는 항목 하나(매치 하나, 이벤트 하나, 메시지 하나)의 처리를 반드시 `try/catch`로 감싸서, 한 항목의 에러가 같은 배치의 나머지 항목까지 덩달아 처리 못 하게 막지 않도록 한다.

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
어떤 팀 알림이든 예외 없이 발송 직전에 전체 마스터와 해당 팀의 종류별 설정을 함께 확인한 뒤에만 보낸다. "일단 보내고 나중에 걸러낸다"처럼 설정 확인을 생략하거나 뒤로 미루는 구현은 금지한다.

### 2.11 알림 관련 코드는 항상 최적화하고, 운영에 필요한 것만 남긴다
불필요한 추상화·중복 로직·과한 방어 코드를 만들지 않는다. 디버그용 로그(`console.log('[push] ...')` 등)나 테스트 전용 우회 코드는 목적을 다하면 제거한다 — 운영에 실제로 필요한 코드만 남긴다.

### 2.12 OS 권한은 사용자의 알림 선택 직후에만 요청한다
로그인, 회원가입, 세션 복원, 앱 최초 실행만으로 알림 권한을 요청하지 않는다. 팬페이지의 알림 벨 또는 내 정보의 `푸시 알림 (이 기기)`를 사용자가 직접 선택한 다음에만 요청한다. 거절된 권한은 반복 요청하지 않고 시스템 설정 이동을 제공한다.

- Android 알림 채널은 권한 요청 전에 생성한다.
- iOS는 배너와 소리만 요청하며, 실제 배지 수를 관리하기 전까지 배지 권한을 요청하지 않는다.
- 경기 시작·세트 평가는 `match` 채널과 기본 소리를 사용한다.
- 라이브 경기 이벤트는 `live` 채널, 팀 소셜·영상은 `content` 채널을 사용하며 기본 무음이다.
- Expo Go에서는 원격 푸시를 지원하지 않으므로 권한 UI를 비활성화하고 개발 빌드에서 검증한다.

## 3. 새 알림 타입을 추가할 때 체크리스트

1. 팀별 알림 컬럼이 필요하면 `fan_notification_subscriptions`에 추가하고 위 표 갱신
2. 발송 트리거: 부하가 가장 적은 방식 비교해서 선택(2.1)
3. 대상 유저 필터링: 발송 직전 알림 설정 확인(2.10), 옵트인/아웃 방향 확인(2.3), 토큰 있는 유저만
4. 중복 방지 방식 결정(2.4)
5. 메시지 문구: 한국어, 간결하고 보기 쉽게(2.9, 예: "Faker킬 (Chovy)")
6. `lib/notify/push.ts`의 `sendExpoPushNotifications` 재사용, 새 발송 유틸 만들지 않기
7. 웹에서도 토스트로 보여줄지 결정하고, 보여준다면 `components/match-activity/use-match-activity.ts`에서 해당 이벤트를 `publishNotification`으로 연결(빠뜨리면 알림함에만 조용히 쌓이고 토스트는 안 뜬다 — 실제로 이 문서의 "경기 시작"/"세트 평가 오픈"이 한동안 이 상태였다)
8. 디버그 로그·임시 코드 제거(2.11)
9. 타입체크·lint·`npm test` 통과 확인

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
