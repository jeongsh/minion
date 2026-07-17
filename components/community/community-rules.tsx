// 커뮤니티 이용 규칙 본문(허브/팀 공용).
// 제재·블라인드 로직과 함께 운영 원칙의 단일 소스 역할을 한다 — 규칙을 바꾸면 여기만 고친다.

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. 기본 원칙",
    items: [
      "이곳은 LCK 선수와 팀을 응원하고 덕질하는 공간입니다. 응원이 먼저, 비판은 매너 있게.",
      "선수·팀·팬덤에 대한 인신공격, 비하, 혐오 표현을 금지합니다. 별명이라도 조롱 목적이면 동일하게 처리됩니다.",
      "특정 선수·팀을 깎아내려 다른 선수·팀을 올리는 비교·저격성 게시물을 금지합니다.",
      "확인되지 않은 사생활 루머, 허위 사실 유포를 금지합니다.",
    ],
  },
  {
    title: "2. 공간별 규칙",
    items: [
      "허브 커뮤니티(전체): 경기력에 대한 비평은 허용됩니다. 단, 근거 없는 조롱과 욕설은 금지입니다.",
      "팀 팬 커뮤니티: 해당 팀을 응원하는 팬들의 공간입니다. 해당 팀·소속 선수에 대한 비난 글은 제한됩니다.",
      "팀 팬 커뮤니티의 글이나 댓글을 허브로 끌고 와 저격·조리돌림하는 행위를 금지합니다.",
      "말머리(자유/유머/응원 등)에 맞게 글을 작성해 주세요.",
    ],
  },
  {
    title: "3. 신고와 블라인드",
    items: [
      "욕설 등 금칙어가 포함된 글·댓글은 등록 시점에 자동으로 차단됩니다.",
      "규칙 위반 글·댓글은 '리폿' 버튼으로 신고할 수 있습니다. 같은 글은 1인 1회만 신고됩니다.",
      "서로 다른 이용자의 신고가 일정 수 이상 누적되면 글·댓글이 자동으로 블라인드(가림) 처리됩니다.",
      "블라인드된 글은 운영진이 검토합니다. 위반이 확인되면 제재가 확정되고 작성자의 LP가 차감되며, 오신고로 판단되면 블라인드가 해제됩니다.",
      "허위·장난 신고를 반복하면 신고자가 제재될 수 있습니다.",
    ],
  },
  {
    title: "4. 제재",
    items: [
      "위반 정도에 따라 경고 → LP 차감 → 이용 제한 순으로 제재됩니다.",
      "삭제된 게시물은 분쟁 대응을 위해 일정 기간 보관 후 파기됩니다.",
      "제재 내역과 기준은 운영 상황에 따라 보완될 수 있으며, 변경 시 공지합니다.",
    ],
  },
  {
    title: "5. 인기글",
    items: [
      "명예(추천)에서 싫어요를 뺀 수가 기준 이상이 되면 인기글로 등재되고 홈과 인기 탭에 노출됩니다.",
      "인기글 등재를 노린 추천 조작(다중 계정 등)이 확인되면 등재 취소와 함께 제재됩니다.",
    ],
  },
];

export function CommunityRules() {
  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <section key={section.title} className="rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 sm:p-6">
          <h2 className="text-base font-bold text-[var(--ui-ink)] sm:text-lg">{section.title}</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-[var(--ui-text)] sm:text-[15px]">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[13px] text-[var(--ui-muted)]">
        규칙은 커뮤니티 상황에 따라 업데이트될 수 있습니다. 문의는 프로필의 문의 채널을 이용해 주세요.
      </p>
    </div>
  );
}
