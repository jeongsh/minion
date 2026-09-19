/** Editorial observations, not match facts or a labelled dataset of real fans. */
export const STUDIO_RESEARCH_DATE = "2026-09-19";
export type StudioResearchSource = {
  id: string;
  label: string;
  url: string;
  publishedAt: string;
  scope: "본문" | "본문·노출된 일부 댓글";
  observation: string;
};

export const STUDIO_RESEARCH_SOURCES: StudioResearchSource[] = [
  { id: "recognition", label: "인벤 · 선수 인지도와 리그 전망 논쟁", url: "https://www.inven.co.kr/board/lol/4625/4179214", publishedAt: "2026-01-08", scope: "본문", observation: "경기 평가가 인지도·흥행 비교로 이동한다. 운영 의도와 미래 전망은 작성자의 추정이며 사실 자료로 쓰지 않는다." },
  { id: "transfer-target", label: "인벤 · 이적 선수 평가와 팬 구분 논쟁", url: "https://www.inven.co.kr/board/lol/4625/4183651", publishedAt: "2026-01-30", scope: "본문", observation: "팀 전체 부진을 한 선수에게 집중하거나 현 소속팀 경기에서 전 소속팀 선수를 비교 대상으로 부르는 논쟁. 본문의 팬 분류·낙인은 채택하지 않는다." },
  { id: "recovery", label: "인벤 · 젠지팬의 경기력 회복 기대", url: "https://www.inven.co.kr/board/lol/4625/4212372", publishedAt: "2026-05-16", scope: "본문", observation: "불리한 흐름을 바꾸려는 시도에서 위안을 얻으면서도 바텀 조합에는 아쉬움을 남긴다. 응원과 비판이 한 반응에 공존한다." },
  { id: "composition", label: "인벤 · KT 조합과 교전 감상", url: "https://www.inven.co.kr/board/lol/4625/4221336", publishedAt: "2026-06-07", scope: "본문", observation: "픽·성장·교전을 연결하고 경기 흐름이 달라지자 감상을 수정한다. 해당 픽의 강약을 모든 패치에 적용하지 않는다." },
  { id: "rival-support", label: "인벤 · T1팬을 자처한 한화 응원 글", url: "https://www.inven.co.kr/board/lol/4625/4238787", publishedAt: "2026-07-12", scope: "본문", observation: "제3의 상대에 대한 감정 때문에 다른 팀의 승리를 반기는 표현. 모든 T1팬이 같은 태도라는 주장이나 작성자의 실제 소속은 확인하지 않았다." },
  { id: "mixed-affection", label: "인벤 · 선수 응원과 시즌 아쉬움", url: "https://www.inven.co.kr/board/lol/4625/4255865", publishedAt: "2026-08-25", scope: "본문", observation: "선수에 대한 애정·격려와 결과에 대한 실망을 함께 표현한다. 본문에 포함된 피해·불화 주장은 검증하지 않았으며 재사용하지 않는다." },
  { id: "fearless", label: "인벤 · T1–BFX 5세트 밴픽 해석", url: "https://www.inven.co.kr/board/lol/4625/4257815", publishedAt: "2026-08-30", scope: "본문", observation: "앞 세트의 픽 소모, 남은 밴 카드, 선후픽과 조합 기능을 엮어 선택지를 해석한다. 작성자도 추정임을 밝히며 특정 상성·수치는 검증된 데이터가 아니다." },
  { id: "qualification", label: "인벤 · 정규 순위와 월즈 진출 조건 질문", url: "https://www.inven.co.kr/board/lol/4625/4258282", publishedAt: "2026-09-01", scope: "본문", observation: "정규 순위·플레이오프 성적·대회 진출권을 혼동하기 쉽다. 가상 대진 질문을 실제 결과나 공식 규정으로 읽지 않는다." },
  { id: "accept-defeat", label: "인벤 · T1 패배 인정과 상대 선수 응원", url: "https://www.inven.co.kr/board/lol/4625/4265018", publishedAt: "2026-09-12", scope: "본문", observation: "자기 팀의 패배를 인정하면서 상대 선수의 활약을 반기는 반응도 존재한다. T1팬 반응을 조롱 한 유형으로 고정하지 않는 반례다." },
  { id: "returned-taunt", label: "인벤 · 다른 팀에 쓰던 비유를 되돌리는 조롱", url: "https://www.inven.co.kr/board/lol/4625/4265021", publishedAt: "2026-09-12", scope: "본문", observation: "한 팀을 낮추던 비교 표현을 그 팀의 패배 뒤 되돌린다. 과거에 누가 실제로 먼저 말했는지는 이 글만으로 입증되지 않는다." },
  { id: "create-convert", label: "인벤 · 기회 창출과 이득 전환의 구분", url: "https://www.inven.co.kr/board/lol/4625/4265464", publishedAt: "2026-09-13", scope: "본문", observation: "틈을 만드는 능력과 생긴 틈으로 이득을 굴리는 능력을 짧게 구분한다. 팀의 영구적 특성으로 고정하지 않는다." },
  { id: "surprise", label: "인벤 · 예상보다 강한 경기력에 대한 감탄", url: "https://www.inven.co.kr/board/lol/4625/4265601", publishedAt: "2026-09-13", scope: "본문", observation: "사전 의심이 강한 경기력을 본 뒤 짧은 과장 비유와 감탄으로 바뀐다. 첨부 이미지의 구체적 장면은 분석하지 않았다." },
  { id: "premature-title", label: "인벤 · 국내 경기 직후 월즈 우승 기대", url: "https://www.inven.co.kr/board/lol/4625/4265613", publishedAt: "2026-09-13", scope: "본문", observation: "미래 우승을 이미 이룬 듯 말하는 기대성 제목. 제목의 완료형을 실제 우승 기록으로 추출하면 안 된다." },
  { id: "patch-anxiety", label: "인벤 · 강한 경기력 이후 패치 불안", url: "https://www.inven.co.kr/board/lol/4625/4265621", publishedAt: "2026-09-13", scope: "본문", observation: "현재 강점을 인정하면서 미래 패치·실전 감각을 걱정한다. 특정 팀을 겨냥한 패치라는 의도 추정은 사실로 채택하지 않는다." },
  { id: "matchup-chain", label: "인벤 · 연속 대진 결과를 압축한 평가", url: "https://www.inven.co.kr/board/lol/4625/4265805", publishedAt: "2026-09-13", scope: "본문", observation: "T1–한화와 한화–젠지 결과를 한 줄 관계로 압축한다. 앞으로도 절대 이기지 못한다는 표현은 과장이지 예측 근거가 아니다." },
  { id: "rival-anxiety", label: "인벤 · 우승 기대와 특정 상대에 대한 불안", url: "https://www.inven.co.kr/board/lol/4625/4265816", publishedAt: "2026-09-13", scope: "본문", observation: "응원하는 팀의 우승을 기대해도 특정 대진을 피하고 싶어 하는 감정이 공존한다. 대진·미래 결과를 확정하지 않는다." },
  { id: "trophy-joke", label: "인벤 · 대회별 우승팀을 엮는 농담", url: "https://www.inven.co.kr/board/lol/4625/4265827", publishedAt: "2026-09-13", scope: "본문", observation: "여러 팀의 성과를 나열하고 다음 대회 우승을 농담으로 예상한다. 농담을 경기력 분석이나 실제 예정 결과로 바꾸지 않는다." },
  { id: "respect-dislike", label: "인벤 · 승자 칭찬과 상대에 대한 취향", url: "https://www.inven.co.kr/board/lol/4625/4266008", publishedAt: "2026-09-13", scope: "본문", observation: "승자를 칭찬하고 양 팀의 수고를 인정하면서도 개인적인 비호감을 표현한다. 칭찬·호감·응원팀은 같은 정보가 아니다." },
  { id: "borrowed-result", label: "DC인사이드 · 타 팀 결과 이용과 평가 기준 변경을 비판하는 글", url: "https://gall.dcinside.com/board/view/?id=leagueoflegends6&no=14580539&page=1", publishedAt: "2026-07-21", scope: "본문", observation: "타 팀의 패배를 자기 팀의 가상 우승 근거로 삼거나 결과에 따라 대회의 가치를 바꾼다는 비판. T1에 적대적인 작성자의 주장이지 T1팬의 자술·빈도 증거가 아니다." },
  { id: "cup-thread", label: "Reddit · LCK Cup HLE–GEN 경기 토론", url: "https://www.reddit.com/r/leagueoflegends/comments/1qsv9av/hanwha_life_esports_vs_geng_lck_cup_2026_group/", publishedAt: "2026-02-01", scope: "본문·노출된 일부 댓글", observation: "진출 방식에 대한 농담, 개인 책임론과 팀 전체 문제라는 반박이 섞인다. 영문 말투나 공격 표현을 한국어 캐릭터에 그대로 옮기지 않는다." },
  { id: "msi-qualifier", label: "Reddit · HLE–T1 MSI 선발전 토론", url: "https://www.reddit.com/r/leagueoflegends/comments/1u3t58l/hanwha_life_esports_vs_t1_lck_2026_road_to_msi/", publishedAt: "2026-06-12", scope: "본문·노출된 일부 댓글", observation: "정글 개입 칭찬, 바텀에 몰린 자원과 조합의 지원 문제, 이전 부진 대비 회복을 서로 다른 관점에서 논한다." },
  { id: "t1-qualification", label: "Reddit · T1 MSI 진출 반응", url: "https://www.reddit.com/r/leagueoflegends/comments/1u5i979/congratulations_to_the_11th_and_final_team_for/", publishedAt: "2026-06-14", scope: "본문·노출된 일부 댓글", observation: "선수 칭찬, 성장 조합의 시간 제한, 패배 뒤 국제대회 기대를 비트는 농담이 섞인다. 과거 동료의 진출을 반기는 감정도 보인다." },
  { id: "msi-expectations", label: "Reddit · MSI 우승과 준우승 평가 토론", url: "https://www.reddit.com/r/leagueoflegends/comments/1uw6479/fun_fact_by_winning_the_msi_2026_grand_finals/", publishedAt: "2026-07-14", scope: "본문·노출된 일부 댓글", observation: "반복된 준우승을 실패로만 보는 평가에 사전 기대치와 상대 전력을 따지는 반박이 붙는다. 우승 팀이 같아도 팬마다 중요한 논점이 다르다." },
  { id: "reverse-sweep", label: "Reddit · HLE–T1 플레이오프 역전 시리즈 토론", url: "https://www.reddit.com/r/leagueoflegends/comments/1w58gce/hanwha_life_esports_vs_t1_lck_2026_season/", publishedAt: "2026-09-02", scope: "본문·노출된 일부 댓글", observation: "선픽과 열린 대응 픽을 지적하는 반응, 실망, 월즈 기대를 비트는 농담이 공존한다. 일부 댓글은 소속·선수 이름도 혼동하므로 사실 DB로 사용할 수 없다." },
  { id: "upper-final", label: "Reddit · HLE–GEN 결승 직행전 토론", url: "https://www.reddit.com/r/leagueoflegends/comments/1w7yi6l/hanwha_life_esports_vs_geng_lck_2026_season/", publishedAt: "2026-09-05", scope: "본문·노출된 일부 댓글", observation: "특정 픽의 대응 가치와 선수 폼을 칭찬하고 전 소속팀에 유리한 실수를 농담으로 엮는다. 고의 패배·내통을 사실로 해석하지 않는다." },
  { id: "lower-final", label: "Reddit · HLE–T1 결승 진출전 토론", url: "https://www.reddit.com/r/leagueoflegends/comments/1we7dfr/hanwha_life_esports_vs_t1_lck_2026_season/", publishedAt: "2026-09-12", scope: "본문·노출된 일부 댓글", observation: "바텀 투자와 이후 수행을 나누는 비판, 패배의 실망, 다음 국제대회에 대한 기대와 불신이 섞인다. 한 경기로 시즌 전체를 결론내리는 말도 보인다." },
  { id: "grand-final", label: "Reddit · GEN–HLE 결승 토론", url: "https://www.reddit.com/r/leagueoflegends/comments/1wf2cii/geng_vs_hanwha_life_esports_lck_2026_season/", publishedAt: "2026-09-13", scope: "본문·노출된 일부 댓글", observation: "패배한 픽을 탓하는 반응에 상대 픽이 제한한 선택지를 짚는 반박이 붙는다. 승리의 기쁨과 월즈 불안, 패배에도 선수 스타일을 지지하는 반응이 공존한다." },
];

export function isEligibleStudioResearchSource(source: StudioResearchSource): boolean {
  const date = new Date(`${source.publishedAt}T00:00:00Z`);
  return /^2026-\d{2}-\d{2}$/.test(source.publishedAt)
    && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === source.publishedAt
    && source.publishedAt <= STUDIO_RESEARCH_DATE;
}

export const STUDIO_STYLE_SOURCES = STUDIO_RESEARCH_SOURCES.filter(isEligibleStudioResearchSource).map(source => ({
  label: source.label,
  url: source.url,
  note: `게시 ${source.publishedAt} · 확인 ${STUDIO_RESEARCH_DATE} · ${source.scope}. ${source.observation}`,
}));
