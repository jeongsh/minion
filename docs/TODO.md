# TODO

작업이 끝나면 해당 항목을 `[x]`로 체크한다. 새 작업이 생기면 가장 가까운 단계 아래에 작은 단위로 추가한다.

## 완료된 기반 작업

- [x] Next.js App Router 프로젝트 기본 구조 생성
- [x] TypeScript, Tailwind CSS, ESLint, Next 설정 추가
- [x] Supabase 프로젝트 URL과 publishable key 환경 변수 연결
- [x] Supabase MCP 프로젝트 범위 설정 추가
- [x] LCK 통합 허브 주요 라우트 생성
- [x] 팀별 팬 사이트 `/fan/[teamSlug]` 라우트 생성
- [x] 관리자 `/admin` 하위 라우트 초안 생성
- [x] mock 데이터 구조 작성
- [x] 팀 테마 토큰 구조 작성
- [x] 팬 평점과 최근 폼 계산 책임 분리
- [x] Supabase 스키마 SQL 초안 작성
- [x] 서브도메인 rewrite용 `proxy.ts` 초안 작성
- [x] README 한국어화
- [x] TODO 한국어 체크리스트화
- [x] 홈 화면을 `LCK.txt` 사이트맵의 7개 섹션 순서로 재구성
- [x] `/teams` 화면을 `sitemap.txt`의 팀 순위표 구조로 재구성
- [x] `/teams/[teamSlug]` 화면에서 페이지 설명문 제거
- [x] `/teams/[teamSlug]` 화면을 기준 필터, 팀 요약, 로스터, 팀 스탯 요약, 팀 6각형, 최근 경기, 팬 데이터, 이동 순서로 재구성
- [x] 전체 공개/관리자 라우트의 `SectionHeader` 설명문 prop 제거
- [x] `/schedule` 화면을 `sitemap.txt`의 경기 일정, 경기 결과 구조와 컬럼으로 재구성
- [x] `/standings` 화면을 `sitemap.txt`의 팀 순위표 컬럼으로 재구성
- [x] `/matches/[matchId]` 화면을 경기 요약, 세트별 결과, 세트 상세, 매치 평점, 공식 POM 구조로 재구성
- [x] `/matches/[matchId]/sets/[setId]` 화면을 세트 요약, 밴픽, 팀 스탯, 선수 스탯, 세트 평점/리뷰 구조로 재구성
- [x] 팬사이트 호스트를 `t1`, `geng`, `hle`, `dk`, `kt`, `drx`, `ns`, `bro`, `fox`, `soop` 고정값으로 정리
- [x] 팀명, 축약명, 팀 상세 slug, 로고 변경 이력 구조 추가
- [x] `/admin/teams`에 팀 표시값 변경 UI 초안 추가
- [x] `supabase/schema.sql`에 `team_identity_histories` 초안 추가
- [x] `/players/[playerSlug]` 화면을 기준 필터, 선수 요약, 현재 구간 지표, 팬/수상 데이터, 최근 폼, 라인 내 순위, 선수 6각형, 사용 챔피언, 최근 경기 기록, 같은 팀원, 이동 구조로 재구성

## 바로 다음 우선순위

- [x] `/schedule` UI를 네이버 e스포츠 LCK 일정 화면 레퍼런스 기준으로 재설계
- [x] `/schedule` UI를 리그 선택, 연도/월, 팀 필터, 날짜별 경기 리스트 구조로 재설계
- [x] `/matches/[matchId]`에 세트별 밴 목록과 픽 목록만 단순 추가
- [x] `/matches/[matchId]/sets/[setId]` 밴픽 UI를 첨부 이미지의 방송식 밴픽 화면 기준으로 재설계
- [x] `/matches/[matchId]/sets/[setId]` 세트 종합 결과 UI를 첨부 이미지의 방송식 결과 요약 화면 배치 기준으로 재설계
- [x] 선수 상세를 `LCK.txt`의 선수 요약, 현재 구간 지표, 팬/수상 데이터, 최근 폼, 라인 내 순위, 선수 6각형, 사용 챔피언, 최근 경기 기록 구조로 재구성
- [x] `/stats` 하위 화면을 `sitemap.txt`의 스탯 섹션 순서와 컬럼으로 재검토
- [x] `/community` 하위 화면을 `sitemap.txt`의 게시판 4종 구조로 재검토
- [x] 공통 미니모달 컴포넌트 설계
- [x] 경기/팀/선수/챔피언/세트 미니모달 연결 지점 표시
- [x] Supabase 스키마 적용 여부 결정
- [x] 원격 Supabase DB에 초기 테이블 생성
- [x] seed 데이터 설계 및 입력
- [x] mock 데이터 읽기와 Supabase query 함수의 경계 만들기
- [x] `docs/api.docx` 기준 API/데이터 수집 원칙 정리
- [x] `/admin/matches`에서 실제 경기 생성/수정 폼 구현
- [x] `/admin/sets`에서 실제 세트 생성/수정 폼 구현
- [x] `/admin/teams`에서 실제 팀 생성/수정 폼 구현
- [x] `/admin/teams`에서 팀명/축약명/팀 상세 slug/로고 변경 이력 저장 구현
- [x] `/admin/teams`에서 팬사이트 호스트는 고정 10개 값 중 선택만 허용
- [ ] 팀 상세 slug 변경 시 기존 URL redirect 정책 결정
- [ ] `/admin/players`에서 실제 선수 생성/수정 폼 구현
- [ ] `/admin` 쓰기 기능 전에 인증/권한 가드 추가

## 1단계: DB와 데이터 접근 기반

### Supabase 스키마

- [x] `supabase/schema.sql`을 실제 적용할 migration 단위로 검토
- [x] public 노출 테이블 목록 확정
- [x] 관리자 전용 쓰기 테이블과 공개 읽기 테이블 구분 확인
- [x] RLS 정책 이름과 접근 조건 검토
- [x] `anon` / `authenticated` 명시적 `GRANT` 범위 검토
- [x] `service_role` 전용 작업 범위 정리
- [x] `auth.users` 참조 컬럼의 null 허용 여부 확인
- [ ] fan rating 중복 제출 정책 확정
- [ ] fan POG 중복 투표 정책 확정
- [ ] community post/comment 수정/삭제 정책 확정
- [x] Leaguepedia 원본 ID 컬럼 추가 여부 확정
- [x] Riot `matchId` / platform game id 컬럼 추가 여부 확정
- [x] match timeline frame 테이블 설계
- [x] timeline event 테이블 설계
- [x] soloq account 테이블 설계
- [x] soloq rank snapshot 테이블 설계
- [x] soloq match 테이블 설계
- [x] pro champion stat 테이블 설계
- [x] Data Dragon version/cache 테이블 설계
- [x] live DB에 스키마 적용
- [x] Supabase advisor 보안 결과 확인
- [x] Supabase advisor 성능 결과 확인

### Seed 데이터

- [x] 10개 LCK 팀 seed 데이터 작성
- [x] 팀별 로고/배경 placeholder URL 정책 확정
- [x] 팀별 공식 링크 seed 데이터 작성
- [x] 선수 seed 데이터 작성
- [x] 2026 LCK tournament seed 데이터 작성
- [x] stage seed 데이터 작성
- [x] match seed 데이터 작성
- [x] set seed 데이터 작성
- [x] champion seed 데이터 작성
- [x] set player stat 샘플 데이터 작성
- [x] set team stat 샘플 데이터 작성
- [x] team social post 샘플 데이터 작성
- [x] team video 샘플 데이터 작성
- [x] player broadcast 샘플 데이터 작성
- [x] data source 샘플 데이터 작성

### 데이터 접근 계층

- [x] `lib/supabase/server.ts` 추가
- [x] 브라우저 클라이언트와 서버 클라이언트 책임 분리
- [x] 팀 목록 query 함수 추가
- [x] 팀 상세 query 함수 추가
- [x] 팀 팬 사이트 query 함수 추가
- [x] 선수 목록 query 함수 추가
- [x] 선수 상세 query 함수 추가
- [x] 경기 목록 query 함수 추가
- [x] 경기 상세 query 함수 추가
- [x] 세트 상세 query 함수 추가
- [x] 팀 소식 query 함수 추가
- [x] 커뮤니티 글 목록 query 함수 추가
- [x] 팬 평점 query 함수 추가
- [x] POG 투표 query 함수 추가
- [x] Supabase query 실패 시 mock fallback 정책 결정
- [x] query 함수 단위 타입 정의 정리

## 2단계: 관리자 입력 흐름

### 공통 관리자 UI

- [ ] 관리자 공통 폼 컴포넌트 설계
- [ ] 텍스트 입력 컴포넌트 추가
- [ ] 숫자 입력 컴포넌트 추가
- [ ] 날짜 입력 컴포넌트 추가
- [ ] select 입력 컴포넌트 추가
- [ ] team select 컴포넌트 추가
- [ ] player select 컴포넌트 추가
- [ ] match select 컴포넌트 추가
- [ ] 저장/취소/삭제 버튼 패턴 정리
- [ ] 저장 성공/실패 메시지 패턴 정리
- [ ] 관리자 목록 empty state 정리
- [ ] 관리자 목록 loading state 정리

### 경기 관리

- [x] `/admin/matches` 목록을 Supabase 데이터로 교체
- [x] 경기 생성 폼 추가
- [x] 경기 수정 폼 추가
- [ ] 경기 삭제 또는 비활성 처리 정책 결정
- [x] tournament 선택 연결
- [x] stage 선택 연결
- [x] team A/B 선택 연결
- [x] 경기 날짜 입력 연결
- [x] 경기 상태 `scheduled/live/completed` 입력 연결
- [x] 세트 스코어 입력 연결
- [x] 공식 POM 선수 선택 연결
- [x] 경기장 입력 연결
- [x] 다시보기 URL 입력 연결
- [ ] 저장 후 `/schedule` 반영 확인
- [ ] 저장 후 `/matches/[matchId]` 반영 확인

### 세트 관리

- [x] `/admin/sets` 목록을 Supabase 데이터로 교체
- [x] 세트 생성 폼 추가
- [x] 세트 수정 폼 추가
- [x] match 선택 연결
- [x] set number 입력 연결
- [x] winner team 선택 연결
- [x] blue/red team 선택 연결
- [x] duration 입력 연결
- [x] kill/gold/dragon/baron/tower 입력 연결
- [ ] 저장 후 경기 상세 세트 목록 반영 확인
- [ ] 저장 후 세트 상세 반영 확인

### 밴픽 관리

- [ ] set picks/bans 입력 화면 경로 결정
- [ ] 밴픽 phase 입력 구조 확정
- [ ] pick/ban action type 입력 연결
- [ ] order index 입력 연결
- [ ] team 선택 연결
- [ ] champion 선택 연결
- [ ] side 선택 연결
- [ ] 저장 후 세트 상세에 밴픽 표시

### 선수/팀 스탯 입력

- [ ] set player stats 입력 화면 경로 결정
- [ ] 선수별 K/D/A 입력 연결
- [ ] 선수별 CS 입력 연결
- [ ] 선수별 gold 입력 연결
- [ ] 선수별 damage 입력 연결
- [ ] 선수별 vision score 입력 연결
- [ ] set team stats 입력 화면 경로 결정
- [ ] 팀별 kills/deaths/assists 입력 연결
- [ ] 팀별 total gold/cs/damage 입력 연결
- [ ] 팀별 objective 입력 연결
- [ ] 저장 후 `/stats/players` 반영 확인
- [ ] 저장 후 `/stats/teams` 반영 확인
- [ ] 저장 후 `/stats/form` 반영 확인

### 팀/선수 관리

- [x] `/admin/teams` 목록을 Supabase 데이터로 교체
- [x] 팀 생성 폼 추가
- [x] 팀 수정 폼 추가
- [ ] 팀 slug 중복 검증
- [x] 팀명/축약명/팀 상세 slug/로고 변경 이력 추가 폼 연결
- [x] 변경 이력의 적용 시작일/종료일 검증
- [ ] 현재 표시값과 변경 이력의 적용 구간 충돌 검증
- [ ] fan site host 중복 검증
- [x] fan site host는 `t1`, `geng`, `hle`, `dk`, `kt`, `drx`, `ns`, `bro`, `fox`, `soop` 중 하나만 허용
- [x] 팀 상세 slug와 팬사이트 호스트를 별도 필드로 유지
- [x] 팀 색상 입력 연결
- [x] 공식 링크 입력 연결
- [ ] `/admin/players` 목록을 Supabase 데이터로 교체
- [ ] 선수 생성 폼 추가
- [ ] 선수 수정 폼 추가
- [ ] 선수 slug 중복 검증
- [ ] 선수 소속 팀 선택 연결
- [ ] 선수 포지션 선택 연결
- [ ] 방송 링크 입력 연결
- [ ] 솔랭 계정 입력 연결

## 3단계: 인증과 권한

- [ ] Supabase Auth 사용 방식 확정
- [ ] 로그인 페이지 필요 여부 결정
- [ ] 관리자 접근 가능 계정 기준 확정
- [ ] admin role 저장 위치 확정
- [ ] `/admin` layout에서 권한 가드 추가
- [ ] 서버 액션 또는 route handler에서 쓰기 권한 재검증
- [ ] 비관리자 접근 시 redirect 또는 403 화면 추가
- [ ] 로그아웃 흐름 추가
- [ ] 세션 만료 시 UX 확인
- [ ] 공개 페이지에서 auth 없는 상태 확인

## 4단계: 공개 페이지 Supabase 연결

### LCK 허브

- [ ] `/` 홈 데이터를 Supabase query로 교체
- [ ] `/schedule` 데이터를 Supabase query로 교체
- [ ] `/standings` 데이터를 Supabase query로 교체
- [ ] `/matches/[matchId]` 데이터를 Supabase query로 교체
- [ ] `/matches/[matchId]/sets/[setId]` 데이터를 Supabase query로 교체
- [ ] `/teams` 데이터를 Supabase query로 교체
- [ ] `/teams/[teamSlug]` 데이터를 Supabase query로 교체
- [ ] `/players` 데이터를 Supabase query로 교체
- [ ] `/players/[playerSlug]` 데이터를 Supabase query로 교체

### 스탯

- [ ] `/stats/teams` 데이터를 Supabase query로 교체
- [ ] `/stats/players` 데이터를 Supabase query로 교체
- [ ] `/stats/champions` 데이터를 Supabase query로 교체
- [ ] `/stats/form` 데이터를 Supabase query로 교체
- [ ] `/stats/fan-ratings` 데이터를 Supabase query로 교체
- [ ] `/stats/pom` 데이터를 Supabase query로 교체
- [ ] 공통 `RadarChart` 컴포넌트 구현
- [ ] `/players/[playerSlug]`에 선수 6각형 표시
- [ ] `/teams/[teamSlug]`에 팀 6각형 표시
- [ ] 팀/선수 미니모달의 6각형 축소 표시 구현 여부 결정
- [ ] 6각형 empty/placeholder 상태 구현
- [ ] 최근 폼 계산에 팬 평점이 섞이지 않는지 확인
- [ ] 6각형 계산에 팬 평점이 섞이지 않는지 확인
- [ ] 팬 평점 랭킹이 최근 폼과 분리되어 보이는지 확인
- [ ] MVP 제외 지표가 UI에 노출되지 않는지 확인

### 팀별 팬 사이트

- [ ] `/fan/[teamSlug]` 데이터를 Supabase query로 교체
- [ ] `/fan/[teamSlug]/news` 데이터를 Supabase query로 교체
- [ ] `/fan/[teamSlug]/players` 데이터를 Supabase query로 교체
- [ ] `/fan/[teamSlug]/matches` 데이터를 Supabase query로 교체
- [ ] `/fan/[teamSlug]/community` 데이터를 Supabase query로 교체
- [ ] `/fan/[teamSlug]/info` 데이터를 Supabase query로 교체
- [ ] 팀별 테마 토큰이 DB 값으로 반영되는지 확인
- [ ] `/teams/[teamSlug]`에는 강한 팬 사이트 테마가 들어가지 않는지 확인

## 5단계: 커뮤니티와 팬 반응

### 커뮤니티 게시판

- [ ] community post 목록 query 추가
- [ ] community post 상세 라우트 설계
- [ ] community post 작성 폼 추가
- [ ] community post 수정 폼 추가
- [ ] community comment 목록 query 추가
- [ ] community comment 작성 폼 추가
- [ ] hub 게시판과 team 게시판 scope 분리 확인
- [ ] board type 필터 연결
- [ ] match/set/team/player/champion 연결 필드 UI 추가
- [ ] 추천 수 업데이트 방식 결정
- [ ] 조회 수 업데이트 방식 결정

### 팬 평점

- [ ] 팬 평점 제출 UI 추가
- [ ] set 단위 선수 평점 입력 연결
- [ ] rating 범위 검증
- [ ] review 길이 제한 결정
- [ ] 중복 제출 처리 UX 결정
- [ ] 제출 후 `/stats/fan-ratings` 반영 확인
- [ ] 팬 평점이 최근 폼 계산에 포함되지 않는지 재확인

### 팬 POG

- [ ] 팬 POG 투표 UI 추가
- [ ] set 단위 후보 선수 목록 query 추가
- [ ] 중복 투표 처리 UX 결정
- [ ] 투표 결과 집계 query 추가
- [ ] 경기 상세에 팬 POG 반영
- [ ] 세트 상세에 팬 POG 반영

## 6단계: 출처와 데이터 입력 고도화

- [ ] `data_sources` 관리 화면 추가
- [ ] 경기별 출처 연결 정책 결정
- [ ] 선수 스탯별 출처 연결 정책 결정
- [ ] SourceNotice 문구 위치 재검토
- [ ] `docs/api-data-plan.md` 기준 데이터 수집 정책을 README 또는 운영 문서에 연결
- [ ] Data Dragon 클라이언트 작성
- [ ] Data Dragon 최신 버전 확인 함수 작성
- [ ] 챔피언 이미지 URL 생성 함수 작성
- [ ] Leaguepedia Cargo Query 함수 작성
- [ ] Leaguepedia 경기 일정 동기화 함수 작성
- [ ] Leaguepedia 경기 결과/세트/밴픽/선수 기록 동기화 함수 작성
- [ ] Riot API 서버 전용 클라이언트 작성
- [ ] Riot Timeline 파싱 함수 작성
- [ ] 골드 차이 그래프용 데이터 변환 함수 작성
- [ ] Riot matchId가 없는 세트의 그래프 fallback 정책 구현
- [ ] 선수 솔랭 계정 수집 함수 작성
- [ ] 선수 솔랭 랭크 스냅샷 수집 함수 작성
- [ ] 선수 최근 솔랭 경기 수집 함수 작성
- [ ] 프로 챔피언 통계 수집 함수 작성
- [ ] 외부 API 429 rate limit 대응 정책 구현
- [ ] 외부 API 404/누락 응답 fallback 처리
- [ ] Vercel Cron 작업 목록 설계
- [ ] Leaguepedia 참고 URL 저장 필드 연결
- [ ] Leaguepedia import 후보 데이터 preview 화면 설계
- [ ] import 전 수동 검토 흐름 추가
- [ ] import 후 중복 데이터 검증 추가
- [ ] 공식 Riot/LCK 기록과 차이가 날 수 있다는 안내 노출 확인

## 7단계: 필터, 검색, 페이지네이션

- [ ] 일정 페이지 stage 필터 연결
- [ ] 일정 페이지 team 필터 연결
- [ ] 일정 페이지 status 필터 연결
- [ ] 순위 페이지 stage 필터 연결
- [ ] 선수 목록 position 필터 연결
- [ ] 선수 목록 team 필터 연결
- [ ] 스탯 페이지 period 필터 연결
- [ ] 스탯 페이지 team 필터 연결
- [ ] 커뮤니티 board 필터 연결
- [ ] 커뮤니티 team 필터 연결
- [ ] 제목/본문 검색 연결
- [ ] 표 페이지네이션 공통 컴포넌트 추가
- [ ] 모바일에서 필터 UI 확인

## 8단계: UI 레퍼런스 반영

- [ ] 레퍼런스 이미지는 색감, 폰트, 그래픽 장식 복제가 아니라 정보 배치와 우선순위 구조만 참고
- [ ] LCK 허브 고유 디자인 토큰과 현재 앱 톤을 유지하면서 레퍼런스 배치를 재해석
- [ ] 방송 화면형 레퍼런스는 데스크톱 중심 레이아웃으로 먼저 구현하고 모바일에서는 정보 순서를 유지해 세로 재배치

### 경기 일정 UI

- [x] 네이버 e스포츠 LCK 일정 화면을 `/schedule`의 1차 UI 레퍼런스로 적용
- [x] `/schedule` 상단에 리그/대회 선택 탭 배치
- [x] `/schedule` 상단에 월/주/일 이동 컨트롤 배치
- [x] `/schedule` 일정 리스트를 날짜별 그룹으로 분리
- [x] 날짜 그룹 안에 경기 시간, 팀 A/B, 로고, 스코어, 상태를 한 줄 경기 카드로 표시
- [x] 예정 경기와 완료 경기를 같은 리스트 패턴 안에서 상태만 다르게 표시
- [x] 경기 카드 클릭 시 `/matches/[matchId]`로 이동
- [x] 모바일에서 일정 카드가 네이버 일정 화면처럼 세로 스캔 중심으로 보이도록 조정
- [x] `경기 일정`과 `경기 결과`의 데이터 구조는 유지하되 화면 표현은 일정형 카드 UI로 교체

### 밴픽 UI

- [x] 매치 상세의 밴픽 노출은 세트별 밴 목록, 픽 목록, 세트 상세 이동만 제공
- [x] 매치 상세에는 피어리스 누적 분석, 사용 불가 챔피언, 포지션별 누적 같은 확장 분석을 넣지 않음
- [x] 매치 상세의 밴픽 목록은 `세트별 결과` 아래 또는 근처에 보조 섹션으로 배치
- [x] 각 세트 행에 블루팀 밴/픽과 레드팀 밴/픽을 한눈에 보는 compact 목록으로 표시
- [x] 상세 밴픽 화면은 `/matches/[matchId]/sets/[setId]`에서 담당
- [x] 첨부 이미지의 방송식 밴픽 화면을 `/matches/[matchId]/sets/[setId]` 밴픽 섹션의 1차 UI 레퍼런스로 적용
- [x] 밴픽 상단에 양팀 밴 챔피언 5개씩 가로 배치
- [x] 밴 챔피언은 어두운 오버레이와 사선 표시로 픽과 구분
- [x] 하단에 블루팀 5픽, 중앙 매치 패널, 레드팀 5픽을 한 줄로 배치
- [ ] 각 픽 카드에 챔피언 이미지, 선수명, 포지션 정보를 표시
- [ ] 중앙 패널에 매치 번호, 팀 로고, 세트 스코어, 진영, 선픽 정보, 패치 버전 표시
- [x] 픽/밴 데이터가 없을 때도 레이아웃 크기가 흔들리지 않는 placeholder 상태 추가
- [x] 모바일에서는 밴 영역, 중앙 매치 패널, 양팀 픽 영역을 순서대로 접히는 레이아웃으로 조정
- [x] 밴픽 테이블은 관리자/데이터 검수용으로 유지하고, 공개 세트 상세의 기본 노출은 방송식 밴픽 UI로 변경
- [ ] 챔피언 이미지 에셋 경로와 fallback 이미지 정책 확정

### 세트 종합 결과 UI

- [x] 첨부 이미지의 방송식 결과 요약 화면을 `/matches/[matchId]/sets/[setId]` 세트 요약/팀 스탯 영역의 1차 배치 레퍼런스로 적용
- [ ] 상단에 블루팀 로고/팀명/세트 스코어/승패, 중앙 게임 시간, 레드팀 승패/세트 스코어/팀명/로고를 한 줄 요약 바 형태로 배치
- [ ] 좌측 영역에 KDA, 골드, 타워, 유충, 전령, 용, 장로, 바론, 밴 목록을 양팀 비교형 스탯 리스트로 배치
- [x] 우측 상단에 선수별 총 피해량 비교를 양팀 방향성 있는 막대 그래프로 배치
- [x] 우측 하단에 시간대별 골드 차이 그래프 영역 배치
- [ ] 하단 메타 정보로 시즌, 매치 번호, 세트 번호, 경기 날짜를 배치
- [x] 기존 `세트 요약`과 `팀 스탯` 데이터 구조는 유지하되 공개 기본 노출은 세트 종합 결과형 레이아웃으로 변경
- [x] 세트 종합 결과 아래에 상세 표 보기 토글 또는 보조 표 영역 제공
- [x] 피해량/골드 차이 데이터가 없을 때도 그래프 영역 크기가 유지되는 placeholder 상태 추가
- [x] 모바일에서는 상단 요약 바, 게임 스탯 비교, 피해량 그래프, 골드 차이 그래프 순서로 세로 재배치

## 9단계: 배포와 운영 준비

- [ ] Vercel 프로젝트 환경 변수 목록 정리
- [ ] Vercel preview/prod 환경 구분 정리
- [ ] Supabase preview branch 사용 여부 결정
- [ ] `*.lckhub.com` wildcard domain 설정 문서화
- [ ] 서브도메인 rewrite production 동작 확인
- [ ] `t1.lckhub.com/news` rewrite 확인
- [ ] `geng.lckhub.com/community` rewrite 확인
- [ ] Supabase Auth cookie domain 설정 검토
- [x] 배포 전 `npm run typecheck` 확인
- [x] 배포 전 `npm run lint` 확인
- [x] 배포 전 `npm run build` 확인
- [ ] 배포 전 `npm audit --audit-level=moderate` 확인

## 10단계: 품질 확인

- [ ] 홈 화면 desktop 확인
- [ ] 홈 화면 mobile 확인
- [ ] 일정 화면 desktop 확인
- [ ] 일정 화면 mobile 확인
- [ ] 팀 상세와 팬 사이트 시각 구분 확인
- [ ] 팬 사이트 10개 팀 라우트 모두 확인
- [ ] 관리자 목록 화면 확인
- [ ] 관리자 폼 validation 확인
- [ ] Supabase query 에러 상태 확인
- [ ] 빈 데이터 상태 확인
- [ ] loading 상태 확인
- [ ] 404 상태 확인
- [ ] 브라우저 콘솔 error 확인
- [ ] build output route 목록 확인
## 완료: 실제 데이터 전환 정리

- [x] GOL 기반 LCK 2026 Cup/Rounds 1-2/Road to MSI 경기 동기화 스크립트 추가
- [x] `npm run sync:lck-2026` 명령 추가
- [x] LCK Cup 2026 경기 40건 Supabase 입력 확인
- [x] LCK 2026 Rounds 1-2 경기 90건 Supabase 입력 확인
- [x] LCK 2026 Road to MSI 경기 5건 Supabase 입력 확인
- [x] `lib/mock-data.ts` 삭제
- [x] `supabase/seed.sql` 샘플 seed 파일 삭제
- [x] 앱 코드의 `@/lib/mock-data` 직접 import 제거
- [x] 앱 코드의 `localStorage` / `sessionStorage` 사용 여부 점검
- [x] Supabase query 실패 시 mock으로 대체하던 fallback 제거
- [x] 챔피언, 밴픽, 선수 세트 스탯 query 함수 추가
- [x] 홈/팀/선수/경기/세트/팬사이트/커뮤니티/통계 페이지를 Supabase 데이터 기반으로 교체
- [x] 원격 Supabase의 샘플 선수/경기/세트/챔피언/밴픽/평점/커뮤니티 데이터 삭제
- [x] 원격 Supabase의 팀 10개 기본 데이터 유지 확인
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과
