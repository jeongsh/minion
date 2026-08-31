# MINION reaction minicons v1

2026-08-31 기준 월간 인기 디시콘의 공통 문법을 분석해 만든 MINION 오리지널 캐릭터 레퍼런스 세트다. 특정 디시콘의 캐릭터·원화·고유 문구를 복제하지 않고 다음의 고수준 특징만 반영했다.

- 200×200 정사각형에서 바로 읽히는 큰 얼굴과 상반신
- 상단 20~30%를 차지하는 2~4음절 반응 문구
- 굵고 약간 불균일한 짙은 외곽선, 흰 스티커 키라인, 평면 색
- 같은 감정을 캐릭터·포즈·레터링으로 다섯 번 변주
- GIF가 아닌 정적 투명 PNG

## 구성

| 감정 | 파일 | 캐릭터 | 레터링 방향 |
| --- | --- | --- | --- |
| 응원 | `01-go-megaphone.png` | 메가폰 구름 | 굵고 압축된 코믹 헤드라인 |
| 응원 | `02-go-flag.png` | 깃발 팬 | 기울어진 응원 붓글씨 |
| 응원 | `03-go-marker.png` | 마커 분석가 | 둥근 매직펜 손글씨 |
| 응원 | `04-go-blue-guide.png` | 블루 가이드 | 각진 판타지 블록 |
| 응원 | `05-go-red-member.png` | 레드 멤버 | 통통 튀는 버블 글자 |
| 승리 | `06-win-megaphone.png` | 메가폰 구름 | 굵고 압축된 코믹 헤드라인 |
| 승리 | `07-win-flag.png` | 깃발 팬 | 기울어진 응원 붓글씨 |
| 승리 | `08-win-marker.png` | 마커 분석가 | 둥근 매직펜 손글씨 |
| 승리 | `09-win-blue-guide.png` | 블루 가이드 | 각진 판타지 블록 |
| 승리 | `10-win-red-member.png` | 레드 멤버 | 통통 튀는 버블 글자 |

웹에서 쓰는 최종본은 `public/minicons/minion-reactions-v1/`에 있고, 생성 원본은 이 폴더의 `source/`에 있다.

## 공통 생성 프롬프트

```text
Use case: stylized-concept
Asset type: static square PNG minicon for the MINION LCK fan community
Input images: Image 1 is the character-identity reference only. Preserve its core colors, silhouette, and signature prop or outfit while creating a new pose and expression.
Primary request: an original cheering or victory reaction. Include the supplied Korean caption exactly once.
Style/medium: original 2D chibi community-sticker illustration; oversized face and eyes; thick slightly uneven #18191C hand-drawn contour plus a clean white outer sticker keyline; flat color blocks with minimal cel shading; compressed, funny, high-emotion expression; handmade sticker finish. Use only high-level traits and do not reproduce any existing sticker artwork or character.
Composition/framing: 1:1 square; face and upper body dominate the lower 70%; caption dominates the upper 25%; readable at 200px and 60px; safe margins; no cropping.
Color palette: MINION mint #03DE8A, ink #18191C, blue #2262F8, red #FF2F44, butter yellow #FFE45C.
Scene/backdrop: genuinely transparent background.
Constraints: static image only; no animation; no GIF; no panel border; no card; no watermark; no unrelated extra text or logo; preserve clean alpha edges.
```

각 파일은 캐릭터 참조 이미지, 문구 `가자!` 또는 `이겼다!`, 위 표의 레터링 방향만 교체해 built-in ImageGen으로 별도 생성했다.

## 최종 보정

- 생성기가 투명 배경 대신 그려 넣은 체크무늬는 캐릭터와 흰 키라인을 보존해 실제 PNG 알파로 변환했다.
- `08-win-marker.png`와 `09-win-blue-guide.png`는 외곽선이 캔버스에 닿지 않도록 투명 안전 여백을 추가했다.
- `10-win-red-member.png`는 기존 시안의 잘린 하단을 쓰지 않고, 같은 캐릭터·문구·버블 레터링을 유지하면서 `full robe hem, both legs, and both feet fully visible; at least 8% clear margin` 조건으로 별도 재생성했다. 균일한 크로마 배경을 제거해 실제 투명 PNG로 마감했다.
