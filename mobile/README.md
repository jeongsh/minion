# MINION Mobile

Expo SDK 54 기반의 iOS·Android 공용 앱입니다. 현재 App Store와 Play Store의 Expo Go에서 실제 기기로 확인할 수 있습니다.

## 개발 담당 문서

- 전체 현황: [`../docs/native-mobile/README.md`](../docs/native-mobile/README.md)
- 담당 A(매치·탐색): [`../docs/native-mobile/OWNER-A.md`](../docs/native-mobile/OWNER-A.md)
- 담당 B(팀·선수·팬): [`../docs/native-mobile/OWNER-B.md`](../docs/native-mobile/OWNER-B.md)

앱 UI는 웹 모바일을 1px 단위로 복제한다. 현재 홈·공통 셸만 유지돼 있으며 다른 라우트는 제로베이스 상태다.

## 1단계 앱 셸

- 웹과 동일한 홈·매치·팬·팀·뉴스 독바와 Lucide 아이콘
- 헤더 알림, 영속 라이트·다크 모드 전환, 로그인 진입점
- 최애팀 선택 바텀시트와 팀 로고 팬 탭
- 허브 및 팬페이지 로컬 내비게이션
- 공용 로딩·빈 상태·에러·토스트·바텀시트
- Pretendard 본문과 Paperlogy 제목 폰트

## 같은 Wi-Fi에서 확인

PC와 휴대폰을 같은 Wi-Fi에 연결한 뒤 저장소 루트에서 실행합니다.

```powershell
npm.cmd run mobile:start
```

- Android: Expo Go 앱의 **Scan QR code**로 터미널 QR을 스캔합니다.
- iPhone: 기본 **카메라**로 QR을 스캔하고 Expo Go에서 엽니다.

## 멀리 있는 동료에게 공유

```powershell
npm.cmd run mobile:tunnel
```

표시되는 QR 또는 `exp://` 링크를 동료에게 전달합니다. 터널은 LAN보다 시작과 새로고침이 느릴 수 있으며, 개발 PC에서 명령이 계속 실행 중이어야 합니다.

## 점검

```powershell
npm.cmd --prefix mobile run typecheck
npm.cmd --prefix mobile run lint
npm.cmd --prefix mobile run doctor
```

API를 연결할 때는 `.env.example`을 `.env`로 복사하고, `localhost` 대신 휴대폰에서 접근 가능한 개발 PC의 LAN IP를 입력합니다.
