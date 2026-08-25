import * as ImagePicker from 'expo-image-picker';
import ImageIcon from 'lucide-react-native/icons/image';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityUploadDto, TiptapDocument, TiptapNode } from '@/lib/api-client';
import { uploadMobileApi } from '@/lib/api-client';

type Props = { allowMedia: boolean; onChange: (document: TiptapDocument) => void; value: TiptapDocument };

function textFrom(document: TiptapDocument) {
  const read = (node: TiptapNode): string => node.type === 'text' ? node.text ?? '' : node.content?.map(read).join('') ?? '';
  return document.content?.map(read).join('\n') ?? '';
}

function docFrom(text: string): TiptapDocument {
  return { type: 'doc', content: text.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : undefined })) };
}

export function CommunityRichEditor({ allowMedia, onChange, value }: Props) {
  const { fonts, theme } = useMinionTheme();
  const [text, setText] = useState(() => textFrom(value));
  const media = useMemo(() => value.content?.filter((node) => node.type === 'image') ?? [], [value.content]);
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    try {
      const formData = new FormData();
      if (asset.file) formData.append('file', asset.file);
      else formData.append('file', { name: asset.fileName ?? 'community.jpg', type: asset.mimeType ?? 'image/jpeg', uri: asset.uri } as never);
      const upload = await uploadMobileApi<MobileCommunityUploadDto>('/api/mobile/v1/community/upload', formData);
      onChange({ ...docFrom(text), content: [...(docFrom(text).content ?? []), ...media, { type: 'image', attrs: { src: upload.url, width: upload.width, height: upload.height } }] });
    } catch (caught) { Alert.alert('이미지 첨부 실패', caught instanceof Error ? caught.message : '이미지를 업로드하지 못했습니다.'); }
  };
  return <View style={[styles.root, { borderColor: theme.border }]}><View style={[styles.toolbar, { borderBottomColor: theme.border }]}><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 13 }}>본문</Text>{allowMedia ? <Pressable accessibilityLabel="이미지 첨부" onPress={() => void pickImage()} style={styles.imageButton}><ImageIcon color={theme.text} size={19} /></Pressable> : null}</View><TextInput accessibilityLabel="내용" multiline onChangeText={(next) => { setText(next); onChange({ ...docFrom(next), content: [...(docFrom(next).content ?? []), ...media] }); }} placeholder="내용을 입력하세요" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, fontFamily: fonts.regular }]} textAlignVertical="top" value={text} /></View>;
}

const styles = StyleSheet.create({ root: { borderRadius: 8, borderWidth: 1, height: 390, overflow: 'hidden' }, toolbar: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 48, paddingHorizontal: 13 }, imageButton: { alignItems: 'center', height: 42, justifyContent: 'center', marginLeft: 'auto', width: 42 }, input: { flex: 1, fontSize: 16, lineHeight: 28, padding: 14 } });
