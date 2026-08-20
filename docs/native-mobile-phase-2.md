# 네이티브 모바일 2단계 — 현재 상태 요약

상태: 홈만 유지, 나머지 라우트 프론트엔드는 제로베이스.

## 유지

- 홈 화면, 홈 캘린더, Footer
- `/api/mobile/v1/home|schedule|tournaments|matches|teams|players|news|search` 읽기 API
- API 응답 계약, client, AsyncStorage 캐시

## 초기화

- 일정, 대회, 승부예측, 경기 상세
- 뉴스, 검색, 커뮤니티
- 팀, 선수, 팬 채널 전체

초기화된 화면은 공통 `RouteCanvas`만 표시한다. 과거 데이터 연결 화면은 현재 구현으로 간주하지 않는다.

작업 분담과 1px 완료 기준:

- [A — 매치·탐색](./native-mobile/OWNER-A.md)
- [B — 팀·선수·팬](./native-mobile/OWNER-B.md)
