export function SourceNotice() {
  return (
    <aside className="rounded-md border border-border bg-surface-muted p-4 text-sm leading-6 text-muted">
      일부 경기/선수 통계는{" "}
      <a
        href="https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-accent underline-offset-4 hover:underline"
      >
        Leaguepedia
      </a>{" "}
      자료를 참고해 재정리했습니다. 본 페이지의 통계는 서비스 운영 기준으로 가공될 수
      있으며, 공식 Riot/LCK 기록과 차이가 있을 수 있습니다.
    </aside>
  );
}
