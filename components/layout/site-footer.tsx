import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return <footer className="bg-[var(--page-background)] text-[#18191c] dark:text-[#f8f8f8]">
    <div className="layout-wide py-5 text-left">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Image src="/logo.svg" alt="MINION" width={171} height={39} className="h-auto w-16 shrink-0" />
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-bold text-[#666a71] dark:text-[#a0a7b2]" aria-label="서비스 정책">
          <Link href="/about" className="hover:text-[#18191c] dark:hover:text-white">서비스 소개</Link>
          <Link href="/terms" className="hover:text-[#18191c] dark:hover:text-white">이용약관</Link>
          <Link href="/privacy" className="hover:text-[#18191c] dark:hover:text-white">개인정보처리방침</Link>
          <Link href="/community/rules" className="hover:text-[#18191c] dark:hover:text-white">커뮤니티 운영원칙</Link>
          <Link href="/advertising" className="hover:text-[#18191c] dark:hover:text-white">광고·제휴 문의</Link>
        </nav>
      </div>
      <p className="mt-2 max-w-[1100px] text-[10px] leading-5 text-[#777b82] md:text-[12px] dark:text-[#8f98a8]">
        MINION isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.
      </p>
      <p className="mt-1 text-[10px] leading-5 text-[#777b82] md:text-[12px] dark:text-[#8f98a8]">
        Some content is provided courtesy of <a href="https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#18191c] dark:hover:text-white">Leaguepedia</a>, under a <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#18191c] dark:hover:text-white">CC-BY-SA 3.0 license</a>.
      </p>
      <p className="mt-3 text-[12px] text-[#8b8e94]">© {new Date().getFullYear()} MINION. All rights reserved.</p>
    </div>
  </footer>;
}
