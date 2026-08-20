import { Image } from 'expo-image';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { minionTeams } from '@/constants/teams';
import { useMinionTheme } from '@/hooks/use-minion-theme';

export function TeamPickerSheet() {
  const router = useRouter();
  const { fonts, setTeamPickerOpen, teamPickerOpen, theme } = useMinionTheme();

  return (
    <BottomSheet onClose={() => setTeamPickerOpen(false)} open={teamPickerOpen} title="팬페이지 바로가기">
      <ScrollView contentContainerStyle={styles.grid}>
        {minionTeams.map((team) => (
          <Pressable
            accessibilityLabel={`${team.name} 팬페이지로 이동`}
            key={team.id}
            onPress={() => {
              setTeamPickerOpen(false);
              router.navigate(`/fan/${team.slug}`);
            }}
            style={({ pressed }) => [styles.team, { backgroundColor: pressed ? theme.cardHover : 'transparent' }]}>
            <View style={[styles.logoCircle, { backgroundColor: '#ffffff', borderColor: theme.border }]}>
              <Image contentFit="contain" source={team.logo} style={styles.logo} />
            </View>
            <Text numberOfLines={1} style={[styles.teamName, { color: theme.ink, fontFamily: fonts.medium }]}>{team.shortName}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable onPress={() => { setTeamPickerOpen(false); router.navigate('/teams'); }} style={[styles.allTeams, { borderTopColor: theme.divider }]}>
        <Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 14 }}>소셜과 영상까지 둘러보기</Text>
        <ChevronRight color={theme.muted} size={17} />
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 },
  team: { alignItems: 'center', borderRadius: 12, gap: 5, paddingHorizontal: 2, paddingVertical: 8, width: '20%' },
  logoCircle: { alignItems: 'center', borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  logo: { height: 34, width: 34 },
  teamName: { fontSize: 13, maxWidth: '100%' },
  allTeams: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'center', minHeight: 48 },
});
