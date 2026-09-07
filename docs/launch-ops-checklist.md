# MINION launch ops checklist

## Supabase Auth

1. Auth > Protection에서 leaked password protection을 켠다.
2. 비밀번호 재설정 redirect URL에 `https://<production-domain>/auth/callback`과 로컬 `http://localhost:3000/auth/callback`을 등록한다.
3. 운영 전 `ADMIN_ALLOW_ALL_USERS=false`를 유지한다.

## Community uploads

1. 업로드 API는 서버에서 이미지 유효성 검사, 리사이징, WEBP 재인코딩을 수행한다.
2. 고아 업로드 점검은 `npm run uploads:cleanup`으로 dry-run부터 실행한다.
3. 실제 삭제는 후보를 확인한 뒤 `npm run uploads:cleanup -- --confirm`으로 실행한다.

## Content cleanup

1. 폐기한 `/lab`, `/reports`, `/records` 및 하위 경로는 광고 스크립트 없이 HTTP 410과 `X-Robots-Tag: noindex, nofollow`를 반환한다. 사이트맵과 공개 링크에 다시 추가하지 않는다.
2. 실제 콘텐츠 삭제는 DB 백업 이후 제목/본문/작성자를 검수하고 수동 승인 후 진행한다.
3. 주간 리포트 공개 화면은 폐기했다. 기존 DB 자료와 내부 생성 스크립트는 공개 페이지와 별개로 보관한다.

## Monitoring

1. Next error boundary 로그의 digest를 배포 로그와 매칭한다.
2. `admin_audit_logs`에서 업로드/운영 이벤트를 정기적으로 검토한다.
