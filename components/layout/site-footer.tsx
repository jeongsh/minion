import Link from "next/link";

const footerLinks = [
  "이용약관",
  "개인정보처리방침",
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e8ecf5]">
      <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center">
            <span className="brand-logo-text text-2xl font-black tracking-normal text-[#071332]">MINION</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#7c86a0]" aria-label="푸터 메뉴">
            {footerLinks.map((link) => (
              <Link key={link} href="/community">
                {link}
              </Link>
            ))}
          </nav>
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
        <p className="mt-3 text-xs font-semibold text-[#98a2b3]">© 2026 MINION All Rights Reserved.</p>
      </div>
    </footer>
  );
}
