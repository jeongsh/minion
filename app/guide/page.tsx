import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "경기 기록 읽는 법",
  description: "매치와 세트의 차이부터 승률, 세트 득실, KDA, 밴픽 표본까지. MINION에서 경기 기록을 비교하고 해석하는 방법을 예시로 설명합니다.",
  alternates: { canonical: "/guide" },
};

const sections = [
  { id: "match", title: "매치 승리와 세트 승리를 구분하세요" },
  { id: "comparison", title: "비교할 기간과 대회를 먼저 맞추세요" },
  { id: "stats", title: "선수 지표는 역할과 함께 읽으세요" },
  { id: "draft", title: "밴픽률과 승률은 서로 다른 질문입니다" },
  { id: "watch", title: "기록에서 관전 질문을 만드는 순서" },
  { id: "sources", title: "기록, 해석, 팬 의견을 구분하세요" },
];

export default function GuidePage() {
  return (
    <main className="layout-wide max-w-4xl pb-20 pt-6 text-[var(--ui-text)] sm:pt-10">
      <nav aria-label="현재 위치" className="mb-5 text-sm font-medium">
        <Link href="/" className="underline underline-offset-4">홈</Link>
        <span> / 경기 기록 읽는 법</span>
      </nav>
      <article className="space-y-10 text-base font-normal leading-7 [&_h2]:font-paperozi [&_h2]:text-xl [&_h2]:font-normal [&_h2]:leading-7 [&_h2]:text-[var(--ui-ink)] [&_p]:mt-4">
        <header>
          <h1 className="font-paperozi text-[28px] font-normal leading-tight text-[var(--ui-ink)]">경기 기록 읽는 법</h1>
          <p>경기 결과를 확인하는 것과 경기력을 설명하는 것은 다릅니다. 같은 2:1 승리라도 상대, 출전 선수, 패치와 세트별 양상이 다를 수 있습니다. 이 안내는 MINION의 일정·대회·선수 기록을 오가며 비교할 때 놓치기 쉬운 기준을 정리합니다.</p>
          <p className="text-[13px] font-medium leading-5 text-[var(--ui-muted)]">MINION 이용 안내 · 아래 수치 예시는 설명을 위한 가상 기록입니다.</p>
        </header>
        <nav aria-label="안내 목차" className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-5">
          <ol className="list-decimal space-y-2 pl-5">
            {sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className="underline underline-offset-4">{section.title}</a></li>)}
          </ol>
        </nav>
        <section id="match" className="scroll-mt-24">
          <h2>{sections[0].title}</h2>
          <p>매치는 두 팀의 한 대결이고, 세트는 그 대결 안에서 치르는 개별 게임입니다. BO3는 먼저 두 세트를 이기는 팀이, BO5는 먼저 세 세트를 이기는 팀이 매치에서 승리합니다. 경기 상세의 2:1은 매치 2승 1패가 아니라 한 매치 안의 세트 스코어입니다.</p>
          <p>예를 들어 A팀이 두 매치를 각각 2:0, 1:2로 마쳤다면 매치 성적은 1승 1패입니다. 세트 성적은 3승 2패이며 세트 득실은 +1입니다. 매치 승률은 50%, 세트 승률은 60%로 서로 다릅니다. 순위표의 승패와 세트 득실을 함께 보면, 같은 매치 성적을 낸 팀들의 결과 차이를 더 구체적으로 읽을 수 있습니다.</p>
          <p>다만 세트 득실만으로 공식 순위의 모든 동률 규칙을 설명할 수는 없습니다. 대회 단계와 공식 규정을 함께 확인하고, MINION의 정규시즌 요약을 플레이오프 최종 순위로 해석하지 마세요.</p>
          <p><Link href="/tournaments" className="underline underline-offset-4">대회별 결과 살펴보기</Link></p>
        </section>
        <section id="comparison" className="scroll-mt-24">
          <h2>{sections[1].title}</h2>
          <p>두 팀을 비교할 때는 같은 대회와 기간을 선택하는 것이 출발점입니다. 시즌 전체 성적에는 여러 상대와 패치가 섞입니다. 최근 몇 경기만 보면 변화는 잘 보이지만 상대적으로 적은 표본에 결론이 좌우될 수 있습니다.</p>
          <p>먼저 시즌 전체에서 어떤 결과를 냈는지 확인하고, 최근 경기에서 달라진 점을 별도로 살펴보세요. 최근 3연승이라는 사실만으로 전력이 더 강하다고 단정하기보다, 어떤 상대를 만났는지와 출전 구성이 같았는지를 확인하는 방식입니다. 과거 맞대결도 현재의 로스터와 패치가 다르면 그대로 적용하기 어렵습니다.</p>
          <p>예정 경기의 빈 스코어는 무승부가 아니며, 수집되지 않은 세부 기록은 0점이라는 뜻이 아닙니다. 기록이 빠진 세트를 포함해 평균을 직접 계산하면 결과가 왜곡될 수 있으므로 비교에 사용한 세트 수를 함께 확인하세요.</p>
        </section>
        <section id="stats" className="scroll-mt-24">
          <h2>{sections[2].title}</h2>
          <p>KDA는 킬과 어시스트를 데스로 나눈 지표입니다. 예를 들어 4킬·2데스·6어시스트라면 KDA는 5입니다. 데스가 0인 경우에는 나눗셈이 정의되지 않으므로 표시 방식과 집계 기준을 확인해야 합니다. 또 여러 세트의 KDA를 단순 평균한 값은 전체 킬·데스·어시스트를 합쳐 계산한 값과 다를 수 있습니다.</p>
          <p>분당 피해량은 게임 길이가 다른 기록을 비교하는 데 도움이 되지만, 공격할 기회와 챔피언 역할까지 같게 만들지는 않습니다. 멀리서 지속적으로 피해를 주는 챔피언과 진입·보호를 맡은 챔피언은 기대되는 지표가 다릅니다. 같은 포지션과 비슷한 역할을 먼저 비교하는 편이 좋습니다.</p>
          <p>15분 골드 차이는 초반 특정 시점의 격차를 보여줍니다. 이 값이 높다고 해당 선수가 혼자 차이를 만들었다고 단정할 수는 없습니다. 정글 개입, 팀의 자원 배분, 라인 교환과 같은 맥락을 다시보기에서 확인하면 숫자를 더 정확히 설명할 수 있습니다.</p>
          <p><Link href="/players" className="underline underline-offset-4">선수별 기록 비교하기</Link></p>
        </section>
        <section id="draft" className="scroll-mt-24">
          <h2>{sections[3].title}</h2>
          <p>밴픽률은 전체 세트 가운데 챔피언이 선택되거나 금지된 비중이고, 승률은 실제 선택된 세트 가운데 승리한 비중입니다. 10세트에서 2번 선택되고 6번 금지된 챔피언의 밴픽률은 80%입니다. 두 번의 선택에서 한 번 이겼다면 승률은 50%이며, 금지된 여섯 세트는 승률 계산에 넣지 않습니다.</p>
          <p>1승 0패의 100%와 8승 2패의 80% 중 어느 쪽이 더 믿을 만한지는 퍼센트만으로 판단할 수 없습니다. 선택 횟수, 사용 팀과 상대, 포지션을 함께 보세요. 특히 대회에서 사용된 패치와 현재 게임 패치가 다르면 대회 통계를 현재 랭크 게임의 추천 순위로 바로 옮기기 어렵습니다.</p>
          <p>여러 지표를 가중해 만든 종합 점수나 티어를 볼 때도 계산 방식과 표본을 먼저 확인하세요. 이런 수치는 해석을 돕는 도구이며 공식 등급이나 다음 경기의 확정 결과를 의미하지 않습니다.</p>
        </section>
        <section id="watch" className="scroll-mt-24">
          <h2>{sections[4].title}</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5">
            <li><Link href="/schedule" className="underline underline-offset-4">일정 및 매치</Link>에서 대진과 경기 날짜를 확인합니다. 아직 상대가 미정인 경기는 확정된 맞대결처럼 비교하지 않습니다.</li>
            <li>대회 화면에서 두 팀의 같은 기간 성적을 확인합니다. 전체 성적과 최근 결과를 구분해 메모합니다.</li>
            <li>완료된 경기 상세에서 세트별 스코어와 확인 가능한 밴픽·선수 기록을 살펴봅니다. 한 세트의 결과를 전체 시리즈에 일반화하지 않습니다.</li>
            <li>“이 팀은 강하다”보다 “초반 격차가 난 세트에서 어느 시점에 주도권이 바뀌었나”처럼 다시보기로 확인할 수 있는 질문을 만듭니다.</li>
            <li>다시보기를 확인한 뒤 관찰한 장면과 개인 해석을 구분해 팬톡에 남깁니다. 경기·세트·영상 시점을 함께 적으면 다른 팬도 근거를 확인하기 쉽습니다.</li>
          </ol>
        </section>
        <section id="sources" className="scroll-mt-24">
          <h2>{sections[5].title}</h2>
          <p>MINION은 공개 경기 자료를 정리한 기록, AI를 활용한 분석, 이용자가 작성한 의견을 함께 제공합니다. 뉴스 제목과 영상 링크는 외부 매체·채널의 콘텐츠로, 원문에서 전체 내용과 게시 시점을 확인할 수 있습니다. 출처가 표시되어 있다는 사실만으로 분석의 모든 문장이 검증되었다는 뜻은 아닙니다.</p>
          <p>경기 프리뷰의 분석 시점과 실제 경기 날짜가 다를 수 있으므로 현재 일정은 <Link href="/schedule" className="underline underline-offset-4">일정 및 매치</Link>에서 확인하세요. AI의 승리 예상과 팬 참여 비율도 서로 다른 값이며 실제 승리 확률을 보장하지 않습니다.</p>
          <p>잘못된 기록을 발견하면 <Link href="/support" className="underline underline-offset-4">고객센터</Link>에 경기 주소, 세트 번호, 잘못 표시된 값과 확인 가능한 원문 주소를 알려주세요. 운영·데이터 원칙은 <Link href="/about" className="underline underline-offset-4">서비스 소개</Link>에서 확인할 수 있습니다.</p>
        </section>
      </article>
    </main>
  );
}
