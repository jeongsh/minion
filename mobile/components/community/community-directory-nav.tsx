import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MobileTeamsPageDto } from '@/lib/api-client';
import { minionTeams } from '@/constants/teams';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { useAuth } from '@/providers/auth-provider';

import type { CommunityScope } from './community-utils';

const LCK_LOGO = require('@/assets/images/lck.svg');
const LCK_LOGO_DARK = require('@/assets/images/lck-dark.svg');

export function CommunityDirectoryNav({
  accent,
  scope,
  teamSlug,
}: {
  accent: string;
  scope: CommunityScope;
  teamSlug?: string;
}) {
  const router = useRouter();
  const { viewer } = useAuth();
  const { colorScheme, favoriteTeam, theme } = useMinionTheme();
  const { data } = useCachedQuery<MobileTeamsPageDto>('/api/mobile/v1/teams?view=directory', {
    cache: false,
  });
  const orderedTeams = useMemo(() => {
    const apiBySlug = new Map(data?.items.map((team) => [team.slug, team]) ?? []);
    const followedIds = new Set(data?.followedTeamIds ?? []);
    const favoriteSlug = viewer ? viewer.favoriteTeamSlug : favoriteTeam?.slug ?? null;

    return minionTeams
      .map((team, index) => {
        const apiTeam = apiBySlug.get(team.slug);
        const priority = team.slug === favoriteSlug ? 0 : apiTeam && followedIds.has(apiTeam.id) ? 1 : 2;
        return { apiTeam, index, priority, team };
      })
      .sort((a, b) => a.priority - b.priority || a.index - b.index);
  }, [data?.followedTeamIds, data?.items, favoriteTeam?.slug, viewer?.favoriteTeamSlug]);

  return (
    <View
      accessibilityLabel="다른 커뮤니티로 이동"
      style={[
        styles.directory,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          borderTopColor: theme.border,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.links}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <CommunityLink
          accessibilityLabel="LCK 커뮤니티로 이동"
          active={scope === 'hub'}
          accent={accent}
          icon={
            <Image
              contentFit="contain"
              source={colorScheme === 'dark' ? LCK_LOGO_DARK : LCK_LOGO}
              style={styles.teamLogo}
            />
          }
          label="LCK"
          onPress={() => router.navigate('/community' as never)}
        />

        {orderedTeams.map(({ apiTeam, team }) => {
          const routeSlug = apiTeam?.fanSiteHost || team.slug;
          const active = scope === 'team' && (team.slug === teamSlug || routeSlug === teamSlug);
          return (
            <CommunityLink
              accessibilityLabel={`${apiTeam?.name ?? team.name} 팬 커뮤니티로 이동`}
              active={active}
              accent={accent}
              icon={<Image contentFit="contain" source={team.logo} style={styles.teamLogo} />}
              key={team.id}
              label={apiTeam?.shortName ?? team.shortName}
              onPress={() => router.navigate(`/fan/${routeSlug}/community` as never)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function CommunityLink({
  accessibilityLabel,
  active,
  accent,
  icon,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  active: boolean;
  accent: string;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const { fonts, theme } = useMinionTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        {
          backgroundColor: active ? theme.surface : theme.surfaceMuted,
          borderColor: active ? accent : 'transparent',
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: active ? theme.ink : theme.text, ...fonts.medium }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  directory: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    marginBottom: 16,
    paddingVertical: 10,
  },
  label: { fontSize: 13, lineHeight: 19.5 },
  link: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 36,
    paddingHorizontal: 8,
  },
  links: { gap: 4, paddingHorizontal: 12 },
  teamLogo: { height: 20, width: 20 },
});
