import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MobileMeDto, MobileTeamFavoriteDto } from '../../packages/contracts/src/mobile-v1';
import { nicknameFromKey } from '../../lib/community/guest-nickname';
import { BottomSheet } from '@/components/bottom-sheet';
import { RankAvatar } from '@/components/rank-avatar';
import { minionTeams } from '@/constants/teams';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mutateMobileApi, uploadMobileApi } from '@/lib/api-client';
import { getInstallationId } from '@/lib/secure-storage';
import { useAuth } from '@/providers/auth-provider';

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function safeNext(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.startsWith('/favorite-team') ? value : '/me';
}

function imageMimeType(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType;
  const extension = (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return null;
}

export default function FavoriteTeamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { fonts, setFavoriteTeam, theme } = useMinionTheme();
  const { loading, refreshViewer, session, viewer } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState('');
  const [nicknameReady, setNicknameReady] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const next = safeNext(typeof params.next === 'string' ? params.next : undefined);
  const initials = useMemo(() => nickname.trim().slice(0, 2).toUpperCase() || 'MY', [nickname]);
  const profileImageUrl = selectedImage?.uri ?? viewer?.profileImage?.url ?? null;

  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent('/favorite-team')}` as never);
  }, [loading, router, session]);

  useEffect(() => {
    if (!session || nicknameReady) return;
    let active = true;
    void getInstallationId()
      .then((installationId) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, installationId))
      .then((key) => {
        if (!active) return;
        setNickname(nicknameFromKey(key));
        setNicknameReady(true);
      })
      .catch(() => {
        if (!active) return;
        setNickname('MINION팬');
        setNicknameReady(true);
      });
    return () => {
      active = false;
    };
  }, [nicknameReady, session]);

  const pickImage = async () => {
    Keyboard.dismiss();
    const picked = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: ['images'], quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const mimeType = imageMimeType(asset);
    if (!mimeType || !PROFILE_IMAGE_TYPES.has(mimeType)) {
      setProfileError('프로필 이미지는 PNG, JPG, WEBP만 업로드할 수 있습니다.');
      return;
    }
    if ((asset.fileSize ?? 0) > MAX_PROFILE_IMAGE_BYTES) {
      setProfileError('프로필 이미지는 5MB 이하만 업로드할 수 있습니다.');
      return;
    }
    setSelectedImage({ ...asset, mimeType });
    setProfileError(null);
  };

  const saveProfile = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 16 || profilePending) return;
    Keyboard.dismiss();
    setProfilePending(true);
    setProfileError(null);
    try {
      const formData = new FormData();
      formData.append('nickname', trimmed);
      if (selectedImage) {
        formData.append('profileImage', selectedImage.file ?? ({
          name: selectedImage.fileName ?? `profile-${Date.now()}.jpg`,
          type: selectedImage.mimeType ?? 'image/jpeg',
          uri: selectedImage.uri,
        } as never));
      }
      await uploadMobileApi<MobileMeDto>('/api/mobile/v1/me', formData);
      await refreshViewer();
      setStep(2);
    } catch (caught) {
      setProfileError(caught instanceof Error ? caught.message : '프로필을 저장하지 못했습니다. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setProfilePending(false);
    }
  };

  const completeOnboarding = async (teamId?: string) => {
    if (pendingTeamId) return;
    const team = teamId ? minionTeams.find((candidate) => candidate.id === teamId) : null;
    setPendingTeamId(team?.id ?? 'skip');
    setTeamError(null);
    try {
      if (team) {
        await mutateMobileApi<MobileTeamFavoriteDto>(`/api/mobile/v1/teams/${encodeURIComponent(team.slug)}/favorite`, 'POST', { favorite: true });
        setFavoriteTeam(team);
      }
      await mutateMobileApi<MobileMeDto>('/api/mobile/v1/me', 'PATCH', { onboardingComplete: true });
      await refreshViewer();
      router.replace(next as never);
    } catch (caught) {
      setTeamError(caught instanceof Error ? caught.message : '온보딩을 완료하지 못했습니다. 잠시 뒤 다시 시도해주세요.');
      setPendingTeamId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBackground }]}>
      <BottomSheet dismissible={false} maxHeight="92%" onClose={() => undefined} open={!loading && Boolean(session)} scrollable title={step === 1 ? '프로필 설정' : '최애팀 선택'}>
        <View style={styles.stepHeader}>
          <Text style={[styles.stepText, { color: theme.muted, ...fonts.medium }]}>{step} / 2</Text>
        </View>
        <View accessibilityLabel={`온보딩 ${step}/2단계`} style={styles.progressRow}>
          <View style={[styles.progressSegment, { backgroundColor: theme.accent }]} />
          <View style={[styles.progressSegment, { backgroundColor: step === 2 ? theme.accent : theme.border }]} />
        </View>

        {step === 1 ? (
          <View style={styles.profileContent}>
            <Text style={[styles.title, { color: theme.ink, ...fonts.display }]}>MINION에서 사용할 이름</Text>
            <Pressable accessibilityLabel="프로필 사진 선택" accessibilityRole="button" disabled={profilePending} onPress={() => void pickImage()} style={styles.avatarButton}>
              <RankAvatar fallback={initials} profileImageUrl={profileImageUrl} reserveMedalSpace size="mobile" tier={viewer?.tier ?? 'bronze'} />
              <View style={[styles.cameraButton, { backgroundColor: theme.ink, borderColor: theme.surface }]}><Camera color={theme.surface} size={14} /></View>
            </Pressable>

            <View style={styles.field}>
              <View style={styles.fieldHeader}>
                <Text style={[styles.label, { color: theme.ink, ...fonts.medium }]}>닉네임</Text>
                <Text style={[styles.count, { color: theme.muted, ...fonts.regular }]}>{nickname.length} / 16</Text>
              </View>
              <TextInput
                accessibilityLabel="닉네임"
                editable={!profilePending}
                maxLength={16}
                onChangeText={(value) => { setNickname(value); setProfileError(null); }}
                onSubmitEditing={Keyboard.dismiss}
                placeholder="닉네임을 입력해주세요"
                placeholderTextColor={theme.muted}
                returnKeyType="done"
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.ink, ...fonts.regular }]}
                value={nickname}
              />
              <Text style={[styles.hint, { color: theme.muted, ...fonts.regular }]}>2~16자 · 중복 닉네임은 사용할 수 없어요.</Text>
            </View>

            {profileError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{profileError}</Text> : null}
            <Pressable disabled={profilePending || nickname.trim().length < 2} onPress={() => void saveProfile()} style={[styles.primary, { backgroundColor: theme.accent, opacity: profilePending || nickname.trim().length < 2 ? 0.45 : 1 }]}>
              {profilePending ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={[styles.primaryText, { color: theme.accentForeground, ...fonts.medium }]}>계속하기</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.teamContent}>
            <Text style={[styles.title, { color: theme.ink, ...fonts.display }]}>응원할 팀을 골라주세요</Text>
            <Text style={[styles.description, { color: theme.muted, ...fonts.regular }]}>최애팀 소식과 팬페이지를 더 빠르게 만날 수 있어요. 아직 없다면 건너뛰어도 괜찮아요.</Text>

            <View accessibilityLabel="최애팀 선택" style={styles.grid}>
              {minionTeams.map((team) => {
                const pending = pendingTeamId === team.id;
                const selected = selectedTeamId === team.id;
                return (
                  <Pressable
                    accessibilityLabel={`${team.name}을 최애팀으로 선택`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={Boolean(pendingTeamId)}
                    key={team.id}
                    onPress={() => setSelectedTeamId(team.id)}
                    style={({ pressed }) => [styles.team, { backgroundColor: selected || pressed ? theme.cardHover : theme.surface, borderColor: selected ? theme.accent : theme.border, opacity: pendingTeamId && !pending ? 0.55 : 1 }]}
                  >
                    <View style={styles.logoCircle}><Image contentFit="contain" source={team.logo} style={styles.logo} /></View>
                    <Text numberOfLines={1} style={[styles.teamName, { color: theme.ink, ...fonts.medium }]}>{team.shortName}</Text>
                    <View style={[styles.check, { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accent : theme.surface }]}>
                      {pending ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Check color={selected ? theme.accentForeground : 'transparent'} size={13} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {teamError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{teamError}</Text> : null}
            <View style={styles.actions}>
              <Pressable disabled={Boolean(pendingTeamId)} onPress={() => void completeOnboarding()} style={({ pressed }) => [styles.skip, { backgroundColor: pressed ? theme.cardHover : 'transparent', opacity: pendingTeamId ? 0.5 : 1 }]}>
                <Text style={[styles.skipText, { color: theme.muted, ...fonts.medium }]}>{pendingTeamId === 'skip' ? '완료 중…' : '건너뛰기'}</Text>
              </Pressable>
              <Pressable disabled={!selectedTeamId || Boolean(pendingTeamId)} onPress={() => void completeOnboarding(selectedTeamId ?? undefined)} style={[styles.apply, { backgroundColor: theme.accent, opacity: selectedTeamId && !pendingTeamId ? 1 : 0.45 }]}>
                {pendingTeamId && pendingTeamId !== 'skip' ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={[styles.primaryText, { color: theme.accentForeground, ...fonts.medium }]}>선택한 팀 적용</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stepHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' },
  stepText: { fontSize: 13, lineHeight: 18 },
  progressRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  progressSegment: { borderRadius: 999, flex: 1, height: 4 },
  profileContent: { paddingTop: 16 },
  teamContent: { paddingTop: 16 },
  title: { fontSize: 20, lineHeight: 28, textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 24, marginTop: 8, textAlign: 'center' },
  avatarButton: { alignItems: 'center', alignSelf: 'center', marginTop: 16, position: 'relative' },
  cameraButton: { alignItems: 'center', borderRadius: 14, borderWidth: 2, height: 28, justifyContent: 'center', position: 'absolute', right: -5, top: -4, width: 28 },
  field: { gap: 8, marginTop: 20 },
  fieldHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, lineHeight: 20 },
  count: { fontSize: 13, lineHeight: 18 },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 16, height: 44, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 0 },
  hint: { fontSize: 13, lineHeight: 18 },
  error: { color: '#dc2626', fontSize: 14, lineHeight: 20, marginTop: 12, textAlign: 'center' },
  primary: { alignItems: 'center', borderRadius: 12, height: 44, justifyContent: 'center', marginTop: 16, width: '100%' },
  primaryText: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  team: { alignItems: 'center', borderRadius: 12, borderWidth: 1, gap: 4, justifyContent: 'center', minHeight: 80, paddingHorizontal: 8, paddingVertical: 6, width: '48.8%' },
  logoCircle: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  logo: { height: 32, width: 32 },
  teamName: { fontSize: 14, lineHeight: 20, maxWidth: '100%' },
  check: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 24, justifyContent: 'center', position: 'absolute', right: 8, top: 8, width: 24 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  skip: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  skipText: { fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },
  apply: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 18 },
});
