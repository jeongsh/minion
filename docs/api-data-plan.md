# API / 데이터 수집 설계 요약

`docs/api.docx` 기준으로 정리한 개발 기준 문서다.

## 기본 원칙

- 프로 경기 기본 데이터는 Leaguepedia Cargo를 중심으로 수집한다.
- Riot API는 프로 경기의 기본 출처가 아니라 보강 출처로 사용한다.
- Data Dragon은 챔피언, 아이템, 룬, 소환사 주문, 프로필 아이콘 등 정적 리소스에 사용한다.
- Riot matchId가 없는 프로 경기는 Timeline 기반 그래프를 표시하지 않는다.
- Leaguepedia 내부 `GameId` / `MatchId`와 Riot `matchId`를 혼동하지 않는다.
- 모든 외부 API 호출은 서버에서만 실행한다.
- 외부 API 응답은 가능한 Supabase에 저장하고, 프론트는 Supabase 또는 내부 API를 통해 조회한다.

## 데이터 소스 역할

### Leaguepedia Cargo

주 출처로 사용한다.

- LCK 경기 일정
- 대회, 시즌, 스플릿 구조
- 매치 정보
- 세트별 게임 정보
- 팀 정보
- 선수 로스터
- 선수 이적/소속 정보
- 밴픽 데이터
- 세트별 결과
- 선수별 세트 기록
- MVP/POG 관련 데이터

저장 시 Leaguepedia 내부 ID를 별도 컬럼으로 보존한다. Cargo에서 Riot platform game id 또는 Riot match id와 연결 가능한 필드가 있으면 함께 저장한다.

### Riot API

보강 데이터로 사용한다.

- 선수 솔랭 계정 정보
- 선수 최근 솔랭 경기
- 선수 랭크 정보
- 선수 최근 챔피언 사용 기록
- Riot matchId가 확보된 경기의 Match Timeline

사용 API:

- `ACCOUNT-V1`: Riot ID로 PUUID 조회
- `SUMMONER-V4`: PUUID 기반 소환사 정보 조회
- `LEAGUE-V4`: 랭크 정보 조회
- `MATCH-V5`: 최근 솔랭 경기, 경기 상세, Timeline 조회

Timeline은 `KR_1234567890` 같은 Riot matchId가 있는 경우에만 호출한다.

### Data Dragon

정적 리소스에 사용한다.

- 챔피언 이름
- 챔피언 아이콘
- 챔피언 스플래시 이미지
- 아이템 이미지
- 룬 이미지
- 소환사 주문 이미지
- 패치 버전
- 프로필 아이콘

이미지 URL은 직접 저장하기보다 version/key/id 기반으로 생성 가능하게 설계한다.

예시:

```text
https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/Ahri.png
```

### Games of Legends 또는 대체 프로 통계 소스

공식 API가 아니므로 사용 가능 여부와 정책을 확인한 뒤 캐싱 중심으로 사용한다.

- 챔피언별 프로 승률
- 픽률
- 밴률
- KDA
- DPM
- GD@15
- CSD@15
- XPD@15
- 패치별/리그별 챔피언 통계

## 추가로 필요한 DB 영역

현재 스키마에 이미 있는 영역:

- `teams`
- `players`
- `tournaments`
- `stages`
- `matches`
- `sets`
- `champions`
- `set_picks_bans`
- `set_player_stats`
- `set_team_stats`
- `fan_ratings`
- `fan_pog_votes`
- `community_posts`
- `community_comments`
- `data_sources`

추가 검토가 필요한 영역:

- Leaguepedia 원본 ID 컬럼
- Riot `matchId` / platform game id 컬럼
- match timeline frame 테이블
- timeline event 테이블
- soloq account 테이블
- soloq rank snapshot 테이블
- soloq match 테이블
- pro champion stat 테이블
- Data Dragon version/cache 테이블

## 동기화 작업

- Data Dragon 정적 데이터 동기화
- Leaguepedia 경기 일정 동기화
- Leaguepedia 경기 결과/세트/밴픽/선수 기록 동기화
- Riot Timeline 보강
- 선수 솔랭 계정/랭크/최근 경기 동기화
- 프로 챔피언 통계 동기화

## 화면별 반영 기준

### 경기 상세 / 세트 상세

- 기본 표시는 Leaguepedia 기반 세트 결과, 밴픽, 선수 기록이다.
- Riot Timeline 데이터가 있으면 골드 차이, XP 차이, CS 차이, 킬/오브젝트 타임라인을 표시한다.
- Riot Timeline 데이터가 없으면 그래프 영역은 placeholder 또는 숨김 상태로 처리한다.

### 챔피언 상세 / 챔피언 통계

- 챔피언 기본 정보와 이미지는 Data Dragon 기반으로 처리한다.
- 프로 픽률/밴률/승률은 Leaguepedia 또는 별도 프로 통계 소스를 캐싱해 사용한다.

### 선수 상세

- 프로 경기 기록은 Leaguepedia 기반으로 처리한다.
- 솔랭 티어, LP, 최근 솔랭 경기, 최근 사용 챔피언은 Riot API 기반으로 보강한다.
