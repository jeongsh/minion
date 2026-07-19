# MINION 프로젝트 점검 및 병렬 작업 백로그

- 작성일: 2026-07-19
- 목적: 프로젝트 전반 점검 결과를 여러 에이전트가 충돌 없이 병렬로 개선할 수 있는 실행 단위로 정리한다.
- 현재 판단: 서비스 기능 범위는 충분하지만, 공개 배포 전 관리자 보안, 운영 스크립트 실행 방식, 데스크톱 레이아웃, 품질 게이트를 우선 해결해야 한다.

## 1. 현재 검증 결과

| 항목 | 결과 | 비고 |
| --- | --- | --- |
| TypeScript | 통과 | `npm run typecheck` |
| 단위 테스트 | 통과 | 64개 테스트 |
| 프로덕션 빌드 | 통과 | 약 141개 라우트, 동적 스크립트 추적 경고 존재 |
| ESLint | 실패 | 실제 소스 기준 24 errors, 44 warnings |
| 브라우저 런타임 | 주요 화면 콘솔 오류 없음 | 데스크톱·모바일 수동 점검 |
| E2E | 없음 | Playwright 의존성만 설치됨 |
| Supabase RLS | 운영 public 테이블 활성화 확인 | Service Role 사용부는 별도 애플리케이션 권한 검사가 필요함 |

## 2. 병렬 작업 공통 규칙

1. 기존 작업 트리가 수정된 상태이므로 담당 파일 밖의 변경을 되돌리거나 정리하지 않는다.
2. `git reset --hard`, 광범위한 checkout, 무관한 포맷팅을 하지 않는다.
3. 관리자 보안 작업 전에는 운영 데이터 변경 API를 실제 호출하지 않는다.
4. 각 트랙은 자기 담당 파일만 수정하고, 공용 파일 변경이 필요하면 결과 보고에 명시한다.
5. 완료 시 실행한 검증 명령, 변경 파일, 남은 위험을 함께 보고한다.
6. 새 마이그레이션은 기존 마이그레이션을 수정하지 말고 새 타임스탬프 파일로 추가한다.
7. Service Role은 사용자 인증과 관리자 권한 확인이 끝난 뒤에만 사용한다.

### 현재 수정 중인 파일

아래 파일은 점검 당시 이미 수정된 상태였다. 담당 에이전트가 건드려야 한다면 기존 변경을 먼저 읽고 보존한다.

```text
app/layout.tsx
app/matches/[matchId]/page.tsx
app/me/page.tsx
app/players/[playerSlug]/page.tsx
app/schedule/page.tsx
components/layout/app-shell.tsx
lib/auth/action-state.ts
lib/auth/actions.ts
lib/team-logos.ts
lib/tournaments/international-segments.ts
next-env.d.ts
components/auth/delete-account-form.tsx
components/auth/password-form.tsx
```

## 3. 권장 병렬 실행 구성

### Wave 1 — 동시에 실행 가능

| 트랙 | 우선순위 | 담당 영역 | 주요 파일 | 다른 트랙과의 충돌 |
| --- | --- | --- | --- | --- |
| A. 관리자 보안 | P0 | 관리자 인증·인가, 운영 스크립트 API | `app/admin/**`, `app/api/admin/**`, 신규 `lib/auth/require-admin.ts` | E와 인증 헬퍼 설계만 조율 |
| B. 반응형 레이아웃 | P0 | 사이드바 겹침, 모바일 핵심 콘텐츠 | `components/layout/app-shell.tsx`, `components/domain/home-dashboard.tsx` | 기존 수정 보존 필요 |
| C. 품질 게이트 | P0 | lint, CI, E2E 기반 | `eslint.config.mjs`, `package.json`, `.github/workflows/**`, `e2e/**` | 다른 트랙 완료 전 선택적 테스트로 작성 |
| D. SEO·콘텐츠 표면 | P1 | 메타데이터, sitemap, robots, 리포트 신뢰 정보 | `app/**/page.tsx`, `app/sitemap.ts`, `app/robots.ts` | 수정 중 페이지는 충돌 주의 |
| E. 업로드·Supabase 보안 | P0 | 업로드 제한, DB Advisor, 환경 재현성 | `app/api/community/upload/**`, `supabase/**`, `.env.example` | A의 인증 헬퍼를 재사용할 수 있음 |

### Wave 2 — Wave 1 이후 권장

| 트랙 | 우선순위 | 선행 조건 |
| --- | --- | --- |
| F. 실제 알림 기능 | P1 | A의 권한 패턴과 E의 DB 마이그레이션 방식 확정 |
| G. 인증 완성도 | P1 | A의 관리자 역할 모델 확정, 기존 auth 변경 병합 |
| H. 콘텐츠 정리·초기 운영 | P1 | 운영 DB 쓰기 승인과 관리자 도구 보호 완료 |
| I. 개인화·실시간 기능 | P2 | 알림·인증·관측 체계 완료 |

## 4. 트랙별 작업 명세

### Track A — 관리자 보안 및 스크립트 실행 제거

#### 발견 사항

- 로그아웃 상태에서도 `/admin` UI 접근이 가능하다.
- `app/admin/**/actions.ts` 다수가 관리자 확인 없이 `createSupabaseAdminClient()`를 사용한다.
- `app/api/admin/run-script/route.ts`는 인증 없이 허용 목록의 운영 스크립트를 실행한다.
- 실행부가 전체 `process.env`를 전달하고 `shell: true`를 사용한다.
- 빌드 시 해당 API 때문에 프로젝트 전체가 추적된다는 경고가 발생한다.

#### 구현 목표

- 서버 전용 `requireAdmin()`을 만든다.
- 역할 원천은 Supabase `app_metadata` 또는 비공개 역할 테이블로 한정한다.
- `app/admin/layout.tsx`, 모든 관리자 Server Action, 모든 `/api/admin/*`에서 독립적으로 검사한다.
- UI 보호만으로 끝내지 않는다.
- `run-script` HTTP API는 제거하고 보호된 GitHub Actions, 작업 큐 또는 별도 워커로 이전한다.
- 불가피하게 임시 유지할 경우 인증, 관리자 검사, Origin 검사, 요청 제한, 감사 로그를 적용하고 `shell: false`로 실행한다.

#### 완료 조건

- 비로그인 사용자의 `/admin` 접근이 로그인 또는 404/403으로 종료된다.
- 일반 로그인 사용자가 관리자 Action/API를 호출해도 403 처리된다.
- Service Role 생성 전에 권한 검사가 수행된다.
- 웹 요청으로 임의 운영 스크립트를 실행할 수 없다.
- 관리자 권한 성공·실패 테스트가 존재한다.

#### 에이전트용 지시문

```text
Track A를 담당해라. 관리자 UI, Server Action, API를 모두 서버 측에서 보호하고,
app/api/admin/run-script/route.ts의 웹 기반 스크립트 실행을 제거하거나 안전한 작업 실행 방식으로 이전해라.
Service Role 사용 전에 중앙 requireAdmin()이 반드시 실행되게 하고 일반 사용자/비로그인 회귀 테스트를 추가해라.
담당 파일 밖 기존 변경은 보존하고, 실제 운영 데이터 변경 요청은 실행하지 마라.
```

### Track B — 데스크톱 사이드바 및 모바일 홈

#### 발견 사항

- 1280px에서 216px 사이드바가 표시되지만 본문은 64px만 이동한다.
- `/tournaments`, `/players`, `/reports`의 왼쪽 콘텐츠가 사이드바 아래에 가려진다.
- 원인은 `components/layout/app-shell.tsx`의 `md:pl-16`과 `min-[1200px]:pl-[216px]`이 동시에 적용되는 구조다.
- 모바일 홈은 “오늘의 매치”, 순위, 최근 폼 섹션 전체를 숨긴다.

#### 구현 목표

- 태블릿 768~1199px과 데스크톱 1200px 이상 padding 클래스를 상호 배타적으로 만든다.
- 사이드바 접힘/펼침 상태 모두 본문 시작점과 일치시킨다.
- 모바일 홈에 오늘의 경기 1개 이상과 순위/최근 폼 축약 UI를 제공한다.
- 기존 디자인 언어와 팬 채널 레이아웃은 유지한다.

#### 완료 조건

- 390, 768, 1024, 1200, 1280, 1440px에서 수평 잘림과 사이드바 겹침이 없다.
- `/`, `/schedule`, `/players`, `/tournaments`, `/reports`, `/fan/t1` 회귀 확인을 완료한다.
- Playwright 또는 재사용 가능한 viewport 검증이 추가된다.

#### 에이전트용 지시문

```text
Track B를 담당해라. app-shell의 태블릿/데스크톱 padding 충돌을 수정하고,
모바일 홈에서 숨겨진 오늘의 매치와 순위/최근 폼을 축약형으로 복구해라.
390/768/1024/1200/1280/1440px에서 핵심 라우트를 검증해라.
components/layout/app-shell.tsx에는 기존 미커밋 변경이 있으므로 반드시 보존하며 작업해라.
```

### Track C — ESLint, CI, E2E 품질 게이트

#### 발견 사항

- ESLint가 실제 소스 기준 24 errors, 44 warnings로 실패한다.
- `eslint .`이 `.claude/worktrees`까지 순회해 중복 오류를 만든다.
- 주요 오류는 `no-img-element`, `no-explicit-any`, unused vars, effect 내 setState다.
- PR용 typecheck/test/lint/build CI가 없다.
- Playwright는 설치됐지만 E2E 테스트와 npm script가 없다.
- `error.tsx`, `global-error.tsx`, 관측 도구가 없다.

#### 구현 목표

- 생성물·worktree·캐시·외부 작업 디렉터리를 lint 대상에서 제외한다.
- 실제 오류를 규칙 비활성화가 아니라 코드 수정으로 해결한다.
- PR CI에 typecheck, unit test, lint, build를 추가한다.
- 인증이 필요 없는 핵심 라우트와 비로그인 관리자 차단 E2E를 추가한다.
- 브라우저 오류와 깨진 링크를 최소 smoke 범위에서 탐지한다.

#### 완료 조건

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`가 모두 통과한다.
- CI가 pull request와 push에서 실행된다.
- 최소 `/`, `/schedule`, `/players`, `/tournaments`, `/reports`, `/admin` smoke 테스트가 있다.

#### 에이전트용 지시문

```text
Track C를 담당해라. ESLint 탐색 범위를 정상화하고 실제 lint 오류를 수정한 뒤,
PR용 typecheck/test/lint/build CI와 최소 Playwright smoke 테스트를 추가해라.
다른 트랙이 수정 중인 기능 코드는 불필요하게 리팩터링하지 말고 품질 인프라와 명백한 lint 수정에 집중해라.
```

### Track D — SEO, 검색 노출, 리포트 신뢰성

#### 발견 사항

- 일정·선수·팀·대회 등 주요 페이지 제목이 대부분 동일하다.
- sitemap은 정적 경로만 포함하며 팀, 선수, 경기, 팬 채널, 리포트 상세를 누락한다.
- Open Graph, Twitter Card, canonical, JSON-LD가 부족하다.
- `/lab/chzzk-concept`가 공개·색인 가능하다.
- 주간 리포트에 생성일, 검수 여부, 출처, 정정 안내가 부족하다.

#### 구현 목표

- 주요 정적·동적 페이지에 `generateMetadata()`를 적용한다.
- 동적 sitemap을 만들고 실제 수정일을 사용한다.
- 팀/선수/경기에 적합한 Breadcrumb, SportsEvent, Article 구조화 데이터를 추가한다.
- admin, auth, lab 실험 경로는 noindex 처리하거나 운영 빌드에서 제외한다.
- AI 리포트에 생성·검수·출처·정정 정보를 표시한다.

#### 완료 조건

- 주요 페이지마다 고유 title/description/canonical/OG 정보가 있다.
- sitemap에 실제 공개 상세 페이지가 포함된다.
- 구조화 데이터 검증에서 JSON 문법 오류가 없다.
- 실험·관리 경로가 검색 색인 대상이 아니다.

#### 에이전트용 지시문

```text
Track D를 담당해라. 주요 정적/동적 페이지의 metadata, canonical, OG, sitemap, robots,
구조화 데이터를 개선하고 주간 리포트에 생성·검수·출처·정정 정보를 추가해라.
app/layout.tsx와 일부 상세 페이지에는 기존 변경이 있으므로 덮어쓰지 말고 필요한 경우 최소 변경만 적용해라.
```

### Track E — 업로드, Supabase Advisor, 환경 재현성

#### 발견 사항

- 커뮤니티 업로드가 최대 20MB 파일을 Service Role로 공개 버킷에 업로드한다.
- 사용자별 용량/횟수 제한, 파일 시그니처, 이미지 크기, 리사이징, 고아 파일 정리가 없다.
- Supabase Advisor에서 mutable function `search_path`, 광범위한 공개 버킷 listing 정책, 외래키 인덱스 누락이 확인됐다.
- 누출 비밀번호 보호가 비활성화되어 있다.
- `supabase/config.toml`과 일관된 초기 마이그레이션 기준선이 없다.
- `.env.example`에 Supabase, Cron, 외부 동기화 필수 변수가 다수 빠져 있다.

#### 구현 목표

- 업로드에 크기, 실제 파일 형식, 이미지 차원, 사용자 쿼터, 요청 제한을 적용한다.
- 서버에서 안전한 포맷으로 재인코딩하거나 검증된 이미지 처리 경로를 사용한다.
- 고아 업로드 정리 정책을 추가한다.
- Advisor 경고를 검토하고 안전한 항목만 새 마이그레이션으로 수정한다.
- public object URL 제공과 bucket listing 권한을 분리한다.
- 로컬 Supabase 재현 절차와 환경변수 문서를 완성한다.

#### 완료 조건

- 확장자 위장, 초과 용량, 비정상 차원, 쿼터 초과 업로드가 거부된다.
- 업로드 성공/실패 테스트가 있다.
- 함수 `search_path`가 고정되고 필요한 FK 인덱스가 추가된다.
- 새 환경에서 문서만으로 Supabase와 앱을 구동할 수 있다.

#### 에이전트용 지시문

```text
Track E를 담당해라. 커뮤니티 업로드의 형식/크기/차원/쿼터/rate limit을 보강하고,
Supabase Advisor의 search_path, storage listing, FK index 경고를 검토해 새 마이그레이션으로 수정해라.
기존 마이그레이션은 변경하지 말고 .env.example과 로컬 재현 문서를 보완해라.
운영 DB 쓰기는 명시적 승인 없이 실행하지 마라.
```

## 5. Wave 2 기능 백로그

### Track F — 실제 팬 알림

- 현재 `components/fan/fan-channel-header.tsx`의 알람 버튼은 동작이 없다.
- 경기 시작, 대진 확정, 로스터 변경, 팀 뉴스별 구독 옵션을 제공한다.
- 웹 푸시가 부담되면 우선 앱 내 알림함과 이메일/Discord 중 한 채널부터 시작한다.
- 권한 요청 전 알림 가치와 빈도를 설명하고 설정에서 언제든 해제할 수 있어야 한다.

### Track G — 인증 완성도

- 비밀번호 찾기와 재설정 링크 처리
- 이메일 인증 대기·완료·재전송 UX
- 세션 목록과 다른 기기 로그아웃
- 누출 비밀번호 보호 활성화
- 필요 시 카카오 또는 Google 간편 로그인

### Track H — 콘텐츠 출시 준비

- 커뮤니티와 팬 게시판의 테스트·무의미 게시물 제거
- 인기글이 작동하도록 초기 유용 게시물과 토론 주제 준비
- 팀별 공지, 입문 FAQ, 일정 안내, 선수 소개 콘텐츠 시딩
- `TBD` 대진에 상대 확정 조건과 예상 시점을 표시
- 히어로 슬라이드별 대비·크롭·빈 이미지 QA
- 콘텐츠 정정 및 신고 운영 절차 확립

### Track I — 성장 기능

- 팔로우 팀 기반 “내 팀 홈”과 개인화 피드
- 일정 `.ics` 내보내기와 캘린더 구독
- 경기·선수·팀·리포트·커뮤니티 통합 검색
- 실시간 경기 센터와 예측 상태 자동 갱신
- 커뮤니티 기여도·신뢰도·온보딩 시스템

## 6. 성능 및 관측 후속 작업

- `next.config.ts`의 전역 `images.unoptimized: true`를 제거한다.
- 작은 게임 아이콘만 개별 `unoptimized` 또는 전용 loader로 예외 처리한다.
- 히어로와 선수 사진에는 `sizes`, 적절한 quality, 활성 슬라이드 우선 로딩을 적용한다.
- `error.tsx`, `global-error.tsx`, `not-found.tsx` 역할을 정리한다.
- 오류 추적, 배포 버전, Core Web Vitals를 수집한다.
- 업로드, 관리자 Action, 외부 동기화 작업에 구조화 감사 로그를 남긴다.

## 7. 최종 통합 체크리스트

- [ ] 비로그인 및 일반 사용자가 관리자 UI, Action, API를 사용할 수 없다.
- [ ] 웹 요청으로 서버 운영 스크립트를 실행할 수 없다.
- [ ] 390~1440px 핵심 화면에서 콘텐츠 잘림이 없다.
- [ ] 모바일에서도 오늘의 경기와 핵심 순위 정보를 확인할 수 있다.
- [ ] `npm run lint`가 실제 저장소 소스만 검사하고 통과한다.
- [ ] typecheck, test, lint, build, smoke E2E가 CI에서 통과한다.
- [ ] 업로드 악용 방지와 고아 파일 정리가 적용됐다.
- [ ] Supabase Advisor의 보안 경고를 검토·처리했다.
- [ ] 주요 공개 페이지에 고유 metadata와 sitemap 등록이 있다.
- [ ] 테스트 게시물과 미완성 콘텐츠가 운영 화면에서 제거됐다.
- [ ] 알람 버튼이 실제 기능으로 연결되거나 출시 전 숨겨졌다.
- [ ] 오류 추적과 운영 감사 로그가 준비됐다.

## 8. 참고 파일

- `app/api/admin/run-script/route.ts`
- `app/admin/**/actions.ts`
- `components/layout/app-shell.tsx`
- `components/domain/home-dashboard.tsx`
- `components/fan/fan-channel-header.tsx`
- `app/api/community/upload/route.ts`
- `app/layout.tsx`
- `app/sitemap.ts`
- `app/robots.ts`
- `next.config.ts`
- `eslint.config.mjs`
- `.env.example`
- `supabase/migrations/**`

## 9. 공식 보안 참고 자료

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API 보안: https://supabase.com/docs/guides/api/securing-your-api
- Supabase 비밀번호 보안: https://supabase.com/docs/guides/auth/password-security

