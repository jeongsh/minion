# MINION 프로젝트 지침

## 디자인 변경 필수 지침

- MINION 웹 UI를 구현하거나 수정하기 전에 `minion-design` 스킬과 `docs/DESIGN.md`를 읽는다. 스킬이 설치되지 않은 환경에서는 `docs/DESIGN.md`를 실행 기준으로 삼는다.
- 홈과 관련 서브페이지의 기존 공용 컴포넌트를 먼저 확인한다. 전체보기는 `SectionHeading`을 사용한다.
- 화면 문구에 가운데점(U+00B7), 불필요한 설명문, 중복 부제나 영문 장식 제목을 추가하지 않는다.
- 테두리는 꼭 필요한 곳에만 사용하고 기존 표면 토큰과 간격으로 구분한다. 과거에 제거한 설명과 장식을 다시 추가하지 않는다.
- 현재 MINION의 디자인 컨셉을 유지한다. 요청 범위 안에서도 기존 색상 토큰, 표면, 간격, 정보 밀도, 레이아웃, 컴포넌트와 인터랙션 패턴을 따라 홈과 서브페이지의 통일성을 지킨다.
- 명시적인 디자인 변경 요청 없이 새로운 디자인 스타일을 도입하거나 주변 화면을 재디자인하지 않는다. 기존 스타일에 맞는 가장 작은 변경으로 구현한다.

## Supabase 마이그레이션 필수 지침

Supabase 스키마 변경이나 마이그레이션을 생성·수정·적용·복구하는 모든 작업은 조사나 실행을 시작하기 전에 반드시 설치된 `supabase:supabase` 스킬의 `SKILL.md`를 처음부터 끝까지 읽고, 해당 스킬의 최신 문서 확인·작업·검증 절차를 따라야 한다.

- Supabase 마이그레이션 작업에 임의의 방식이나 다른 도구의 관례를 대신 적용하지 않는다.
- Supabase CLI 명령과 옵션은 기억이나 추측으로 작성하지 말고 현재 설치된 CLI의 `--help`로 확인한다.
- 새 마이그레이션 파일이 필요하면 반드시 스킬에 규정된 Supabase CLI 절차로 생성한다. 파일명이나 타임스탬프를 직접 만들어 넣지 않는다.
- 스키마 변경 후에는 스킬에서 요구하는 테스트 쿼리, advisor 및 마이그레이션 상태 확인을 실행하여 실제 동작을 검증한다. 검증하지 않은 마이그레이션은 완료로 처리하지 않는다.
- 작업을 하위 작업자나 에이전트에게 위임할 때도 먼저 `supabase:supabase` 스킬을 읽고 그대로 준수하라고 명시한다.

## 모바일 앱 필수 지침

모바일 앱을 구현·수정하거나 웹 화면 및 기능을 모바일 앱으로 복제하는 모든 작업은 코드 조사나 구현을 시작하기 전에 반드시 `docs/native-mobile/README.md`를 처음부터 끝까지 읽어야 한다.

- README의 모든 절대 규칙, 기술 경계, 잠금 영역, 완료 조건을 작업 전 과정에 적용한다.
- 디자인 캡처만 참고하지 말고 웹 원본의 HTML/DOM, 컴포넌트, 프런트엔드 로직, 데이터 흐름, API와 백엔드 구현을 확인한 뒤 정확히 대응시킨다.
- 작업을 하위 작업자나 에이전트에게 위임할 때도 먼저 `docs/native-mobile/README.md`를 읽고 준수하라고 명시한다.
- README를 확인하지 않은 상태에서는 모바일 앱 관련 코드 변경을 시작하지 않는다.
- 모바일 앱 작업 규칙은 `docs/native-mobile/README.md`를 단일 실행 기준으로 적용한다.

## Android 빌드 방식 선택 규칙

- 네이티브 의존성, Expo SDK, 앱 설정, 권한, 서명 설정처럼 빌드 환경에 큰 영향을 주는 변경이 많으면 EAS Build를 우선 사용한다.
- JavaScript·TypeScript 코드, 스타일, 문구, API 호출처럼 네이티브 런타임을 바꾸지 않는 단순 수정은 로컬 Android 빌드를 우선 사용한다.
- EAS Build의 월간 빌드 한도나 크레딧을 모두 사용한 경우에는 변경 규모와 관계없이 로컬 Android 빌드로 전환한다.
- EAS 유료 플랜 결제를 권하기 전에 로컬 빌드 가능 여부와 현재 PC의 Android SDK·JDK 상태를 먼저 확인한다. 로컬 빌드로 해결할 수 있으면 결제를 필수 수단처럼 안내하지 않는다.
- 로컬 배포 빌드는 Google Play에 등록된 기존 앱과 동일한 업로드 키를 사용하고, 업로드 전에 `versionCode`가 기존 배포본보다 큰지 확인한다.

## 웹·모바일 폰트 사용 규칙

새 UI를 구현하거나 기존 UI의 텍스트 스타일을 변경할 때 다음 기준을 반드시 지킨다.

- 기본 본문 글꼴은 `Pretendard`다.
- `Paperozi`는 페이지 제목과 주요 섹션 제목에만 사용한다. 탭, 버튼, 필터, 셀렉트, 표, 메타 정보, 배지에는 사용하지 않는다.
- 한글 문장형 본문은 16px·weight 400~500을 기본으로 한다. 공간이 좁다는 이유로 본문을 14px 이하로 줄이지 않는다.
- 페이지 제목은 28px, 주요 섹션 제목은 20px, 하위 섹션 제목은 18px을 기준으로 한다.
- 카드 제목과 이름은 15~16px·weight 700~900, 일반 UI는 14px·weight 400~500, 메타 정보는 13px·weight 400~500을 사용한다.
- 한글이 한 글자라도 포함된 가시 텍스트는 최소 13px이다. 이름, 제목, 버튼 문구, 상태, 조사, 문장, 표의 핵심 값에 12px을 사용하지 않는다.
- 11px 이하의 가시 텍스트는 언어와 관계없이 사용하지 않는다.
- 12px은 `LIVE`, `BO5`, `W/L`, 영상 시간처럼 매우 짧은 영문·숫자 배지에만 허용하며 weight는 최대 500이다.
- 14px 이하 텍스트의 weight는 최대 500(`font-medium`)이다. `font-semibold`, `font-bold`, `font-extrabold`, `font-black`을 사용하지 않는다. 작은 텍스트를 강조해야 하면 크기, 배경색, 테두리 또는 색상 대비를 사용한다.
- 같은 화면과 컴포넌트에서 역할이 같은 텍스트는 크기, 굵기, 글꼴과 line-height를 통일한다.
- 폰트의 일관성을 우선 검토한다. 관련 페이지와 공용 컴포넌트의 동일한 역할에 같은 글꼴, 크기, 굵기, line-height를 적용하고 웹과 모바일에서도 같은 역할의 타이포그래피 위계를 유지한다.
- 임의의 폰트, 크기, 굵기나 자간을 추가하지 않는다. `docs/DESIGN.md`와 공용 스타일을 기준으로 구현하고, 기존 코드에 남은 작은 글씨나 금지된 굵기를 그대로 복제하지 않는다.
- 구현 전후에 `docs/DESIGN.md`의 타이포그래피 기준을 확인하고 웹 변경에는 `npm.cmd run lint:typography`를 실행한다.

## 웹 셀렉트 필수 규칙

- 사용자에게 보이는 웹 셀렉트 UI에는 네이티브 HTML `<select>`를 새로 사용하지 않는다.
- 반드시 `components/match-filter-dropdown.tsx`의 `FilterDropdown`을 import해 공용 커스텀 셀렉트로 사용한다.
- 옵션은 `{ value, label }` 구조로 전달하고 `ariaLabel`, `selected`, `onSelect`를 빠짐없이 지정한다.
- 기존 `FilterDropdown`으로 표현하기 어려운 요구가 있으면 일반 `<select>`로 우회하지 말고 공용 컴포넌트에 재사용 가능한 variant나 기능을 추가한다.
- 서버 폼 제출에 값이 필요하면 `FilterDropdown`의 선택 상태를 hidden input 또는 폼 상태와 동기화한다. 화면에 네이티브 `<select>`를 노출하지 않는다.

## Git 커밋 정리 규칙

사용자가 Git 커밋을 요청하면 커밋 전에 작업 트리를 점검하고, 커밋 대상 기능과 무관한 테스트 파일 및 임시 산출물을 자동으로 제외·폐기한다.

- `tests/`, `**/*.test.*`, `**/*.spec.*`의 새 파일과 변경은 사용자가 테스트 변경을 명시적으로 요청했거나 요청 기능을 유지하는 데 반드시 필요한 경우에만 커밋한다. 그 외에는 추적 파일 변경을 복원하고 미추적 파일을 제거한다.
- `.tmp/`, `tmp/`, `coverage/`, `test-results/`, `playwright-report/`, `*.tmp`, `*.temp` 등 실행 중 생성된 임시 파일과 테스트 산출물은 커밋하지 않는다. 추적된 임시 파일은 변경을 복원하고, 미추적 임시 파일은 제거한다.
- 테스트 파일이나 임시 파일을 폐기하기 전에 `git status`와 diff로 대상이 사용자 요청의 결과물이 아닌지 확인한다. 사용자 작업이거나 판단이 불분명한 파일은 임의로 폐기하지 않고 커밋에서만 제외한 뒤 사용자에게 알린다.
- 커밋 직전에 staged diff를 다시 확인하여 테스트·임시 파일이 섞이지 않았는지 검증한다.

## 추가 UI/UX 및 코딩 행동 규칙 적용 기준

아래 규칙을 모든 UI 생성, 수정, 문구 작성, 컴포넌트 생성 및 코드 변경에 적용한다. 기존 MINION 디자인 컨셉과 공용 컴포넌트를 유지하며, 폰트의 구체적인 기준은 위의 웹·모바일 폰트 사용 규칙과 `docs/DESIGN.md`를 따른다. 사용자의 명시적인 요구와 정확성, 접근성, 보안, 필수 고지는 시각적인 단순함보다 우선한다.

## UI/UX and Coding Behavior Rules

### 1. Core Principle

Build exactly what the user requests. Do not add content, interface elements, features, abstractions, or design embellishments merely to make the result appear more complete.

Favor intentional simplicity, visual clarity, consistency, and functional completeness over decorative complexity.

**Default behavior: preserve, simplify, reuse, and minimize. Do not embellish.**

These rules apply to all UI generation, UI modification, copywriting, component creation, and code changes.

### 2. Language and Copywriting

- All user-facing UI text must be written in natural Korean unless the user explicitly requests another language.
- Do not automatically add English subtitles beneath Korean headings.
- Do not add English eyebrow labels, category captions, or decorative English phrases above or below Korean text.
- Preserve established technical terms, brand names, and proper nouns when necessary.
- Never invent subtitles, descriptions, helper text, slogans, or introductory paragraphs to fill empty space.
- A heading does not require supporting text. A standalone heading is completely acceptable.
- Do not repeat the heading's meaning in a description.
- Prefer short, direct, functional copy over explanatory or promotional language.
- Avoid generic AI-generated marketing phrases such as "새로운 경험", "더 스마트한 관리", "한눈에 확인", "효율적인 워크플로우", and "원활한 경험" unless specifically appropriate and requested.
- Do not create unnecessary welcome messages, congratulations, encouragement, or conversational filler.
- Avoid excessive politeness in functional labels. Prefer "저장" over "저장해 주세요" and "설정 변경" over "설정을 변경할 수 있습니다".
- Use a single consistent terminology system throughout the application.
- Do not mix Korean and English for aesthetic reasons.

#### Text Separator Restrictions

- Do not use the middle dot character `·` as a decorative or structural text separator.
- Do not substitute `•`, `|`, `/`, or `—` merely to reproduce the same decorative separation pattern.
- When information requires separation, use proper spacing, distinct layout elements, line breaks, or semantic grouping.
- Do not format multiple unrelated phrases into one sentence simply to make the interface appear sophisticated.
- Preserve separator characters only when required by official names, exact data, or user-provided content.

### 3. Explanatory Text, Warnings, and Citations

- Do not add explanatory paragraphs when labels and controls are already self-explanatory.
- Do not add descriptions below every title, card, section, or setting.
- Do not add generic instructions such as "아래에서 확인하세요" when the action is obvious.
- Do not invent warnings, notices, disclaimers, or caution boxes.
- Only show warnings when there is a concrete security, privacy, safety, destructive-action, legal, or operational risk.
- Use the lowest appropriate visual emphasis for noncritical information.
- Never display routine information as an alarming warning.
- Do not add citation markers, source lists, footnotes, or reference sections to ordinary UI unless requested or necessary for a feature.
- When externally sourced information genuinely requires attribution, display it discreetly and accurately without compromising traceability.
- Do not remove mandatory legal disclosures, essential safety warnings, licenses, or required attribution.

### 4. Visual Design Restrictions

- Never default to a generic AI-generated SaaS aesthetic.
- Avoid unnecessary gradients, glowing effects, glassmorphism, decorative blobs, and colored background ornaments.
- Do not use purple or blue gradients as a default design choice.
- Do not wrap every piece of information in a card.
- Use cards only when the information represents a genuinely distinct interactive or semantic group.
- Do not add badges, chips, status indicators, icons, or emojis solely for decoration.
- Do not add icons beside every heading, button, or navigation item.
- Avoid excessive border radius, shadows, borders, and nested containers.
- Do not create large hero sections or oversized headings in functional application screens unless the layout requires them.
- Avoid excessive whitespace that reduces usable information density.
- Do not invent statistics, dashboard widgets, progress indicators, or activity feeds to make a page look populated.
- Do not introduce arbitrary accent colors when a design system already exists.
- Follow existing design tokens, typography, spacing, component patterns, and interaction conventions.
- Prefer clear typographic hierarchy, alignment, and spacing over additional visual decoration.
- Do not redesign an existing interface unless explicitly requested.

### 5. Layout and Interaction

- Minimize unnecessary clicks and navigation steps.
- Do not add confirmation dialogs for harmless or easily reversible actions.
- Require confirmation for genuinely destructive or irreversible operations when appropriate.
- Do not create buttons, dropdowns, toggles, or links without meaningful behavior.
- Never use fake success states or misleading placeholder functionality.
- Do not introduce unnecessary onboarding, tooltips, popovers, or help sections.
- Do not hide frequently used actions behind decorative menus without a usability reason.
- Maintain accessibility, keyboard interaction, responsive behavior, and adequate touch targets.
- Favor predictable and conventional interaction patterns over novelty.

### 6. Scope Control

- Make only the changes necessary to satisfy the user's explicit request.
- Do not interpret a narrow request as permission to redesign neighboring components or restructure unrelated code.
- Preserve existing functionality, styles, terminology, and user flows unless changes are required.
- Do not add optional features without a clear requirement.
- Do not create extra pages, sample components, mock data, documentation, or test scaffolding unnecessarily.
- Do not modify unrelated files.
- If a broader change is genuinely required, choose the smallest coherent implementation.
- Do not replace working implementations merely because another architecture seems more elegant.

### 7. Engineering Restrictions

- Inspect relevant existing code before implementing a solution.
- Reuse established components, hooks, utilities, styles, and project conventions.
- Do not introduce dependencies when existing project capabilities are sufficient.
- Avoid unnecessary abstraction layers, wrappers, factories, managers, and configuration objects.
- Do not introduce speculative architecture for hypothetical future requirements.
- Do not duplicate state, business logic, styling, or components.
- Do not implement fallback behavior that conceals genuine errors.
- Do not silently suppress exceptions or fabricate successful results.
- Fix root causes rather than stacking temporary workarounds.
- Avoid excessive comments that merely restate what the code already communicates.
- Never perform unrelated cleanup or mass formatting during a focused change.
- Do not claim that a build, test, or feature works unless it was actually verified.

### 8. Content Density and Restraint

Before adding any visible element, ask:

1. Was this element explicitly requested?
2. Does it provide information or functionality necessary for the user's task?
3. Is the same information already visible elsewhere?
4. Can the interface communicate the same thing with fewer words or fewer components?
5. Does this addition match the existing product's design language?

If an optional element has no clear functional or informational justification, omit it.

Do not compensate for a simple interface by adding explanatory copy or decorative UI.

**Empty space is preferable to meaningless content. A simple functional interface is preferable to a visually busy but redundant interface.**

### 9. Final Self-Review

Before completing any UI-related task, verify:

- No unsolicited English subtitles or decorative English labels.
- No unnecessary Korean descriptions, slogans, or helper text.
- No decorative middle-dot text separators.
- No unnecessary warnings, citations, or disclaimers.
- No redundant cards, badges, icons, or decorative effects.
- No invented statistics, features, data, or UI sections.
- No unrelated layout or code changes.
- No unnecessary dependencies or abstractions.
- All interactive elements perform their intended actions.
- Existing design conventions and required accessibility are preserved.

If any violation is found, correct it before presenting the result.

### 10. Priority Rule

When choosing between a more elaborate implementation and a simpler one that fully meets the requirements, choose the simpler one.

**Do not mistake additional content for completeness, additional components for good design, or additional code for engineering quality.**

Explicit user requirements, correctness, accessibility, security, and mandatory disclosures take precedence over aesthetic minimalism.
