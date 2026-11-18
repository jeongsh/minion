import { Image } from 'expo-image';
import Heart from 'lucide-react-native/icons/heart';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { minionTeams } from '@/constants/teams';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { useAuth } from '@/providers/auth-provider';

const teamsByName = [...minionTeams].sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function TeamPickerSheet() {
  const router = useRouter();
  const { favoriteTeam, fonts, setTeamPickerOpen, teamPickerOpen, theme } = useMinionTheme();
  const { viewer } = useAuth();
  const followedIds = new Set(viewer?.followedTeamIds ?? []);
  const isFollowing = (team: (typeof minionTeams)[number]) => followedIds.has(team.id) || followedIds.has(team.slug);
  const teams = [
    ...(favoriteTeam ? [favoriteTeam] : []),
    ...teamsByName.filter((team) => team.id !== favoriteTeam?.id && isFollowing(team)),
    ...teamsByName.filter((team) => team.id !== favoriteTeam?.id && !isFollowing(team)),
  ];

  return (
    <BottomSheet onClose={() => setTeamPickerOpen(false)} open={teamPickerOpen} title="팀">
      <View style={styles.grid}>
        {teams.map((team) => {
          const following = isFollowing(team);
          return (
            <Pressable
              accessibilityLabel={`${team.name}${following ? ' (팔로잉)' : ''} 팬페이지로 이동`}
              accessibilityRole="link"
              key={team.id}
              onPress={() => {
                setTeamPickerOpen(false);
                router.navigate(`/fan/${team.slug}`);
              }}
              style={({ pressed }) => [styles.team, { backgroundColor: pressed ? theme.cardHover : 'transparent' }]}>
              <View style={[styles.logoRing, { borderColor: following ? theme.accent : theme.border }]}>
                <View style={styles.logoCircle}>
                  <Image contentFit="contain" source={team.logo} style={styles.logo} />
                </View>
                {following ? <View style={[styles.following, { backgroundColor: theme.accent }]}><Heart size={9} color={theme.accentForeground} fill={theme.accentForeground} strokeWidth={0} /></View> : null}
              </View>
              <Text numberOfLines={1} style={[styles.teamName, { color: theme.ink, ...fonts.medium }]}>{team.shortName}</Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 4, rowGap: 8 },
  team: { alignItems: 'center', borderRadius: 12, gap: 4, justifyContent: 'center', minHeight: 64, paddingHorizontal: 4, paddingVertical: 6, flexBasis: '18%', flexGrow: 1, maxWidth: '20%' },
  logoRing: { alignItems: 'center', borderRadius: 24, borderWidth: 2, height: 48, justifyContent: 'center', width: 48, marginVertical: -4 },
  logoCircle: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  logo: { height: 32, width: 32 },
  following: { alignItems: 'center', borderRadius: 8, bottom: -2, height: 16, justifyContent: 'center', position: 'absolute', right: -2, width: 16 },
  teamName: { fontSize: 13, lineHeight: 19.5, maxWidth: '100%' },
});
