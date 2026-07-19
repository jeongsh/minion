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

1. `/lab/*` 경로는 robots/noindex 상태를 유지한다.
2. 실제 콘텐츠 삭제는 DB 백업 이후 제목/본문/작성자를 검수하고 수동 승인 후 진행한다.
3. 주간 리포트는 생성 모델, 생성 시각, 데이터 출처가 표시되는지 확인한다.

## Monitoring

1. Next error boundary 로그의 digest를 배포 로그와 매칭한다.
2. `admin_audit_logs`에서 업로드/운영 이벤트를 정기적으로 검토한다.
