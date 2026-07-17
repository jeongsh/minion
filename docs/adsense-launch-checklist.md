# MINION AdSense 출시 체크리스트

코드에는 광고 슬롯, 정책 페이지, `ads.txt`, 가입 동의 기록 구조가 준비되어 있다. 아래 항목은 실제 도메인과 AdSense 계정이 있어야 완료할 수 있다.

## 배포 전

- `NEXT_PUBLIC_SITE_URL`을 실제 대표 도메인으로 설정한다.
- `NEXT_PUBLIC_CONTACT_EMAIL`을 공개 가능한 운영 이메일로 설정한다.
- Supabase에 `20260717064739_record_policy_acceptance.sql` 마이그레이션을 적용한다.
- `/about`, `/privacy`, `/terms`, `/advertising`, `/community/rules`를 실제 배포 주소에서 확인한다.
- `/robots.txt`와 `/sitemap.xml`이 실제 대표 도메인을 가리키는지 확인한다.

## AdSense 승인 신청

- AdSense에서 사이트를 추가하고 발급된 `ca-pub-...` 값을 `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT`에 설정한다.
- 승인 단계에서는 Auto ads를 끄고 수동 광고 단위만 사용한다.
- 반응형 디스플레이 단위를 만든 뒤 아래 값을 설정한다.
  - `NEXT_PUBLIC_ADSENSE_SLOT_HORIZONTAL`: 홈·경기·팀·선수·팬 페이지의 60~90px 가로형
  - `NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE`: 홈의 최대 300×250 사각형
  - `NEXT_PUBLIC_ADSENSE_SLOT_COMMUNITY`: 커뮤니티 모바일 가로형·데스크톱 300×250
  - `NEXT_PUBLIC_ADSENSE_SLOT_PREDICTION`: 예측 페이지 전용(초기에는 비활성 권장)
- 배포 후 `/ads.txt`가 `google.com, pub-..., DIRECT, f08c47fec0942fa0` 형식과 HTTP 200으로 응답하는지 확인한다.

## 승인 후

- AdSense의 **Privacy & messaging**에서 EEA·영국·스위스용 Google 인증 CMP 메시지를 설정한다. 자체 제작 쿠키 배너만으로 대체하지 않는다.
- 모바일 광고 크기 자동 최적화, 앵커, 전면, 사이드 레일 광고는 사용자 경험을 확인하기 전까지 끈다.
- 예측 페이지는 광고와 베팅 조작 영역의 우발 클릭 가능성을 확인한 뒤 `NEXT_PUBLIC_ADSENSE_ENABLE_PREDICTIONS=true`로 켠다.
- 자신의 광고를 클릭하지 않고, 개발·운영 확인에는 AdSense 미리보기와 브라우저 개발자 도구를 사용한다.
- 커뮤니티 신고·블라인드와 정책 센터 알림을 정기적으로 확인한다.

## 권장 초기 지면

1. 홈 상단 가로형
2. 홈 중간 사각형
3. 커뮤니티 데스크톱 사이드
4. 경기·팀·선수 상세 하단 가로형

광고가 콘텐츠보다 많아 보이지 않도록 한 화면에 광고가 여러 개 동시에 보이지 않게 유지한다.
