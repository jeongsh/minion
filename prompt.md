너는 시니어 풀스택 개발자이자 프론트엔드 아키텍트다.

아래 기획을 기준으로 LCK 팬 플랫폼 프로젝트를 설계하고 구현해줘.

기술 스택은 다음을 사용한다.

* React
* Next.js App Router
* TypeScript
* Tailwind CSS
* Supabase
* Vercel 배포 기준

디자인 관련 주의사항:

* UI/UX와 시각 디자인은 별도 디자이너가 담당한다.
* 개발자는 디자인을 완성하려고 하지 말고, 정보 구조, 라우팅, 데이터 모델, 상태 관리, 컴포넌트 분리, Supabase 연동 가능성을 우선한다.
* 특정 완성형 UI 컴포넌트 라이브러리에 의존하지 않는다.
* Tailwind CSS는 레이아웃, 반응형, spacing, theme token 연결 용도로 사용한다.
* 색상, radius, shadow, spacing 등 시각 스타일은 하드코딩을 최소화하고 CSS variable 또는 theme token으로 연결한다.
* 컴포넌트는 디자이너가 추후 스타일을 쉽게 입힐 수 있도록 구조적이고 시맨틱하게 작성한다.
* 임시 디자인은 화면 구조 확인이 가능한 최소 수준으로만 구현한다.
* 레이아웃, UI 크기, 폰트 크기, 컴포넌트 구조는 일관되게 유지한다.
* 팀별 팬 사이트의 차이는 팀 로고, 배경 이미지, 포인트 컬러, 그라데이션, 카드 강조색, 버튼 색상 등 테마 요소만 다르게 적용한다.

프로젝트 목표:

LCK 전체를 아우르는 메인 허브와 10개 팀별 팬 사이트를 하나의 Next.js 프로젝트 안에서 제공한다.

이 프로젝트에는 두 종류의 공간이 있다.

1. LCK 통합 허브

   * LCK 전체 일정, 결과, 순위, 경기 상세, 선수 상세, 팀 상세, 스탯, 전체 커뮤니티를 제공하는 메인 사이트다.
   * 예: lckhub.com

2. 팀별 팬 사이트

   * 각 팀 팬들이 사용하는 독립적인 팬 커뮤니티/콘텐츠 공간이다.
   * 팀별 SNS, 유튜브, 선수 방송, 팀 팬 커뮤니티, 팀 경기 리뷰, 응원 게시판, 팀 관련 콘텐츠를 제공한다.
   * 예: t1.lckhub.com, geng.lckhub.com, hle.lckhub.com
   * 내부 구현은 /fan/[teamSlug] 라우트로 만들고, middleware에서 서브도메인을 감지해 rewrite한다.

중요한 구분:

* /teams/[teamSlug]는 LCK 허브 내부의 중립적인 팀 상세 페이지다.
* /fan/[teamSlug]는 팀별 팬 사이트다.
* 팀별 강한 테마 디자인은 /fan/[teamSlug]에 적용한다.
* /teams/[teamSlug]는 LCK 허브 공통 톤을 유지하고, 팀 컬러는 로고/작은 accent 정도로만 사용한다.

중요한 설계 원칙:

1. LCK 전체 메인 허브와 각 팀별 팬 사이트는 하나의 프로젝트 안에 존재한다.
2. LCK 허브의 팀 상세 페이지와 팀별 팬 사이트를 분리한다.
3. 팀별 팬 사이트는 레이아웃, UI 크기, 폰트, 컴포넌트 구조는 동일하게 유지한다.
4. 팀별 팬 사이트의 차이는 팀 로고, 배경 이미지, 포인트 컬러, 그라데이션, 카드 강조색, 버튼 색상 등 테마 요소만 다르게 적용한다.
5. 팬 평점은 순수 팬투표 지표다.
6. 팬 평점은 최근폼, 선수 실력 지표, 스탯 랭킹 산식에 포함하지 않는다.
7. 최근폼은 경기 스탯 기반으로만 계산한다.
8. 선수/팀 6각형은 팬 평점이 아니라 경기 스탯 기반으로 계산한다.
9. 스탯은 공식 기록이 아니라 팬 페이지 집계 기준으로 표시한다.
10. 15분 지표, GD@15, 받은 피해량, 와드 설치/제거, 솔로킬/솔로데스는 MVP 범위에서 제외한다.
11. MVP 기준 스탯은 KDA, KP%, DPM, DMG%, CSM, GPM, Vision Score, 골드, CS, 팀 킬, 팀 골드, 오브젝트 중심으로 구성한다.
12. Leaguepedia 기반 데이터 입력/수집을 전제로 설계하되, 초기에는 mock data와 Supabase schema 중심으로 구현한다.
13. 데이터 출처 표기 문구를 준비한다.
    예: “일부 경기/선수 통계는 Leaguepedia 자료를 참고하여 재정리했습니다. 본 페이지의 통계는 팬 페이지 운영 기준으로 재가공되었으며, 공식 Riot/LCK 기록과 차이가 있을 수 있습니다.”

────────────────────────

1. 전체 라우팅 구조
   ────────────────────────

Next.js App Router 기준으로 다음 라우트를 만든다.

LCK 통합 허브:

* /

  * LCK 통합 홈

* /schedule

  * 일정 / 결과

* /standings

  * 순위

* /matches/[matchId]

  * 경기 상세

* /matches/[matchId]/sets/[setId]

  * 세트 상세

* /teams

  * 팀 목록

* /teams/[teamSlug]

  * LCK 허브 내부의 중립적인 팀 상세

* /players

  * 선수 목록

* /players/[playerSlug]

  * 선수 상세

* /stats

  * 스탯 메인

* /stats/teams

  * 팀 스탯

* /stats/players

  * 선수 스탯

* /stats/champions

  * 챔피언 / 밴픽 스탯

* /stats/form

  * 최근 폼 랭킹

* /stats/fan-ratings

  * 팬 평점 랭킹

* /stats/pom

  * 공식 POM 랭킹

* /community

  * LCK 전체 커뮤니티 메인

* /community/reviews

  * 경기 리뷰

* /community/draft

  * 밴픽 토론

* /community/issues

  * LCK 이슈

* /community/free

  * 자유 게시판

팀별 팬 사이트:

* /fan/[teamSlug]

  * 팀 팬 사이트 홈

* /fan/[teamSlug]/news

  * 팀 소식 / SNS / 유튜브

* /fan/[teamSlug]/players

  * 팀 선수 / 방송 / 솔랭

* /fan/[teamSlug]/matches

  * 팀 일정 / 결과 / 리뷰

* /fan/[teamSlug]/community

  * 팀 팬 커뮤니티

* /fan/[teamSlug]/community/free

  * 팀 자유 게시판

* /fan/[teamSlug]/community/cheer

  * 응원 게시판

* /fan/[teamSlug]/community/reviews

  * 팀 경기 후기

* /fan/[teamSlug]/community/draft

  * 팀 밴픽 토론

* /fan/[teamSlug]/community/players

  * 선수 이야기

* /fan/[teamSlug]/info

  * 팀 정보 / 공식 링크

관리자:

* /admin

  * 관리자 대시보드

* /admin/matches

  * 경기 관리

* /admin/sets

  * 세트 관리

* /admin/stats

  * 스탯 입력 관리

* /admin/teams

  * 팀 관리

* /admin/players

  * 선수 관리

* /admin/ratings

  * 팬 평점 관리

* /admin/fan-sites

  * 팀별 팬 사이트 설정 관리

────────────────────────
2. 서브도메인 구조
────────────────────────

팀별 팬 사이트는 path 방식과 subdomain 방식을 모두 지원할 수 있게 설계한다.

내부 라우트:

* /fan/t1
* /fan/geng
* /fan/hle
* /fan/dk

외부 URL:

* t1.lckhub.com → /fan/t1
* geng.lckhub.com → /fan/geng
* hle.lckhub.com → /fan/hle
* dk.lckhub.com → /fan/dk

구현 원칙:

* Next.js middleware에서 request host를 확인한다.
* host가 메인 도메인인 경우 일반 LCK 허브 라우팅을 사용한다.
* host가 서브도메인인 경우 subdomain 값을 teamSlug로 추출한다.
* teamSlug가 유효한 팀이면 내부적으로 /fan/[teamSlug]로 rewrite한다.
* 예: t1.lckhub.com/news → /fan/t1/news
* 예: geng.lckhub.com/community → /fan/geng/community
* 개발 환경에서는 t1.localhost 또는 query 기반 fallback을 고려한다.
* Supabase Auth를 사용할 경우 서브도메인 간 로그인 세션 공유를 고려해 쿠키 도메인을 .lckhub.com 형태로 설정할 수 있게 구조를 열어둔다.
* Vercel 배포 시 wildcard domain, 예: *.lckhub.com 연결을 고려한다.

주의:

* 초기 개발은 /fan/[teamSlug] path 기반으로 먼저 완성한다.
* middleware rewrite와 wildcard subdomain 연결은 배포 단계에서 붙일 수 있게 구조만 준비한다.
* 코드 구조는 하나의 Next.js 프로젝트를 유지한다.
* 팀별 팬 사이트마다 별도 프로젝트를 만들지 않는다.

────────────────────────
3. LCK 홈
────────────────────────

홈 화면에는 다음 섹션을 구성한다.

* 오늘 경기

  * 경기명
  * 팀 A/B
  * 경기 시간
  * 경기 상태
  * 승부예측
  * 경기 상세 이동

* 이번 주 일정

  * 날짜
  * 경기 시간
  * 팀 A/B
  * 경기 상태
  * 경기 상세 이동

* 현재 순위

  * 팀 순위
  * 팀명
  * 매치 전적
  * 세트 전적
  * 승률
  * 최근 5경기

* 최근 경기 결과

  * 경기명
  * 최종 스코어
  * 세트 스코어
  * 공식 POM
  * 매치 팬 평점 1위
  * 세트별 팬 POG

* 공식 POM 랭킹

  * 선수명
  * 팀
  * 포지션
  * 공식 POM 횟수
  * 최근 POM 경기

* 최근 폼 TOP

  * 선수명
  * 팀
  * 포지션
  * 최근 3경기 스탯 기반 폼
  * 최근 3경기 KDA
  * 최근 3경기 DPM
  * 최근 3경기 GPM
  * 최근 3경기 CSM
  * 공식 POM 횟수

* 인기 경기 리뷰

  * 경기
  * 세트
  * 리뷰
  * 댓글 수
  * 추천 수

각 카드에는 관련 미니모달 또는 프리뷰 팝오버를 연결한다.

경기 미니모달:

* 경기명
* 날짜
* 팀 A/B
* 경기 상태
* 스코어
* 공식 POM
* 매치 팬 평점 1위
* 경기 상세 보기

팀 미니모달:

* 팀명
* 로고
* 현재 순위
* 승률
* 최근 5경기
* 팀 6각형 축소
* 팀 상세 보기
* 팀 팬 사이트 이동

선수 미니모달:

* 선수명
* 팀
* 포지션
* KDA
* DPM
* 최근 3경기 주요 스탯
* 팬 POG 횟수
* 공식 POM 횟수
* 선수 상세 보기

────────────────────────
4. 일정 / 결과
────────────────────────

/schedule 페이지는 다음을 포함한다.

경기 일정:

* 시즌
* 대회
* 구간
* 라운드
* 날짜
* 시간
* 팀 A/B
* 경기 상태
* 경기 상세 이동

경기 결과:

* 최종 스코어
* 세트 스코어
* 공식 POM
* 매치 팬 평점 1위
* 세트별 팬 POG

필터를 제공한다.

* 현재 구간
* 2026 LCK 통합
* 대회별
* 국제 / 이벤트
* 커리어

구간 예시는 다음과 같다.

* LCK Cup
* First Stand
* LCK 1라운드
* LCK 2라운드
* Road to MSI
* MSI
* LCK 그룹/레전드 라이즈 구간
* 플레이오프
* Worlds

────────────────────────
5. 순위
────────────────────────

/standings 페이지는 팀 순위표를 보여준다.

필드:

* 팀 순위
* 팀명
* 로고
* 매치 전적
* 세트 전적
* 승률
* 득실
* 최근 5경기
* 다음 경기

팀 클릭 시 팀 미니모달 또는 팀 상세로 이동한다.

────────────────────────
6. 경기 상세
────────────────────────

/matches/[matchId] 페이지는 다음 구조로 만든다.

경기 요약:

* 경기명
* 날짜
* 시즌
* 대회
* 구간
* 라운드
* 팀 A/B
* 최종 스코어
* 세트 스코어
* 공식 POM
* 매치 팬 평점 1위

세트별 결과:

* 1세트, 2세트, 3세트, 필요 시 4/5세트
* 승리팀
* 블루팀
* 레드팀
* 게임 시간
* 킬 스코어
* 골드
* 용
* 바론
* 타워
* 세트 팬 POG
* 세트 팬 평점 1위

매치 평점:

* 세트별 팬 평점 평균
* 매치 팬 평점 1위
* 세트별 팬 POG
* 리뷰 수
* 평점 참여 수
* 인정 평점

공식 POM:

* 공식 POM 선수
* 소속팀
* 포지션
* 챔피언
* 경기 기록
* 매치 팬 평점
* 팬 POG 득표 수

팬 평점은 경기 반응 콘텐츠로만 취급한다.
최근폼이나 스탯 산식에 포함하지 않는다.

────────────────────────
7. 세트 상세
────────────────────────

/matches/[matchId]/sets/[setId] 페이지는 다음 구조로 만든다.

세트 요약:

* 세트 번호
* 승리팀
* 블루팀
* 레드팀
* 게임 시간
* 킬 스코어
* 최종 골드
* 용
* 바론
* 타워
* 세트 팬 POG
* 세트 팬 평점 1위

밴픽:

* 1페이즈 밴
* 1페이즈 픽
* 2페이즈 밴
* 2페이즈 픽
* 밴/픽 순서
* 진영
* 팀
* 챔피언

최종 라인업:

* 팀
* 진영
* 포지션
* 선수
* 실제 사용 챔피언

팀 스탯:

* 킬
* 데스
* 어시스트
* 총 골드
* 총 CS
* 용
* 바론
* 타워
* 총 피해량
* 시야 점수

선수 스탯:

* 선수
* 팀
* 포지션
* 챔피언
* KDA
* KP%
* DPM
* CSM
* GPM
* Vision Score
* 세트 팬 평점
* 팬 POG 득표 수

세트 평점 / 리뷰:

* 선수별 세트 팬 평점
* 세트 리뷰
* 제한형 선수 리뷰
* 팬 POG 투표
* 팬 POG 득표 수
* 팬 POG 득표율
* 평점 참여 수
* 리뷰 수

────────────────────────
8. LCK 허브 팀 상세
────────────────────────

/teams/[teamSlug] 페이지는 LCK 허브 내부의 중립적인 팀 정보 페이지다.

주의:

* 이 페이지는 팀별 팬 사이트가 아니다.
* 강한 팀별 테마를 적용하지 않는다.
* LCK 허브 공통 디자인 톤을 유지한다.
* 팀 로고, 작은 accent color 정도만 사용한다.
* 팀 팬 사이트로 이동하는 CTA를 제공한다.

팀 상세 구조:

기준 필터:

* 현재 구간
* 2026 LCK 통합
* 대회별
* 국제 / 이벤트
* 커리어

팀 요약:

* 팀명
* 로고
* 현재 순위
* 매치 전적
* 세트 전적
* 승률
* 최근 5경기
* 다음 경기
* 팀 팬 사이트 이동

로스터:

* TOP
* JGL
* MID
* BOT
* SUP
* 선수명
* 포지션
* 최근 3경기 주요 스탯
* 선수 상세 이동

팀 스탯 요약:

* 평균 킬
* 평균 데스
* 평균 골드
* 평균 CS
* 용 획득률
* 바론 획득률
* 평균 타워
* 평균 DPM
* 평균 Vision Score

팀 6각형:

* 교전
* 화력
* 성장
* 시야
* 오브젝트
* 안정성

최근 경기:

* 상대팀
* 스코어
* 세트 스코어
* 공식 POM
* 매치 팬 평점 1위
* 경기 상세 이동

팬 데이터:

* 팀 평균 매치 팬 평점
* 팬 POG 합계
* 공식 POM 합계
* 최근 경기 리뷰

이동:

* 선수 상세 이동
* 최근 경기 이동
* 팀 스탯 비교 이동
* 팀 팬 사이트 이동

────────────────────────
9. 팀별 팬 사이트
────────────────────────

/fan/[teamSlug]는 각 팀 팬들이 사용하는 독립 팬 사이트다.

이 페이지에는 팀별 강한 테마를 적용한다.

예:

* /fan/t1
* /fan/geng
* /fan/hle
* /fan/dk

서브도메인 연결 예:

* t1.lckhub.com
* geng.lckhub.com
* hle.lckhub.com
* dk.lckhub.com

팀별 팬 사이트 공통 원칙:

* 모든 팀 팬 사이트는 같은 레이아웃을 사용한다.
* UI 크기, 폰트 크기, 카드 구조, 그리드 구조는 동일하다.
* 팀별 차이는 로고, 배경 이미지, 대표 컬러, 보조 컬러, 그라데이션, 버튼 색상, hover 색상, 카드 accent만 다르다.
* 팀별 커뮤니티, SNS, 유튜브, 선수 방송, 팀 일정, 팀 리뷰가 중심이다.
* LCK 허브 팀 상세보다 커뮤니티성과 팬덤성을 더 강하게 보여준다.

팀 팬 사이트 홈:

* 팀 히어로

  * 팀 로고
  * 팀명
  * 팬 사이트 소개 문구
  * 팀 배경 이미지
  * 팀 대표 컬러
  * 다음 경기
  * 최근 경기 결과
  * 공식 링크
  * LCK 허브 팀 상세 이동

* 다음 경기

  * 상대팀
  * 날짜
  * 경기 시간
  * 대회/구간
  * 경기 상세 이동
  * 승부예측

* 최근 경기 결과

  * 상대팀
  * 스코어
  * 세트 스코어
  * 공식 POM
  * 매치 팬 평점 1위
  * 경기 리뷰 이동

* 인기 팬 게시글

  * 제목
  * 게시판
  * 댓글 수
  * 추천 수
  * 작성 시간

* 최신 유튜브

  * 팀 공식 유튜브 영상
  * 썸네일
  * 제목
  * 업로드일
  * 조회수
  * 원문 이동

* 최신 SNS

  * 팀 공식 SNS 게시글
  * 선수 SNS
  * 게시일
  * 링크

* 선수 방송 상태

  * 선수명
  * 플랫폼
  * 방송 상태
  * 방송 제목
  * 바로가기

* 팀 일정

  * 이번 주 경기
  * 다음 경기
  * 최근 결과

팀 소식 /fan/[teamSlug]/news:

* 공식 공지
* 팀 뉴스
* SNS 업데이트
* 유튜브 콘텐츠
* 인터뷰
* 선수 출연 콘텐츠

팀 선수 /fan/[teamSlug]/players:

* 로스터
* 선수별 콘텐츠
* 선수 방송
* 선수 솔랭
* 선수 상세 이동
* 선수 관련 팬 게시글

팀 경기 /fan/[teamSlug]/matches:

* 팀 일정
* 팀 경기 결과
* 경기 리뷰
* 밴픽 토론
* 경기별 팬 반응
* 경기 상세 이동

팀 팬 커뮤니티 /fan/[teamSlug]/community:

* 자유 게시판
* 응원 게시판
* 경기 후기
* 밴픽 토론
* 선수 이야기
* 인기글
* 공지사항

팀 정보 /fan/[teamSlug]/info:

* 팀 소개
* 로스터
* 팀 SNS
* 유튜브
* 공식 홈페이지
* 공식 링크
* 연혁
* 주요 성적

────────────────────────
10. 선수 상세
────────────────────────

/players/[playerSlug] 페이지는 다음 구조로 만든다.

기준 필터:

* 현재 구간
* 2026 LCK 통합
* 대회별
* 국제 / 이벤트
* 커리어

선수 요약:

* 선수명
* 소속팀
* 포지션
* 프로필 이미지
* 팀 상세 이동
* 팀 팬 사이트 이동
* 팀원 이동

현재 구간 경기 지표:

* 출전 세트 수
* 승률
* KDA
* KP%
* DPM
* DMG%
* CSM
* GPM
* Vision Score

팬/수상 데이터:

* 세트 팬 평점 기반 평균
* 팬 POG 횟수
* 공식 POM 횟수
* 제한형 선수 리뷰

최근 폼:

* 최근 3경기 스탯 기반 폼
* 최근 3경기 평균 KDA
* 최근 3경기 평균 KP%
* 최근 3경기 평균 DPM
* 최근 3경기 평균 CSM
* 최근 3경기 평균 GPM
* 최근 3경기 Vision Score
* 최근 3경기 공식 POM 여부

중요:
최근 폼에는 팬 평점을 절대 포함하지 않는다.

라인 내 순위:

* 포지션 기준 KDA 순위
* DPM 순위
* KP% 순위
* CSM 순위
* GPM 순위
* Vision 순위
* 최근 3경기 스탯 기반 폼 순위
* POM 순위

선수 6각형:

* 성장
* 교전
* 화력
* 생존
* 시야
* 효율성

사용 챔피언:

* 챔피언
* 사용 세트 수
* 승률
* KDA
* 평균 세트 팬 평점
* 팬 POG 횟수
* 최근 사용일

최근 경기 기록:

* 경기 날짜
* 상대팀
* 매치 결과
* 사용 챔피언
* 주요 경기 스탯
* 매치 팬 평점
* 팬 POG 여부
* 공식 POM 여부
* 경기 상세 이동

같은 팀원:

* TOP
* JGL
* MID
* BOT
* SUP
* 선수명
* 포지션
* 선수 상세 이동

────────────────────────
11. 스탯
────────────────────────

/stats 페이지와 하위 페이지를 만든다.

공통 필터:

* 현재 구간
* 2026 LCK 통합
* 대회별
* 국제 / 이벤트
* 커리어

팀 스탯:

* 팀명
* 승률
* 매치 전적
* 세트 전적
* 평균 킬
* 평균 데스
* 평균 골드
* 평균 CS
* 용 획득률
* 바론 획득률
* 평균 타워
* 평균 DPM
* 평균 Vision Score

선수 스탯:

* 포지션별 선수
* 팀
* 출전 세트 수
* 승률
* KDA
* KP%
* DPM
* DMG%
* CSM
* GPM
* Vision Score

챔피언 / 밴픽 스탯:

* 챔피언
* 픽 수
* 밴 수
* 픽밴률
* 승률
* 포지션
* 주요 사용 선수
* 주요 사용 팀
* 평균 KDA
* 평균 DPM
* 팬 반응 데이터

최근 폼 랭킹:

* 선수
* 팀
* 포지션
* 최근 3경기 스탯 기반 폼
* 최근 3경기 KDA
* 최근 3경기 DPM
* 최근 3경기 GPM
* 최근 3경기 CSM
* 최근 3경기 Vision Score
* 최근 3경기 공식 POM 횟수

팬 평점 랭킹:

* 선수
* 팀
* 포지션
* 세트 팬 평점 평균
* 매치 팬 평점 평균
* 팬 POG 횟수
* 인정 평점

공식 POM 랭킹:

* 선수
* 팀
* 포지션
* 공식 POM 횟수
* 최근 POM 경기
* 최근 3경기 주요 스탯
* 팬 POG 횟수

중요:
최근 폼 랭킹과 팬 평점 랭킹은 분리한다.

────────────────────────
12. LCK 전체 커뮤니티
────────────────────────

/community 하위에 다음 게시판을 만든다.

경기 리뷰:

* 경기
* 세트
* 팀
* 리뷰
* 팬 평점 연동
* 댓글
* 추천

밴픽 토론:

* 경기
* 세트
* 밴픽 순서
* 최종 라인업
* 챔피언
* 팀
* 토론글
* 댓글

LCK 이슈:

* 리그 이슈
* 경기 이슈
* 로스터 이슈
* 운영 이슈
* 댓글
* 추천

자유:

* 자유글
* 인기글
* 댓글
* 추천
* 조회수

각 게시글은 필요 시 경기, 세트, 팀, 선수, 챔피언과 연결 가능해야 한다.

────────────────────────
13. 팀별 테마 시스템
────────────────────────

팀별 테마 설정 파일을 만든다.

이 테마는 주로 /fan/[teamSlug] 팀별 팬 사이트에 적용한다.

/teams/[teamSlug]에는 강하게 적용하지 않고, 작은 accent 정도로만 사용한다.

예시:

const teamThemes = {
t1: {
name: "T1",
primary: "#E4002B",
secondary: "#111111",
background: "/teams/t1/bg.jpg",
logo: "/teams/t1/logo.svg",
gradient: "from-red-950 via-zinc-950 to-black",
fanSiteHost: "t1"
},
geng: {
name: "Gen.G",
primary: "#AA8A00",
secondary: "#000000",
background: "/teams/geng/bg.jpg",
logo: "/teams/geng/logo.svg",
gradient: "from-yellow-900 via-zinc-950 to-black",
fanSiteHost: "geng"
}
};

실제 팀 컬러는 추후 수정 가능하게 constants 파일로 분리한다.

팀 팬 사이트는 같은 컴포넌트를 사용한다.

* FanSiteHero
* FanSiteNextMatch
* FanSiteRecentResults
* FanSitePopularPosts
* FanSiteYoutubeSection
* FanSiteSnsSection
* FanSiteBroadcastSection
* FanSiteScheduleSection
* FanSiteCommunitySection
* FanSiteOfficialLinks

props로 teamTheme을 받아 색상과 배경만 변경한다.

팀 테마는 가능하면 CSS variable로 주입한다.

예시:

* --team-primary
* --team-secondary
* --team-bg
* --team-accent
* --team-gradient-from
* --team-gradient-to

────────────────────────
14. 주요 컴포넌트
────────────────────────

공통 컴포넌트를 만든다.

* AppShell
* HubLayout
* FanSiteLayout
* Header
* TopNav
* SectionHeader
* StatCard
* MatchCard
* TeamCard
* PlayerCard
* ChampionCard
* RankingTable
* DataTable
* FilterTabs
* PeriodFilter
* MiniModal
* MatchMiniModal
* TeamMiniModal
* PlayerMiniModal
* ChampionMiniModal
* RadarChart
* RatingCard
* FanPogCard
* PomBadge
* FormBadge
* TeamThemeProvider
* SourceNotice

팀 팬 사이트 컴포넌트:

* FanSiteHero
* FanSiteNav
* FanSiteContentCard
* FanSitePostList
* FanSiteYoutubeCard
* FanSiteSnsCard
* FanSiteBroadcastCard
* FanSiteMatchCard
* FanSiteCommunityBoard
* FanSiteOfficialLinkList

컴포넌트 구현 원칙:

* 디자이너가 제공할 UI 가이드를 나중에 쉽게 적용할 수 있게 만든다.
* 특정 UI 라이브러리에 종속되지 않는다.
* semantic HTML을 우선한다.
* Tailwind utility는 구조, 반응형, spacing 중심으로 사용한다.
* 색상, radius, shadow, spacing은 하드코딩을 최소화하고 theme token 또는 CSS variable로 연결한다.
* 팀별 색상은 CSS variable로 주입한다.
* 컴포넌트는 기능 단위로 분리하되, 스타일은 쉽게 교체 가능하게 한다.
* 임시 디자인은 최소한의 레이아웃 확인용으로만 구현한다.
* 모바일 대응은 필수다.
* 데스크톱에서는 12컬럼 그리드를 고려한다.
* 모바일에서는 카드 스택 구조를 고려한다.

────────────────────────
15. Supabase 데이터 모델 초안
────────────────────────

Supabase에는 다음 테이블을 설계한다.

teams:

* id
* slug
* name
* short_name
* logo_url
* primary_color
* secondary_color
* background_url
* fan_site_host
* official_homepage_url
* official_youtube_url
* official_x_url
* official_instagram_url
* created_at

players:

* id
* slug
* name
* real_name
* team_id
* position
* profile_image_url
* stream_url
* solo_queue_account
* created_at

tournaments:

* id
* name
* season
* category
* created_at

stages:

* id
* tournament_id
* name
* order_index
* created_at

matches:

* id
* tournament_id
* stage_id
* name
* match_date
* status
* team_a_id
* team_b_id
* team_a_score
* team_b_score
* official_pom_player_id
* created_at

sets:

* id
* match_id
* set_number
* winner_team_id
* blue_team_id
* red_team_id
* duration_seconds
* blue_kills
* red_kills
* blue_gold
* red_gold
* blue_dragons
* red_dragons
* blue_barons
* red_barons
* blue_towers
* red_towers
* created_at

set_picks_bans:

* id
* set_id
* phase
* action_type
* order_index
* team_id
* champion_id
* side
* created_at

set_player_stats:

* id
* set_id
* player_id
* team_id
* position
* champion_id
* kills
* deaths
* assists
* cs
* gold
* damage_to_champions
* vision_score
* created_at

set_team_stats:

* id
* set_id
* team_id
* kills
* deaths
* assists
* total_gold
* total_cs
* total_damage
* vision_score
* dragons
* barons
* heralds
* void_grubs
* towers
* inhibitors
* created_at

fan_ratings:

* id
* set_id
* match_id
* player_id
* team_id
* rating
* review
* created_at

fan_pog_votes:

* id
* set_id
* match_id
* player_id
* team_id
* created_at

community_posts:

* id
* board_type
* site_scope
* title
* content
* author_id
* match_id
* set_id
* team_id
* player_id
* champion_id
* like_count
* comment_count
* view_count
* created_at

community_comments:

* id
* post_id
* author_id
* content
* like_count
* created_at

champions:

* id
* slug
* name
* image_url
* created_at

team_social_posts:

* id
* team_id
* platform
* title
* content
* source_url
* thumbnail_url
* published_at
* created_at

team_videos:

* id
* team_id
* platform
* title
* video_url
* thumbnail_url
* published_at
* view_count
* created_at

player_broadcasts:

* id
* player_id
* team_id
* platform
* stream_url
* title
* is_live
* viewer_count
* checked_at
* created_at

derived_player_stats:

* id
* player_id
* tournament_id
* stage_id
* period_key
* games
* wins
* losses
* kda
* kp
* dpm
* dmg_percent
* csm
* gpm
* vision_score_avg
* form_score
* radar_growth
* radar_fight
* radar_damage
* radar_survival
* radar_vision
* radar_efficiency
* created_at

derived_team_stats:

* id
* team_id
* tournament_id
* stage_id
* period_key
* matches
* wins
* losses
* avg_kills
* avg_deaths
* avg_gold
* avg_cs
* dragon_rate
* baron_rate
* avg_towers
* avg_dpm
* avg_vision_score
* radar_fight
* radar_damage
* radar_growth
* radar_vision
* radar_objective
* radar_stability
* created_at

data_sources:

* id
* source_name
* source_url
* license
* description
* created_at

────────────────────────
16. 계산 지표
────────────────────────

서버 또는 유틸 함수에서 다음을 계산한다.

선수 지표:

* KDA = (kills + assists) / max(deaths, 1)
* KP% = (kills + assists) / team_kills
* DPM = damage_to_champions / game_minutes
* CSM = cs / game_minutes
* GPM = gold / game_minutes
* DMG% = player_damage / team_total_damage
* Vision per minute = vision_score / game_minutes

선수 6각형:

* 성장 = GPM + CSM 기반 정규화
* 교전 = KP% + KDA 기반 정규화
* 화력 = DPM + DMG% 기반 정규화
* 생존 = deaths 역보정 + KDA 기반 정규화
* 시야 = Vision Score / game_minutes 기반 정규화
* 효율성 = damage per gold + DMG% 대비 gold share 기반 정규화

팀 지표:

* 평균 킬
* 평균 데스
* 평균 골드
* 평균 CS
* 평균 DPM
* 평균 Vision Score
* 용 획득률
* 바론 획득률
* 평균 타워

팀 6각형:

* 교전 = 평균 킬, 평균 데스 역보정, 팀 KDA
* 화력 = 팀 DPM
* 성장 = 평균 골드, 평균 CS
* 시야 = 평균 Vision Score
* 오브젝트 = 용/바론/타워 지표
* 안정성 = 평균 데스 역보정, 경기별 변동성 낮음

최근폼:

* 최근 3경기 스탯 기반으로 계산한다.
* 팬 평점은 절대 포함하지 않는다.
* 최근 3경기 KDA, KP%, DPM, CSM, GPM, Vision Score를 정규화해서 form_score를 만든다.

팬 평점:

* 팬 평점 = 전체 팬 투표 순수 평균
* 인정 평점 = 타팀팬/상대팀 팬 평가 비중을 높인 별도 참고 지표
* 팬 평점은 경기 반응 콘텐츠로만 사용한다.
* 팬 평점은 최근폼, 선수 실력 지표, 스탯 기반 랭킹 계산에 포함하지 않는다.

────────────────────────
17. 관리자 페이지
────────────────────────

/admin에서는 다음을 구현한다.

* 경기 등록/수정
* 세트 등록/수정
* 밴픽 입력
* 출전 선수 입력
* 선수별 세트 스탯 입력
* 팀별 세트 스탯 입력
* 공식 POM 입력
* 팬 평점 관리
* 커뮤니티 신고 관리
* 데이터 소스 관리
* 팀별 팬 사이트 설정 관리
* 팀 SNS 링크 관리
* 팀 유튜브 콘텐츠 관리
* 선수 방송 링크 관리

초기에는 Supabase 연동 전에도 mock data로 UI가 작동해야 한다.
이후 Supabase 연결이 쉬운 구조로 분리한다.

────────────────────────
18. 데이터 입력 / Leaguepedia 참고 구조
────────────────────────

초기 MVP에서는 자동화보다 안정적인 데이터 구조와 입력 흐름을 우선한다.

데이터 입력 원칙:

* 경기 일정, 경기 결과, 세트 결과, 밴픽은 관리자 입력을 기본으로 한다.
* 선수별 세트 스탯과 팀별 세트 스탯은 Leaguepedia 자료를 참고해 입력할 수 있게 한다.
* 초기에는 자동 수집을 구현하지 않아도 된다.
* 추후 Leaguepedia Cargo Query 또는 별도 데이터 입력 도구를 붙일 수 있도록 구조를 분리한다.
* 데이터 출처는 data_sources 테이블과 SourceNotice 컴포넌트로 관리한다.
* 스탯 화면에는 “팬 페이지 집계 기준”임을 표시한다.

MVP에서 사용하는 스탯:

* 경기 시간
* 선수명
* 팀명
* 포지션
* 챔피언
* K
* D
* A
* CS
* 골드
* 챔피언에게 가한 피해량
* Vision Score
* 팀 킬
* 팀 데스
* 팀 어시스트
* 팀 골드
* 팀 CS
* 팀 총 피해량
* 팀 Vision Score
* 드래곤
* 바론
* 전령
* 유충
* 타워
* 억제기

MVP에서 제외하는 스탯:

* GD@15
* CSD@15
* XPD@15
* 받은 피해량
* 와드 설치 수
* 와드 제거 수
* 솔로킬
* 솔로데스

────────────────────────
19. 개발 우선순위
────────────────────────

1단계:

* Next.js 프로젝트 구조 정리
* Tailwind 설정
* 공통 레이아웃
* LCK 허브 레이아웃
* 팀 팬 사이트 레이아웃
* 팀 테마 시스템
* mock data 작성
* 홈 화면
* 일정/결과
* 순위
* 경기 상세
* LCK 허브 팀 상세
* 팀 팬 사이트 홈
* 선수 상세
* 스탯 페이지 기본 UI

2단계:

* Supabase schema 작성
* Supabase client 설정
* mock data를 Supabase fetch 구조로 교체
* 관리자 입력 페이지 추가

3단계:

* 팬 평점
* 팬 POG
* 인정 평점
* 커뮤니티
* 리뷰/댓글
* 팀별 팬 커뮤니티

4단계:

* 팀 SNS / 유튜브 / 방송 정보 관리
* Leaguepedia 참고 데이터 입력 프로세스
* 출처 표기
* 데이터 검수 UI
* 자동 계산 지표
* 6각형 고도화

5단계:

* middleware 기반 서브도메인 rewrite
* wildcard domain 배포 구조 정리
* Supabase Auth 세션 공유 구조 검토

────────────────────────
20. 구현 시 주의사항
────────────────────────

* 팬 평점과 스탯 기반 최근폼을 절대 섞지 않는다.
* “최근 3경기 평균 평점”이라는 문구를 최근폼에 사용하지 않는다.
* 최근폼은 “최근 3경기 스탯 기반 폼”으로 표기한다.
* 팬 평점은 “세트 팬 평점”, “매치 팬 평점”, “팬 POG”, “인정 평점” 영역에만 사용한다.
* GD@15, 15분 지표는 MVP에서 제외한다.
* 와드 설치/제거, 받은 피해량, 솔로킬/솔로데스도 MVP에서 제외한다.
* /teams/[teamSlug]와 /fan/[teamSlug]를 혼동하지 않는다.
* /teams/[teamSlug]는 LCK 허브 내부의 중립적인 팀 상세 페이지다.
* /fan/[teamSlug]는 팀별 팬 사이트다.
* 팀별 강한 테마는 /fan/[teamSlug]에 적용한다.
* 컴포넌트는 재사용 가능하게 설계한다.
* 데이터와 UI를 분리한다.
* mock data는 실제 LCK 구조처럼 보이게 작성한다.
* 모든 리스트/테이블은 필터와 정렬 확장을 고려해서 만든다.
* 모바일 반응형을 고려한다.
* Vercel 배포를 고려해 환경변수 구조를 만든다.
* 디자이너가 나중에 스타일을 입힐 수 있도록 마크업 구조와 컴포넌트 책임을 명확히 분리한다.
* 임의로 복잡한 애니메이션이나 시각 효과를 많이 넣지 않는다.
* 디자인 토큰, CSS variable, teamTheme 값을 활용할 수 있는 구조를 만든다.
* 서브도메인 라우팅은 초기부터 구조를 고려하되, 1차 구현은 /fan/[teamSlug] path 기반으로 완성한다.

────────────────────────
21. 최종 산출물
────────────────────────

다음 결과물을 만들어줘.

* Next.js 프로젝트 기본 구조
* Tailwind 기반 레이아웃 구조
* LCK 허브 레이아웃
* 팀별 팬 사이트 레이아웃
* 팀 테마 시스템
* 서브도메인 rewrite를 고려한 middleware 초안
* 공통 컴포넌트
* 팀 팬 사이트 전용 컴포넌트
* mock data
* 주요 페이지 UI 골격
* Supabase schema SQL 초안
* 계산 지표 유틸 함수
* 팬 평점과 최근폼 분리 로직
* 데이터 출처 표기 컴포넌트
* 관리자 입력 페이지 초안
* README.md
* 향후 작업 TODO 목록

우선 전체 구조를 분석한 뒤, 파일 구조를 제안하고, 바로 구현 가능한 순서대로 작업해줘.

한 번에 모든 기능을 완성하려고 하지 말고, 먼저 라우팅과 핵심 UI 골격, mock data, 타입 정의, 컴포넌트 구조를 안정적으로 잡아줘.

디자인 완성도보다 프로젝트 구조, 데이터 구조, 확장성, 유지보수성을 우선한다.
