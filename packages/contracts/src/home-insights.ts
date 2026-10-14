export type HomeInsights = {
  tournament: string;
  date: string;
  patches: string[];
  setCount: number;
  href: string;
  champions: { id: string; name: string; image: string; artwork: string; href: string; picks: number; bans: number; presence: number | null; winRate: number | null; games: number }[];
  builds: { id: string; player: string; playerImage: string; team: string; position: string; champion: string; image: string; artwork: string; matchup: string; date: string; setNumber: number; patch: string | null; won: boolean; href: string; items: { name: string; image: string }[] }[];
};
