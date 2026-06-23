import Link from "next/link";

const footerLinks = [
  "이용약관",
  "개인정보처리방침",
  "청소년보호정책",
  "운영정책",
  "공지사항",
  "고객센터",
  "팬보드",
  "파트너스",
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e8ecf5]">
      <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative h-6 w-8 overflow-hidden">
              <span className="absolute left-0 top-2 h-0 w-0 border-y-[7px] border-l-[27px] border-y-transparent border-l-[#071332]" />
              <span className="absolute bottom-1 right-0 h-1.5 w-3.5 -rotate-12 bg-[#071332]" />
            </span>
            <span className="text-2xl font-black tracking-[0.04em] text-[#071332]">LCK</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#7c86a0]" aria-label="푸터 메뉴">
            {footerLinks.map((link) => (
              <Link key={link} href="/community">
                {link}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-[#e1e6f0] px-4 text-xs font-black text-[#344054]"
          >
            한국어
            <span aria-hidden="true">⌄</span>
          </button>
        </div>
        <p className="mt-5 text-xs leading-5 text-[#98a2b3]">
          일부 경기/선수 통계는{" "}
          <a
            href="https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#667085] underline-offset-4 hover:underline"
          >
            Leaguepedia
          </a>{" "}
          자료를 참고해 재정리했습니다. 본 페이지의 통계는 서비스 운영 기준으로 가공될 수 있으며, 공식 Riot/LCK
          기록과 차이가 있을 수 있습니다.
        </p>
        <p className="mt-3 text-xs font-semibold text-[#98a2b3]">© 2026 MINIONS All Rights Reserved.</p>
      </div>
    </footer>
  );
}
