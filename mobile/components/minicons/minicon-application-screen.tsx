import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import Images from 'lucide-react-native/icons/images';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { KeyboardAwareView } from '@/components/keyboard-aware-view';
import { MiniconHeading, MiniconTabs } from '@/components/minicons/minicon-screens';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import {
  mutateMobileApi,
  resolveApiAssetUrl,
  uploadMobileApi,
  type MobileMiniconApplication,
  type MobileMiniconApplicationMutationDto,
  type MobileMiniconApplicationsDto,
  type MobileMiniconUploadDto,
} from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

const MIN_ITEMS = 10;
const MAX_ITEMS = 50;
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif']);

type UploadedMinicon = { name: string; receiptId: string };

function textLength(value: string) {
  return Array.from(value).length;
}

function mimeType(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType;
  const extension = (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return null;
}

function itemName(asset: ImagePicker.ImagePickerAsset, index: number) {
  const fileName = asset.fileName ?? `미니콘 ${index + 1}`;
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim();
  return Array.from(withoutExtension).slice(0, 20).join('') || `미니콘 ${index + 1}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

function statusMeta(status: string, theme: ReturnType<typeof useMinionTheme>['theme']) {
  switch (status) {
    case 'pending_review': return { label: '검토 중', color: '#ffd15c' };
    case 'published': return { label: '공개됨', color: theme.accent };
    case 'rejected': return { label: '반려됨', color: '#ff5c5c' };
    case 'retired': return { label: '공개 종료', color: theme.muted };
    case 'suspended': return { label: '이용 중지', color: '#ff5c5c' };
    default: return { label: '작성 중', color: '#5b8cff' };
  }
}

export function MiniconApplicationScreen() {
  const { loading: authLoading, session } = useAuth();
  const { data, error, loading, refresh } = useCachedQuery<MobileMiniconApplicationsDto>('/api/mobile/v1/minicons/applications', { cache: false, enabled: Boolean(session) });
  return <KeyboardAwareView style={styles.flex}><MinionScreen contentStyle={styles.screen}>
    <MiniconHeading />
    <MiniconTabs active="apply" />
    {authLoading || (loading && !data) ? <View style={styles.loading}><ActivityIndicator /></View>
      : !session ? <LoginRequired />
        : error && !data ? <ErrorState onRetry={refresh} title={error} />
          : data ? <ApplicationContent data={data} refresh={refresh} /> : null}
  </MinionScreen></KeyboardAwareView>;
}

function LoginRequired() {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return <View style={[styles.empty, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>로그인 후 미니콘을 신청할 수 있습니다.</Text><View style={styles.loginActions}><Pressable onPress={() => router.push('/login?next=/minicons/apply' as never)} style={[styles.loginAction, { backgroundColor: theme.ink }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>로그인</Text></Pressable><Pressable onPress={() => router.push('/signup' as never)} style={[styles.loginAction, { borderColor: theme.border, borderWidth: 1 }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>회원가입</Text></Pressable></View></View>;
}

function ApplicationContent({ data, refresh }: { data: MobileMiniconApplicationsDto; refresh: () => void }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const atLimit = data.pendingApplicationCount >= data.maxPendingApplications;

  const chooseFiles = async () => {
    if (pending) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      orderedSelection: true,
      quality: 1,
      selectionLimit: MAX_ITEMS,
    });
    if (result.canceled) return;
    setAssets(result.assets);
  };

  const cleanup = async (uploaded: UploadedMinicon[]) => {
    if (uploaded.length === 0) return;
    await mutateMobileApi('/api/mobile/v1/minicons/applications', 'DELETE', { receiptIds: uploaded.map((item) => item.receiptId) }).catch(() => undefined);
  };

  const upload = async (asset: ImagePicker.ImagePickerAsset, index: number) => {
    const type = mimeType(asset);
    if (!type) throw new Error(`${asset.fileName ?? `파일 ${index + 1}`}: JPG·PNG·GIF 형식만 등록할 수 있습니다.`);
    const formData = new FormData();
    formData.append('file', asset.file ?? ({ name: asset.fileName ?? `minicon-${index + 1}.${type.split('/')[1]}`, type, uri: asset.uri } as never));
    const result = await uploadMobileApi<MobileMiniconUploadDto>('/api/mobile/v1/minicons/upload', formData);
    return { name: itemName(asset, index), receiptId: result.receiptId };
  };

  const submit = async () => {
    if (pending) return;
    if (atLimit) { showToast('검토 중인 신청이 끝난 뒤 새 미니콘을 신청할 수 있습니다.', 'info'); return; }
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (textLength(trimmedName) < 1 || textLength(trimmedName) > 30) { showToast('패키지 이름은 1~30자로 입력하세요.', 'error'); return; }
    if (textLength(trimmedDescription) > 300) { showToast('설명은 300자까지 입력할 수 있습니다.', 'error'); return; }
    if (!rightsConfirmed) { showToast('등록·배포할 권리가 있는 이미지인지 확인해 주세요.', 'error'); return; }
    if (assets.length < MIN_ITEMS || assets.length > MAX_ITEMS) { showToast(`200×200 미니콘을 ${MIN_ITEMS}~${MAX_ITEMS}개 선택하세요.`, 'error'); return; }
    const invalid = assets.find((asset) => !mimeType(asset) || !ALLOWED_TYPES.has(mimeType(asset)!) || (asset.fileSize ?? 0) <= 0 || (asset.fileSize ?? 0) > MAX_BYTES || asset.width !== 200 || asset.height !== 200);
    if (invalid) { showToast(`${invalid.fileName ?? '선택한 파일'}: 200×200px JPG·PNG·GIF, 파일당 2MB 이하만 등록할 수 있습니다.`, 'error'); return; }
    setPending(true);
    setProgress(0);
    const uploaded: UploadedMinicon[] = [];
    try {
      for (let start = 0; start < assets.length; start += 4) {
        const results = await Promise.allSettled(assets.slice(start, start + 4).map((asset, offset) => upload(asset, start + offset)));
        for (const result of results) if (result.status === 'fulfilled') uploaded.push(result.value);
        setProgress(uploaded.length);
        const rejected = results.find((result) => result.status === 'rejected');
        if (rejected?.status === 'rejected') throw rejected.reason;
      }
      const result = await mutateMobileApi<MobileMiniconApplicationMutationDto>('/api/mobile/v1/minicons/applications', 'POST', { name: trimmedName, description: trimmedDescription, rightsConfirmed: true, items: uploaded });
      showToast(result.message, 'success');
      setName(''); setDescription(''); setAssets([]); setRightsConfirmed(false); setProgress(0);
      refresh();
    } catch (caught) {
      await cleanup(uploaded);
      showToast(caught instanceof Error ? caught.message : '미니콘 파일을 업로드하지 못했습니다.', 'error');
    } finally { setPending(false); }
  };

  return <View>
    <Text style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 28, marginTop: 24 }}>새 미니콘 신청</Text>
    <View style={[styles.form, { backgroundColor: theme.surface }]}>
      <FieldLabel label="패키지 이름"><TextInput editable={!pending} maxLength={30} onChangeText={setName} placeholder="예: 우리 팀 승리 요정" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text, ...fonts.regular }]} value={name} /></FieldLabel>
      <FieldLabel label="패키지 설명"><TextInput editable={!pending} maxLength={300} multiline onChangeText={setDescription} placeholder="미니콘의 캐릭터와 콘셉트를 소개해 주세요." placeholderTextColor={theme.muted} style={[styles.input, styles.description, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text, ...fonts.regular }]} textAlignVertical="top" value={description} /></FieldLabel>
      <FieldLabel label="미니콘 파일"><Pressable disabled={pending} onPress={() => void chooseFiles()} style={[styles.fileButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}><Images color={theme.ink} size={18} /><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>{assets.length > 0 ? '파일 다시 선택' : '파일 선택'}</Text></Pressable><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>200×200px · JPG·PNG·GIF · 개당 2MB 이하 · 10~50개 · 첫 파일이 대표 이미지</Text></FieldLabel>
      {assets.length > 0 ? <View style={[styles.selection, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>선택한 파일 {assets.length}개</Text><Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20, marginTop: 4 }}>{assets.slice(0, 8).map((asset) => asset.fileName ?? '미니콘').join(', ')}{assets.length > 8 ? ` 외 ${assets.length - 8}개` : ''}</Text></View> : null}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rightsConfirmed }} disabled={pending} onPress={() => setRightsConfirmed((value) => !value)} style={[styles.rights, { borderColor: theme.border }]}><View style={[styles.checkbox, { backgroundColor: rightsConfirmed ? theme.accent : 'transparent', borderColor: rightsConfirmed ? theme.accent : theme.border }]}>{rightsConfirmed ? <Check color={theme.accentForeground} size={14} strokeWidth={2.5} /> : null}</View><Text style={{ color: theme.text, ...fonts.regular, flex: 1, fontSize: 16, lineHeight: 24 }}>본인이 제작했거나 등록·배포 권한을 보유한 이미지만 신청하며, 저작권·상표권·초상권 침해 시 반려되거나 이용이 중지될 수 있음을 확인합니다.</Text></Pressable>
      <View style={styles.submitRow}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>검토 중 {data.pendingApplicationCount}/{data.maxPendingApplications}건</Text><Pressable disabled={pending || atLimit} onPress={() => void submit()} style={[styles.submit, { backgroundColor: theme.ink, opacity: pending || atLimit ? 0.5 : 1 }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>{pending ? `업로드 중 ${progress}/${assets.length}` : atLimit ? '검토 대기 한도 도달' : '미니콘 검토 신청'}</Text></Pressable></View>
    </View>
    <View style={styles.historyHead}><Text style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 28 }}>내 신청 내역</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>총 {data.applications.length}건</Text></View>
    {data.applications.length > 0 ? <View style={styles.history}>{data.applications.map((application) => <ApplicationCard application={application} key={application.id} />)}</View> : <View style={[styles.historyEmpty, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24 }}>아직 신청한 미니콘이 없습니다.</Text></View>}
  </View>;
}

function FieldLabel({ children, label }: { children: React.ReactNode; label: string }) { const { fonts, theme } = useMinionTheme(); return <View style={styles.field}><Text style={{ color: theme.text, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>{label}</Text>{children}</View>; }

function ApplicationCard({ application }: { application: MobileMiniconApplication }) {
  const { fonts, theme } = useMinionTheme();
  const status = statusMeta(application.status, theme);
  return <View style={[styles.application, { backgroundColor: theme.surface }]}><View style={styles.applicationRow}><Image accessibilityLabel="" alt="" contentFit="cover" source={{ uri: resolveApiAssetUrl(application.coverUrl) ?? application.coverUrl }} style={[styles.cover, { backgroundColor: theme.surfaceMuted }]} /><View style={styles.applicationCopy}><View style={styles.applicationTitleRow}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, flexShrink: 1, fontSize: 16, lineHeight: 24 }}>{application.name}</Text><View style={[styles.status, { backgroundColor: theme.surfaceMuted }]}><View style={[styles.statusDot, { backgroundColor: status.color }]} /><Text style={{ color: theme.text, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{status.label}</Text></View></View><Text numberOfLines={2} style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 8 }}>{application.description || '설명 없이 신청한 미니콘 패키지입니다.'}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20, marginTop: 12 }}>미니콘 {application.itemCount}개 · {formatDate(application.submittedAt)} 신청{application.reviewedAt ? ` · ${formatDate(application.reviewedAt)} 처리` : ''}</Text></View></View>{application.reviewNote ? <View style={[styles.reviewNote, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>심사 안내</Text><Text style={{ color: theme.text, ...fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 4 }}>{application.reviewNote}</Text></View> : null}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { paddingBottom: 96 }, loading: { alignItems: 'center', minHeight: 240, justifyContent: 'center' }, empty: { alignItems: 'center', borderRadius: 8, marginTop: 20, padding: 20 }, loginActions: { flexDirection: 'row', gap: 8, marginTop: 16 }, loginAction: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 44, paddingHorizontal: 20 },
  form: { borderRadius: 8, gap: 16, marginTop: 12, padding: 12 }, field: { gap: 8 }, input: { borderRadius: 8, borderWidth: 1, fontSize: 16, height: 44, lineHeight: 24, paddingHorizontal: 12, paddingVertical: 0 }, description: { height: 88, paddingVertical: 10 },
  fileButton: { alignItems: 'center', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 48, paddingHorizontal: 12 }, selection: { borderRadius: 12, padding: 12 },
  rights: { alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 }, checkbox: { alignItems: 'center', borderRadius: 3, borderWidth: 1, height: 18, justifyContent: 'center', marginTop: 3, width: 18 },
  submitRow: { alignItems: 'stretch', gap: 12 }, submit: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', paddingHorizontal: 20 }, historyHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 }, history: { gap: 12, marginTop: 16 }, historyEmpty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, marginTop: 16, padding: 48 },
  application: { borderRadius: 8, padding: 12 }, applicationRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 16 }, cover: { borderRadius: 16, height: 80, width: 80 }, applicationCopy: { flex: 1, minWidth: 0 }, applicationTitleRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, status: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 4 }, statusDot: { borderRadius: 4, height: 8, width: 8 }, reviewNote: { borderRadius: 12, marginTop: 16, padding: 16 },
});
