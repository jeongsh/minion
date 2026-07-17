import type { Metadata } from "next";

import { PolicyPage } from "@/components/policy/policy-page";
import { POLICY_EFFECTIVE_DATE, siteContactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "광고 및 제휴 문의",
  description: "MINION 광고 지면과 제휴 문의 안내입니다.",
};

export default function AdvertisingPage() {
  const email = siteContactEmail();
  const subject = encodeURIComponent("[MINION 광고·제휴 문의]");

  return (
    <PolicyPage title="광고 및 제휴 문의" description="MINION은 이용 흐름을 방해하지 않는 범위에서 광고와 제휴 콘텐츠를 운영합니다." effectiveDate={POLICY_EFFECTIVE_DATE}>
      <section><h2>광고 운영 원칙</h2><ul><li>광고를 일반 게시물, 메뉴, 다운로드 또는 재생 버튼으로 오인하게 만들지 않습니다.</li><li>모바일 가로 광고는 원칙적으로 50~60px, 데스크톱 가로 광고는 60~90px 범위로 운영합니다.</li><li>직접 제휴 콘텐츠는 “광고” 또는 “Sponsored” 등으로 구분합니다.</li><li>불법 도박, 사행성, 성인, 불법 금융, 권리 침해 또는 이용자 신뢰를 해칠 수 있는 광고는 받지 않습니다.</li><li>이용자가 직접 광고 클릭을 유도하거나 보상을 제공하는 방식의 캠페인은 진행하지 않습니다.</li></ul></section>
      <section><h2>제공 가능한 지면</h2><div className="overflow-x-auto"><table><thead><tr><th>지면</th><th>형태</th><th>비고</th></tr></thead><tbody><tr><td>홈·경기·팀·선수 상세</td><td>반응형 가로 배너</td><td>모바일 320×50 계열, 데스크톱 728×90 이하</td></tr><tr><td>커뮤니티·콘텐츠 사이드</td><td>사각 배너</td><td>최대 300×250, 데스크톱 중심</td></tr><tr><td>팬 콘텐츠 협업</td><td>직접 스폰서십</td><td>별도 협의 및 광고 표시</td></tr></tbody></table></div></section>
      <section><h2>문의할 때 알려주세요</h2><ul><li>회사·브랜드명과 담당자 연락처</li><li>홍보하려는 상품 또는 서비스와 연결 주소</li><li>희망 기간, 지면, 예산과 소재 규격</li><li>사업자 정보와 필요한 심의·허가 자료</li></ul><p><a href={`mailto:${email}?subject=${subject}`} className="inline-flex rounded-xl bg-[var(--ui-ink)] px-5 py-3 !text-[var(--ui-surface)] !no-underline">{email}로 광고 문의하기</a></p></section>
      <section><h2>Google 광고 안내</h2><p>일부 지면에는 Google AdSense가 제공하는 문맥·관심 기반 광고가 표시될 수 있습니다. Google과 파트너는 쿠키를 사용해 광고를 제공하거나 측정할 수 있으며, 자세한 내용과 선택 방법은 개인정보처리방침에서 확인할 수 있습니다.</p></section>
    </PolicyPage>
  );
}
