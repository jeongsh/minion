export function SiteFooter() {
  return <footer className="border-t border-[#dfe0e2] bg-background text-[#18191c] dark:border-[#383c44] dark:text-[#f8f8f8]">
    <div className="layout-wide py-5 text-left">
      <p className="text-lg font-black tracking-[-.04em]">MINION<span className="text-[#8b8e94]">.</span></p>
      <p className="mt-2 max-w-[1100px] text-[13px] leading-5 text-[#777b82] dark:text-[#8f98a8]">
        MINION isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.
      </p>
      <p className="mt-1 text-[13px] leading-5 text-[#777b82] dark:text-[#8f98a8]">
        Some content is provided courtesy of <a href="https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#18191c] dark:hover:text-white">Leaguepedia</a>, under a <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#18191c] dark:hover:text-white">CC-BY-SA 3.0 license</a>.
      </p>
    </div>
  </footer>;
}
