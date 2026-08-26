import * as ImagePicker from 'expo-image-picker';
import Camera from 'lucide-react-native/icons/camera';
import UserRound from 'lucide-react-native/icons/user-round';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MobileMeDto } from '../../../packages/contracts/src/mobile-v1';
import { useMinionTheme } from '@/hooks/use-minion-theme';

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function ProfileForm({
  initialProfile,
  onSave,
}: {
  initialProfile: MobileMeDto['profile'];
  onSave: (formData: FormData) => Promise<MobileMeDto>;
}) {
  const { fonts, theme } = useMinionTheme();
  const [nickname, setNickname] = useState(initialProfile.nickname ?? '');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ status: 'error' | 'success'; message: string } | null>(null);
  const pickImage = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: ['images'], quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if (!asset.mimeType || !PROFILE_IMAGE_TYPES.has(asset.mimeType)) {
      setResult({ status: 'error', message: '프로필 이미지는 PNG, JPG, WEBP만 업로드할 수 있습니다.' });
      return;
    }
    if ((asset.fileSize ?? 0) > MAX_PROFILE_IMAGE_BYTES) {
      setResult({ status: 'error', message: '프로필 이미지는 5MB 이하만 업로드할 수 있습니다.' });
      return;
    }
    setSelectedImage(asset);
    setResult(null);
  };

  const submit = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setResult({ status: 'error', message: '닉네임은 2~16자로 입력해주세요.' });
      return;
    }
    setPending(true);
    setResult(null);
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
      const next = await onSave(formData);
      setNickname(next.profile.nickname ?? '');
      setSelectedImage(null);
      setResult({ status: 'success', message: '프로필이 저장되었습니다.' });
    } catch (error) {
      setResult({ status: 'error', message: error instanceof Error ? error.message : '프로필 변경에 실패했습니다.' });
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.headingRow}>
        <View style={[styles.headingIcon, { backgroundColor: theme.surfaceMuted }]}><UserRound color={theme.muted} size={16} /></View>
        <View style={styles.headingCopy}>
          <Text style={[styles.heading, { color: theme.ink, ...fonts.black }]}>프로필</Text>
          <Text style={[styles.description, { color: theme.muted, ...fonts.medium }]}>닉네임과 프로필 이미지를 변경합니다.</Text>
        </View>
      </View>

      <View style={styles.form}>
        <View style={styles.imageActions}>
            <Pressable accessibilityRole="button" disabled={pending} hitSlop={4} onPress={() => void pickImage()} style={[styles.imageButton, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Camera color={theme.ink} size={14} />
              <Text style={[styles.imageButtonText, { color: theme.ink, ...fonts.medium }]}>프로필 이미지 변경</Text>
            </Pressable>
            <Text style={[styles.imageHint, { color: theme.muted, ...fonts.medium }]}>PNG, JPG, WEBP · 최대 5MB</Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.ink, ...fonts.medium }]}>닉네임</Text>
          <TextInput accessibilityLabel="닉네임" editable={!pending} maxLength={16} onChangeText={(value) => { setNickname(value); setResult(null); }} style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.ink, ...fonts.regular }]} value={nickname} />
          <Text style={[styles.nicknameHint, { color: theme.muted, ...fonts.regular }]}>2~16자, 다른 사용자와 중복될 수 없습니다.</Text>
        </View>

        {result ? <Text accessibilityLiveRegion="polite" style={[styles.result, { color: result.status === 'error' ? '#dc2626' : '#16a34a', ...fonts.regular }]}>{result.message}</Text> : null}

        <Pressable accessibilityRole="button" disabled={pending} hitSlop={4} onPress={() => void submit()} style={[styles.submit, { backgroundColor: theme.accent, opacity: pending ? 0.65 : 1 }]}>
          {pending ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={[styles.submitText, { color: theme.accentForeground, ...fonts.medium }]}>프로필 저장</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 12 },
  headingIcon: { alignItems: 'center', borderRadius: 8, height: 30, justifyContent: 'center', width: 30 },
  headingCopy: { flex: 1, minWidth: 0 },
  heading: { fontSize: 15, letterSpacing: -0.3, lineHeight: 22 },
  description: { fontSize: 13, lineHeight: 18 },
  form: { gap: 12 },
  imageActions: { minWidth: 0 },
  imageButton: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 5, height: 36, paddingHorizontal: 10 },
  imageButtonText: { fontSize: 13, lineHeight: 18 },
  imageHint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  field: { gap: 4 },
  label: { fontSize: 13, lineHeight: 18 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 13, height: 36, lineHeight: 18, paddingHorizontal: 10, paddingVertical: 0 },
  nicknameHint: { fontSize: 13, lineHeight: 18 },
  result: { fontSize: 13, lineHeight: 18 },
  submit: { alignItems: 'center', borderRadius: 8, height: 36, justifyContent: 'center', width: '100%' },
  submitText: { fontSize: 13, lineHeight: 18 },
});
