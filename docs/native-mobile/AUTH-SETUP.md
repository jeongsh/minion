# 네이티브 앱 인증 설정

4단계 인증 구현을 실제 기기에서 켜기 위한 운영 체크리스트다. 앱에는 Supabase publishable key만 들어가며 service role과 OAuth client secret은 Next 서버에만 둔다.

## 환경 변수

`mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=https://minion.fan
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Next 서버:

```dotenv
NEXT_PUBLIC_SITE_URL=https://minion.fan
NAVER_LOGIN_CLIENT_ID=
NAVER_LOGIN_CLIENT_SECRET=
```

## Provider·redirect 설정

- Supabase Auth URL allow-list에 `minion://auth/callback`을 등록한다.
- 개발 빌드의 `Linking.createURL("auth/callback")` 결과도 테스트용 allow-list에 등록한다. Expo Go 주소는 개발 머신에 따라 달라질 수 있다.
- Supabase에서 Email, Google, Kakao, Apple provider를 활성화하고 각 provider console의 Supabase callback URL을 등록한다.
- Naver Login callback은 `https://minion.fan/api/mobile/v1/auth/naver/callback`이다.
- iOS에서 Google/Kakao/Naver 로그인을 노출하는 현재 UI는 Apple 로그인도 함께 노출한다.

## DB migration

`20260824100656_add_mobile_auth_exchange_codes.sql`을 배포해야 Naver 앱 로그인이 동작한다. 테이블은 RLS를 켜고 `anon`/`authenticated` 접근을 전부 회수했으며 Next의 service role만 사용한다.

## 실제 기기 확인

1. 이메일 로그인, 이메일 확인 후 앱 복귀, 앱 재실행 시 세션 복원을 확인한다.
2. Google, Kakao, Apple, Naver 각각에서 로그인 직전 화면으로 돌아오는지 확인한다.
3. Naver callback URL에는 짧게 만료되는 일회용 코드만 있고 access/refresh token이 없는지 확인한다.
4. 로그아웃 후 SecureStore 세션이 지워지고 계정 최애팀 상태가 셸에서 제거되는지 확인한다.
5. 만료·삭제된 세션은 로그인 화면으로 돌아가며 RLS가 다른 사용자의 설정·차단 목록을 거부하는지 확인한다.
