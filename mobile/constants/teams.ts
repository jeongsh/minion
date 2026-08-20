import type { ImageSource } from 'expo-image';

export type MinionTeam = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  primaryColor: string;
  logo: ImageSource;
};

export const minionTeams: MinionTeam[] = [
  { id: 'team_t1', slug: 't1', name: 'T1', shortName: 'T1', primaryColor: '#e4002b', logo: require('@/assets/teams/t1.png') },
  { id: 'team_geng', slug: 'geng', name: 'Gen.G', shortName: 'GEN', primaryColor: '#aa8a00', logo: require('@/assets/teams/geng.png') },
  { id: 'team_hle', slug: 'hle', name: '한화생명 이스포츠', shortName: 'HLE', primaryColor: '#f37321', logo: require('@/assets/teams/hle.png') },
  { id: 'team_dk', slug: 'dk', name: 'Dplus KIA', shortName: 'DK', primaryColor: '#4fd1c5', logo: require('@/assets/teams/dk.png') },
  { id: 'team_kt', slug: 'kt', name: 'KT 롤스터', shortName: 'KT', primaryColor: '#ed1c24', logo: require('@/assets/teams/kt.png') },
  { id: 'team_drx', slug: 'drx', name: 'KIWOOM DRX', shortName: 'KRX', primaryColor: '#5b6cff', logo: require('@/assets/teams/drx.png') },
  { id: 'team_ns', slug: 'ns', name: '농심 레드포스', shortName: 'NS', primaryColor: '#d71920', logo: require('@/assets/teams/ns.png') },
  { id: 'team_bro', slug: 'bro', name: '한진 브리온', shortName: 'BRO', primaryColor: '#004a29', logo: require('@/assets/teams/bro.png') },
  { id: 'team_fox', slug: 'fox', name: 'BNK 피어엑스', shortName: 'BFX', primaryColor: '#fed200', logo: require('@/assets/teams/fox.png') },
  { id: 'team_soop', slug: 'soop', name: 'DN 수퍼스', shortName: 'DNS', primaryColor: '#1a8cff', logo: require('@/assets/teams/soop.png') },
];

export function getMinionTeam(slug: string | undefined) {
  return minionTeams.find((team) => team.slug === slug) ?? null;
}
