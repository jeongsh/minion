import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  activeFavoriteTeamCooldown,
  nextFavoriteTeamChangeAvailableAt,
} from '../../lib/fan/favorite-team-cooldown';

const FAVORITE_TEAM_CHANGE_AVAILABLE_AT_KEY = 'minion-favorite-team-change-available-at';

export async function getLocalFavoriteTeamCooldown(): Promise<string | null> {
  return activeFavoriteTeamCooldown(await AsyncStorage.getItem(FAVORITE_TEAM_CHANGE_AVAILABLE_AT_KEY));
}

export async function recordLocalFavoriteTeamChange(): Promise<void> {
  await AsyncStorage.setItem(FAVORITE_TEAM_CHANGE_AVAILABLE_AT_KEY, nextFavoriteTeamChangeAvailableAt());
}
