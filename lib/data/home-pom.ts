import { unstable_cache } from "next/cache";
import { getAllPlayers, getAllTeams, getMatches, getTournaments } from "@/lib/data/lck";
import { matchHref } from "@/lib/view-data";

/**
 * 홈 "최근 POM" 캐시 태그. 경기 데이터(POM 포함)를 갱신하는 관리자 액션은
 * HOME_PUBLIC_DATA_TAG 와 함께 이 태그도 무효화해야 홈에 즉시 반영된다.
 */
export const HOME_POM_TAG = "home-pom";

export type HomePomEntry = {
  matchId: string;
  href: string;
  matchDate: string;
  playerSlug: string;
  playerName: string;
  playerImageUrl: string;
  position: string;
  teamShortName: string;
  teamLogoUrl: string | null;
  teamPrimaryColor: string | null;
  opponentShortName: string;
  /** "MSI 2026" 처럼 짧은 대회명. 어느 대회 경기였는지 카드에서 바로 보여준다. */
  tournamentName: string;
  /** POM 선수 팀 기준 세트 스코어("3:1"). 점수가 없으면 null. */
  scoreLabel: string | null;
};

const HOME_POM_LIMIT = 10;

/**
 * 최근 POM(공식 MVP) 선수 목록.
 *
 * 날짜 단위가 아니라 "최근 N명"으로 뽑는 이유:
 * LCK 주관 경기는 POM이 사실상 100% 채워지지만(2026 R1-2 90/90, LCK Cup 40/40),
 * 국제대회는 거의 비어 있다(EWC 1/28, KeSPA Cup 0/17). 게다가 하루 경기 수가
 * 1~2경기라 "어제의 POM"으로 잡으면 0명인 날과 2명인 날이 번갈아 나온다.
 * 완료 경기를 최신순으로 훑어 POM이 있는 것부터 채우면, 국제대회 기간에도
 * 직전 LCK 경기들이 자연스럽게 올라와 별도 예외 처리가 필요 없다.
 */
export const getHomePomEntries = unstable_cache(
  async (): Promise<HomePomEntry[]> => {
    const [matches, players, teams, tournaments] = await Promise.all([
      getMatches(),
      getAllPlayers(),
      getAllTeams(),
      getTournaments(),
    ]);

    const playersById = new Map(players.map((player) => [player.id, player]));
    const teamsById = new Map(teams.map((team) => [team.id, team]));
    const tournamentNamesById = new Map(tournaments.map((tournament) => [tournament.id, tournament.name]));

    const entries: HomePomEntry[] = [];
    const recentCompleted = matches
      .filter((match) => match.status === "completed" && match.officialPomPlayerId)
      .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());

    for (const match of recentCompleted) {
      if (entries.length >= HOME_POM_LIMIT) break;

      const player = playersById.get(match.officialPomPlayerId!);
      if (!player) continue;

      // 선수의 현재 소속팀이 아니라 그 경기에서 뛴 팀을 보여줘야 맞지만, 매치 단위
      // 로스터가 없어 현재 소속팀으로 대신한다. 이적 직후에는 어긋날 수 있다.
      const team = teamsById.get(player.teamId);
      const isTeamA = match.teamAId === player.teamId;
      const opponentId = isTeamA ? match.teamBId : match.teamAId;

      // 스코어는 POM 선수 팀을 앞에 둔다(카드에서 팀명 순서와 맞춘다).
      const ownScore = isTeamA ? match.teamAScore : match.teamBScore;
      const opponentScore = isTeamA ? match.teamBScore : match.teamAScore;
      const scoreLabel =
        ownScore != null && opponentScore != null ? `${ownScore}:${opponentScore}` : null;

      entries.push({
        matchId: match.id,
        href: matchHref(match),
        matchDate: match.matchDate,
        playerSlug: player.slug,
        playerName: player.name,
        playerImageUrl: player.profileImageUrl,
        position: player.position,
        teamShortName: team?.shortName ?? "",
        teamLogoUrl: team?.logoUrl ?? null,
        teamPrimaryColor: team?.primaryColor ?? null,
        opponentShortName: teamsById.get(opponentId)?.shortName ?? "",
        tournamentName: tournamentNamesById.get(match.tournamentId) ?? "",
        scoreLabel,
      });
    }

    // 캐시에는 원본 행이 아니라 위에서 추린 10건만 담는다(unstable_cache 2MB 한도).
    return entries;
  },
  ["home-pom-entries"],
  { revalidate: 300, tags: [HOME_POM_TAG] },
);
