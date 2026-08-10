import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { siteContactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "서비스 소개",
  description: "LCK 팬 허브 MINION의 서비스와 데이터·편집 원칙을 소개합니다.",
};

export default function AboutPage() {
  const email = siteContactEmail();
  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide max-w-4xl pb-20 pt-6 sm:pt-10">
        <PageHeader title="서비스 소개" />
        <div className="mt-8 flex flex-col gap-8 text-[15px] leading-7">
          <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-6 sm:p-8">
            <p className="text-[13px] font-black uppercase tracking-[0.16em] text-[var(--ui-muted)]">About MINION</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-[var(--ui-ink)]">LCK를 더 깊고 편하게 즐기는 팬 허브</h2>
            <p className="mt-4">MINION은 경기 일정과 세트 데이터, 팀·선수 기록, 주간 분석, 팬 평가와 커뮤니티를 하나의 흐름으로 연결합니다. 단순히 외부 정보를 모으는 데 그치지 않고 경기별 비교와 팬 참여 기록을 함께 제공합니다.</p>
          </section>
          <section><h2 className="text-xl font-black text-[var(--ui-ink)]">데이터와 편집 원칙</h2><ul className="mt-3 list-disc space-y-2 pl-5"><li>경기·선수 기본 데이터는 공식 공개 자료와 Leaguepedia 등 표시된 출처를 바탕으로 정리합니다.</li><li>주간 리포트와 경기 프리뷰의 분석·요약은 MINION이 구성하며, AI를 활용한 내용은 참고 자료로 검토 후 제공합니다.</li><li>오류를 발견하면 출처와 최신 기록을 확인해 수정하며, 제보 내용도 동일한 기준으로 검토합니다.</li><li>팬 평가와 게시글은 이용자 의견이며 공식 리그·팀·선수의 입장을 뜻하지 않습니다.</li></ul></section>
          <section><h2 className="text-xl font-black text-[var(--ui-ink)]">독립 팬 서비스</h2><p className="mt-3">MINION은 Riot Games 또는 LCK 참가 팀이 운영·보증하는 공식 서비스가 아닙니다. 각 명칭, 로고와 게임 자산의 권리는 해당 권리자에게 있습니다.</p></section>
          <section><h2 className="text-xl font-black text-[var(--ui-ink)]">문의</h2><p className="mt-3">서비스 오류, 데이터 정정, 권리 침해 및 일반 문의는 <a href={`mailto:${email}`} className="font-bold underline underline-offset-4">{email}</a>로 보내주세요. 광고·제휴는 <Link href="/advertising" className="font-bold underline underline-offset-4">광고 및 제휴 안내</Link>에서 확인할 수 있습니다.</p></section>
        </div>
      </div>
    </main>
  );
}
