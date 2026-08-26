import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import BarChart3 from 'lucide-react-native/icons/chart-column';
import Bold from 'lucide-react-native/icons/bold';
import Highlighter from 'lucide-react-native/icons/highlighter';
import ImageIcon from 'lucide-react-native/icons/image';
import Italic from 'lucide-react-native/icons/italic';
import List from 'lucide-react-native/icons/list';
import ListOrdered from 'lucide-react-native/icons/list-ordered';
import Plus from 'lucide-react-native/icons/plus';
import Redo from 'lucide-react-native/icons/redo';
import Share2 from 'lucide-react-native/icons/share-2';
import Strikethrough from 'lucide-react-native/icons/strikethrough';
import Type from 'lucide-react-native/icons/type';
import Underline from 'lucide-react-native/icons/underline';
import Undo from 'lucide-react-native/icons/undo';
import Video from 'lucide-react-native/icons/video';
import X from 'lucide-react-native/icons/x';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image as NativeImage, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityUploadDto, TiptapDocument, TiptapNode } from '@/lib/api-client';
import { uploadMobileApi } from '@/lib/api-client';

type Props = {
  allowEmbeds: boolean;
  allowMedia: boolean;
  characterCount: number;
  characterLimit: number;
  maxImages: number;
  onChange: (document: TiptapDocument) => void;
  value: TiptapDocument;
};

type LinkMode = 'youtube' | 'sns';
type PaletteMode = 'text' | 'highlight' | null;
type PollDraft = { id: string | null; options: { id: string; label: string }[]; question: string };

const MAX_POLL_OPTIONS = 6;
const EDITOR_FONT_URIS = {
  bold: NativeImage.resolveAssetSource(require('@/assets/fonts/Pretendard-Bold.ttf')).uri,
  medium: NativeImage.resolveAssetSource(require('@/assets/fonts/Pretendard-Medium.ttf')).uri,
  regular: NativeImage.resolveAssetSource(require('@/assets/fonts/Pretendard-Regular.ttf')).uri,
};

const IMAGE_ALIGNMENT_BUTTONS = '<button data-image-align="left"><b><i></i><i></i><i></i></b></button><button data-image-align="center"><b><i></i><i></i><i></i></b></button><button data-image-align="right"><b><i></i><i></i><i></i></b></button>';

function newId() {
  return Crypto.randomUUID();
}

function emptyPoll(): PollDraft {
  return { id: null, options: [{ id: newId(), label: '' }, { id: newId(), label: '' }], question: '' };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineHtml(node: TiptapNode): string {
  if (node.type === 'hardBreak') return '<br>';
  if (node.type !== 'text') return node.content?.map(inlineHtml).join('') ?? '';
  let output = escapeHtml(node.text ?? '');
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') output = `<strong>${output}</strong>`;
    if (mark.type === 'italic') output = `<em>${output}</em>`;
    if (mark.type === 'strike') output = `<s>${output}</s>`;
    if (mark.type === 'underline') output = `<u>${output}</u>`;
    if (mark.type === 'code') output = `<code>${output}</code>`;
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string') output = `<a href="${escapeHtml(mark.attrs.href)}">${output}</a>`;
    if (mark.type === 'textStyle') {
      const color = typeof mark.attrs?.color === 'string' ? `color:${mark.attrs.color};` : '';
      const fontSize = typeof mark.attrs?.fontSize === 'string' ? `font-size:${mark.attrs.fontSize};` : '';
      if (color || fontSize) output = `<span style="${color}${fontSize}">${output}</span>`;
    }
    if (mark.type === 'highlight' && typeof mark.attrs?.color === 'string') output = `<span style="background-color:${mark.attrs.color}">${output}</span>`;
  }
  return output;
}

function alignmentFrom(node: TiptapNode) {
  const wrapper = String(node.attrs?.wrapperStyle ?? '');
  if (wrapper.includes('center')) return 'center';
  if (wrapper.includes('flex-end')) return 'right';
  return 'left';
}

function imageHtml(node: TiptapNode) {
  const src = escapeHtml(String(node.attrs?.src ?? ''));
  const alt = escapeHtml(String(node.attrs?.alt ?? ''));
  const width = Math.max(80, Number(node.attrs?.width ?? 760) || 760);
  const align = alignmentFrom(node);
  return `<div class="image-shell" contenteditable="false" data-image-shell="true" data-align="${align}" data-width="${width}"><div class="image-frame"><div class="image-toolbar">${IMAGE_ALIGNMENT_BUTTONS}</div><img src="${src}" alt="${alt}" style="width:${width}px"><i class="resize-handle"></i></div></div>`;
}

function youtubeHtml(srcValue: string) {
  const src = escapeHtml(srcValue);
  return `<div class="media-block youtube-block" contenteditable="false" data-youtube-url="${src}"><iframe src="${src}" title="YouTube 영상" frameborder="0" allowfullscreen></iframe><p>YOU\u00b7TUBE</p></div>`;
}

function embedHtml(urlValue: string, typeValue: string) {
  const url = escapeHtml(urlValue);
  const type = escapeHtml(typeValue);
  const label = type === 'instagram' ? 'Instagram' : type === 'twitter' ? 'X 게시물' : 'SNS 게시물';
  return `<div class="media-block sns-block" contenteditable="false" data-embed-url="${url}" data-embed-type="${type}"><b>${label}</b><span>${url}</span></div>`;
}

function pollHtml(idValue: string, questionValue: string, optionValues: { id: string; label: string }[]) {
  const id = escapeHtml(idValue);
  const question = escapeHtml(questionValue);
  const options = escapeHtml(JSON.stringify(optionValues));
  const rows = optionValues.map((option) => `<div class="poll-option"><span>${escapeHtml(option.label)}</span></div>`).join('');
  return `<div class="poll-block" contenteditable="false" data-poll-id="${id}" data-poll-question="${question}" data-poll-options="${options}"><div class="poll-heading"><b>${question}</b></div>${rows}<small>선택지는 최대 ${MAX_POLL_OPTIONS}개까지 추가할 수 있어요.</small></div>`;
}

function blockHtml(node: TiptapNode): string {
  const children = node.content?.map((item) => ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock'].includes(item.type) ? blockHtml(item) : inlineHtml(item)).join('') ?? '';
  if (node.type === 'paragraph') return `<p>${children || '<br>'}</p>`;
  if (node.type === 'heading') return `<h${Number(node.attrs?.level ?? 2)}>${children}</h${Number(node.attrs?.level ?? 2)}>`;
  if (node.type === 'bulletList') return `<ul>${node.content?.map(blockHtml).join('') ?? ''}</ul>`;
  if (node.type === 'orderedList') return `<ol>${node.content?.map(blockHtml).join('') ?? ''}</ol>`;
  if (node.type === 'listItem') return `<li>${node.content?.map(blockHtml).join('') ?? ''}</li>`;
  if (node.type === 'blockquote') return `<blockquote>${node.content?.map(blockHtml).join('') ?? ''}</blockquote>`;
  if (node.type === 'codeBlock') return `<pre>${escapeHtml(node.content?.map((item) => item.text ?? '').join('') ?? '')}</pre>`;
  if (node.type === 'horizontalRule') return '<hr>';
  if (node.type === 'image' || node.type === 'imageResize') return imageHtml(node);
  if (node.type === 'youtube') return youtubeHtml(String(node.attrs?.src ?? ''));
  if (node.type === 'embed') return embedHtml(String(node.attrs?.url ?? node.attrs?.src ?? ''), String(node.attrs?.type ?? 'generic'));
  if (node.type === 'poll') return pollHtml(String(node.attrs?.pollId ?? ''), String(node.attrs?.question ?? ''), Array.isArray(node.attrs?.options) ? node.attrs.options as { id: string; label: string }[] : []);
  return children;
}

function initialHtml(document: TiptapDocument) {
  return document.content?.map(blockHtml).join('') || '<p><br></p>';
}

function imageCount(document: TiptapDocument) {
  let count = 0;
  const walk = (node: TiptapNode) => {
    if (node.type === 'image' || node.type === 'imageResize') count += 1;
    node.content?.forEach(walk);
  };
  document.content?.forEach(walk);
  return count;
}

export function CommunityRichEditor({ allowEmbeds, allowMedia, characterCount, characterLimit, maxImages, onChange, value }: Props) {
  const webView = useRef<WebView>(null);
  const initial = useRef(value).current;
  const { fonts, theme } = useMinionTheme();
  const [uploading, setUploading] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [palette, setPalette] = useState<PaletteMode>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>('youtube');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [pollOpen, setPollOpen] = useState(false);
  const [poll, setPoll] = useState<PollDraft>(emptyPoll);
  const html = useMemo(() => editorHtml(initialHtml(initial), { accent: theme.accent, background: theme.surface, border: theme.border, color: theme.text, ink: theme.ink, muted: theme.muted, mutedSurface: theme.surfaceMuted }), [initial, theme.accent, theme.border, theme.ink, theme.muted, theme.surface, theme.surfaceMuted, theme.text]);
  const command = (name: string, arg: unknown = '') => webView.current?.injectJavaScript(`window.minionCommand(${JSON.stringify(name)},${JSON.stringify(arg)});true;`);

  const pickImage = async () => {
    const remaining = Math.max(0, maxImages - imageCount(value));
    if (remaining === 0) { Alert.alert('이미지 첨부', `이미지는 ${maxImages}장까지 첨부할 수 있습니다.`); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, allowsMultipleSelection: remaining > 1, mediaTypes: ['images'], quality: 1, selectionLimit: remaining });
    if (result.canceled || result.assets.length === 0) return;
    if (result.assets.some((asset) => (asset.fileSize ?? 0) > 20 * 1024 * 1024)) { Alert.alert('이미지 첨부 실패', '이미지는 한 장당 20MB 이하만 선택할 수 있습니다.'); return; }
    setUploading(true);
    try {
      for (const asset of result.assets) {
        const formData = new FormData();
        formData.append('file', { name: asset.fileName ?? `community-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg', uri: asset.uri } as never);
        const uploaded = await uploadMobileApi<MobileCommunityUploadDto>('/api/mobile/v1/community/upload', formData);
        command('insertImage', { src: uploaded.url, width: Math.min(uploaded.width || 760, 760) });
      }
    } catch (caught) { Alert.alert('이미지 첨부 실패', caught instanceof Error ? caught.message : '이미지를 업로드하지 못했습니다.'); }
    finally { setUploading(false); }
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { document?: TiptapDocument; id?: string; options?: { id: string; label: string }[]; question?: string; type?: string };
      if (message.type === 'change' && message.document?.type === 'doc') onChange(message.document);
      if (message.type === 'poll-edit') {
        setPoll({ id: message.id ?? null, options: message.options?.length ? message.options : emptyPoll().options, question: message.question ?? '' });
        setPollOpen(true);
      }
    } catch { /* Ignore editor bridge noise. */ }
  };

  const openLink = (mode: LinkMode) => { setFormatOpen(false); setLinkUrl(''); setLinkMode(mode); setLinkOpen(true); };
  const closeLink = () => { setLinkOpen(false); setLinkUrl(''); };
  const insertLink = () => {
    const value = linkUrl.trim();
    if (!value) return;
    if (linkMode === 'youtube') {
      const match = value.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
      const videoId = match?.[1] ?? (value.length === 11 && !value.includes('/') ? value : '');
      if (!videoId) { Alert.alert('YouTube 영상', '유효한 YouTube URL을 입력해 주세요.'); return; }
      command('insertYoutube', `https://www.youtube.com/embed/${videoId}`);
    } else {
      try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        const type = parsed.hostname.includes('instagram.com') ? 'instagram' : parsed.hostname.includes('twitter.com') || parsed.hostname.includes('x.com') ? 'twitter' : 'generic';
        command('insertEmbed', { type, url: parsed.toString() });
      } catch { Alert.alert('SNS 게시물', '유효한 URL을 입력해 주세요.'); return; }
    }
    closeLink();
  };

  const openNewPoll = () => { setFormatOpen(false); setPoll(emptyPoll()); setPollOpen(true); };
  const savePoll = () => {
    const question = poll.question.trim();
    const options = poll.options.map((option) => ({ ...option, label: option.label.trim() })).filter((option) => Boolean(option.label));
    if (!question) { Alert.alert('투표 만들기', '질문을 입력해 주세요.'); return; }
    if (options.length < 2) { Alert.alert('투표 만들기', '선택지를 2개 이상 입력해 주세요.'); return; }
    const pollId = poll.id ?? newId();
    command(poll.id ? 'updatePoll' : 'insertPoll', { pollId, question, options });
    setPollOpen(false); setPoll(emptyPoll());
  };
  const deletePoll = () => { if (poll.id) command('deletePoll', poll.id); setPollOpen(false); setPoll(emptyPoll()); };
  const toolColor = (active = false) => active ? theme.accent : theme.text;

  return (
    <View style={[styles.root, { backgroundColor: theme.surface }]}>
      <WebView accessibilityLabel="내용" automaticallyAdjustContentInsets={false} javaScriptEnabled keyboardDisplayRequiresUserAction={false} onMessage={onMessage} originWhitelist={['*']} ref={webView} scrollEnabled source={{ html }} style={[styles.webView, { backgroundColor: theme.surface }]} />

      {formatOpen ? <View style={[styles.formatPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Tool compact label="굵게" onPress={() => command('bold')}><Bold color={theme.text} size={18} /></Tool><Tool compact label="기울임" onPress={() => command('italic')}><Italic color={theme.text} size={18} /></Tool><Tool compact label="밑줄" onPress={() => command('underline')}><Underline color={theme.text} size={18} /></Tool><Tool compact label="취소선" onPress={() => command('strikeThrough')}><Strikethrough color={theme.text} size={18} /></Tool><View style={[styles.formatDivider, { backgroundColor: theme.border }]} /><Tool compact label="글머리 목록" onPress={() => command('insertUnorderedList')}><List color={theme.text} size={18} /></Tool><Tool compact label="번호 목록" onPress={() => command('insertOrderedList')}><ListOrdered color={theme.text} size={18} /></Tool><FormatColorTool color="#000000" label="글자색" onPress={() => setPalette('text')}><Type color={theme.text} size={16} /></FormatColorTool><FormatColorTool color="transparent" label="배경색" onPress={() => setPalette('highlight')}><Highlighter color={theme.text} size={16} /></FormatColorTool>
      </View> : null}

      <Text style={[styles.count, { color: characterCount > characterLimit ? '#ef4444' : theme.muted, ...fonts.regular }]}>{characterCount.toLocaleString('ko-KR')}/{characterLimit.toLocaleString('ko-KR')}자</Text>
      <View style={[styles.toolbar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {allowMedia ? <><Tool disabled={uploading} label={uploading ? '이미지 업로드 중' : '이미지 첨부'} onPress={() => void pickImage()}>{uploading ? <ActivityIndicator color={theme.accent} size="small" /> : <ImageIcon color={theme.text} size={18} />}</Tool>{allowEmbeds ? <><Tool label="YouTube 영상 첨부" onPress={() => openLink('youtube')}><Video color={theme.text} size={18} /></Tool><Tool label="SNS 게시물 첨부" onPress={() => openLink('sns')}><Share2 color={theme.text} size={18} /></Tool></> : null}<Tool label="투표 추가" onPress={openNewPoll}><BarChart3 color={theme.text} size={18} /></Tool></> : null}
        <Tool active={formatOpen} label="텍스트 서식" onPress={() => setFormatOpen((open) => !open)}><Text style={{ color: toolColor(formatOpen), ...fonts.medium, fontSize: 16, lineHeight: 18 }}>Aa</Text></Tool><View style={[styles.toolDivider, { backgroundColor: theme.border }]} /><Tool label="실행 취소" onPress={() => command('undo')}><Undo color={theme.text} size={18} /></Tool><Tool label="다시 실행" onPress={() => command('redo')}><Redo color={theme.text} size={18} /></Tool>
      </View>

      <BottomSheet onClose={() => setPalette(null)} open={Boolean(palette)} title={palette === 'highlight' ? '배경색' : '글자색'}><View style={styles.palette}>{(palette === 'highlight' ? ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fecdd3'] : ['#111827', '#ef4444', '#3b82f6', '#16a34a', '#a855f7']).map((color) => <Pressable accessibilityLabel={color === 'transparent' ? '배경색 제거' : `${color} 색상`} key={color} onPress={() => { command(palette === 'highlight' ? 'highlight' : 'foreColor', color); setPalette(null); }} style={[styles.swatch, { backgroundColor: color === 'transparent' ? theme.surface : color, borderColor: theme.border }]}>{color === 'transparent' ? <Text style={{ color: theme.text, ...fonts.medium, fontSize: 13 }}>없음</Text> : null}</Pressable>)}</View></BottomSheet>
      <BottomSheet onClose={closeLink} open={linkOpen} title={linkMode === 'youtube' ? 'YouTube 영상 넣기' : 'SNS 게시물 넣기'}><TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setLinkUrl} onSubmitEditing={insertLink} placeholder={linkMode === 'youtube' ? 'YouTube URL을 붙여넣으세요' : 'Instagram 또는 X URL을 붙여넣으세요'} placeholderTextColor={theme.muted} returnKeyType="done" style={[styles.linkInput, { borderColor: theme.border, color: theme.text, ...fonts.regular }]} value={linkUrl} /><Pressable disabled={!linkUrl.trim()} onPress={insertLink} style={({ pressed }) => [styles.sheetPrimary, { backgroundColor: theme.ink, opacity: !linkUrl.trim() ? 0.4 : pressed ? 0.78 : 1 }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14 }}>넣기</Text></Pressable></BottomSheet>
      <BottomSheet onClose={() => { setPollOpen(false); setPoll(emptyPoll()); }} open={pollOpen} title="투표 만들기">
        <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, marginBottom: 14 }}>질문과 선택지를 입력해 주세요.</Text><Text style={[styles.fieldLabel, { color: theme.text, ...fonts.medium }]}>질문</Text><TextInput maxLength={100} onChangeText={(question) => setPoll((current) => ({ ...current, question }))} placeholder="무엇을 물어볼까요?" placeholderTextColor={theme.muted} style={[styles.pollInput, { borderColor: theme.border, color: theme.text, ...fonts.medium }]} value={poll.question} /><Text style={[styles.fieldLabel, { color: theme.text, ...fonts.medium, marginTop: 14 }]}>선택지</Text>
        <View style={styles.pollOptions}>{poll.options.map((option, index) => <View key={option.id} style={styles.pollOptionRow}><TextInput maxLength={40} onChangeText={(label) => setPoll((current) => ({ ...current, options: current.options.map((item) => item.id === option.id ? { ...item, label } : item) }))} placeholder={`선택지 ${index + 1}`} placeholderTextColor={theme.muted} style={[styles.pollInput, styles.pollOptionInput, { borderColor: theme.border, color: theme.text, ...fonts.medium }]} value={option.label} />{poll.options.length > 2 ? <Pressable accessibilityLabel={`선택지 ${index + 1} 삭제`} onPress={() => setPoll((current) => ({ ...current, options: current.options.filter((item) => item.id !== option.id) }))} style={styles.removeOption}><X color={theme.muted} size={17} /></Pressable> : null}</View>)}</View>
        {poll.options.length < MAX_POLL_OPTIONS ? <Pressable onPress={() => setPoll((current) => ({ ...current, options: [...current.options, { id: newId(), label: '' }] }))} style={[styles.addOption, { backgroundColor: theme.surface, borderColor: theme.border }]}><Plus color={theme.text} size={17} /><Text style={{ color: theme.text, ...fonts.medium, fontSize: 14 }}>선택지 추가</Text></Pressable> : null}<View style={[styles.pollActions, { borderTopColor: theme.border }]}>{poll.id ? <Pressable onPress={deletePoll} style={styles.deletePoll}><Text style={{ color: '#ef4444', ...fonts.medium, fontSize: 14 }}>투표 삭제</Text></Pressable> : <View style={styles.deletePoll} />}<Pressable onPress={savePoll} style={[styles.savePoll, { backgroundColor: theme.ink }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14 }}>{poll.id ? '수정' : '추가'}</Text></Pressable></View>
      </BottomSheet>
    </View>
  );
}

function Tool({ active = false, children, compact = false, disabled, label, onPress }: { active?: boolean; children: React.ReactNode; compact?: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  const { theme } = useMinionTheme();
  return <Pressable accessibilityLabel={label} accessibilityState={{ selected: active }} disabled={disabled} onPress={onPress} style={({ pressed }) => [compact ? styles.formatTool : styles.tool, active ? { backgroundColor: `${theme.accent}1f` } : pressed ? { backgroundColor: theme.surfaceMuted } : null, disabled ? styles.disabled : null]}>{children}</Pressable>;
}

function FormatColorTool({ children, color, label, onPress }: { children: React.ReactNode; color: string; label: string; onPress: () => void }) {
  const { theme } = useMinionTheme();
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.formatColorTool, pressed ? { backgroundColor: theme.surfaceMuted } : null]}>{children}<View style={[styles.formatColorBar, { backgroundColor: color, borderColor: theme.border }]} /></Pressable>;
}

function editorHtml(content: string, colors: { accent: string; background: string; border: string; color: string; ink: string; muted: string; mutedSurface: string }) {
  const safeContent = content.replace(/<script/gi, '&lt;script');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
@font-face{font-family:Pretendard;src:url('${EDITOR_FONT_URIS.regular}');font-weight:400}@font-face{font-family:Pretendard;src:url('${EDITOR_FONT_URIS.medium}');font-weight:500}@font-face{font-family:Pretendard;src:url('${EDITOR_FONT_URIS.bold}');font-weight:700}*{box-sizing:border-box}html,body{margin:0;background:${colors.background};color:${colors.color};font-family:Pretendard,-apple-system,sans-serif;font-size:16px;line-height:1.75}body{overflow-x:hidden}button,input{font:inherit}#editor{min-height:100vh;padding:16px 0 80px;outline:none;overflow-wrap:anywhere}#editor.is-empty:before{content:attr(data-placeholder);color:${colors.muted};opacity:.72;pointer-events:none}p{margin:0 0 8px}h1,h2,h3{margin:12px 0 7px}blockquote{border-left:3px solid ${colors.border};margin:10px 0;padding-left:12px}pre{background:${colors.mutedSurface};border-radius:8px;padding:10px;white-space:pre-wrap}ul,ol{padding-left:24px}hr{border:0;border-top:1px solid ${colors.border}}
.image-shell{display:flex;justify-content:flex-start;margin:12px 0;max-width:100%;width:100%}.image-shell[data-align="center"]{justify-content:center}.image-shell[data-align="right"]{justify-content:flex-end}.image-frame{max-width:100%;position:relative;width:fit-content}.image-shell img{border:1px solid transparent;border-radius:8px;display:block;height:auto;max-width:100%}.image-shell.selected img{border-color:${colors.accent}}.image-toolbar{align-items:center;background:${colors.background};border:1px solid ${colors.border};border-radius:12px;display:none;height:44px;overflow:hidden;position:absolute;right:0;top:-50px;z-index:4}.image-shell.selected .image-toolbar{display:flex}.image-toolbar button{align-items:center;background:transparent;border:0;display:flex;height:42px;justify-content:center;width:42px}.image-toolbar button.active{background:${colors.mutedSurface}}.image-toolbar b{align-items:flex-start;display:flex;flex-direction:column;gap:3px;width:16px}.image-toolbar button[data-image-align="center"] b{align-items:center}.image-toolbar button[data-image-align="right"] b{align-items:flex-end}.image-toolbar i{background:${colors.color};display:block;height:1.5px;width:16px}.image-toolbar i:nth-child(2){width:11px}.resize-handle{background:${colors.background};border:2px solid ${colors.accent};border-radius:2px;bottom:-5px;display:none;height:11px;position:absolute;right:-5px;touch-action:none;width:11px}.image-shell.selected .resize-handle{display:block}
.media-block{border:1px solid ${colors.border};border-radius:12px;margin:12px 0;overflow:hidden}.youtube-block{aspect-ratio:16/9;background:#000;position:relative}.youtube-block iframe{border:0;height:100%;pointer-events:none;width:100%}.youtube-block p{background:rgba(0,0,0,.68);bottom:8px;color:#fff;font-size:13px;left:8px;margin:0;padding:4px 8px;position:absolute}.sns-block{background:${colors.mutedSurface};display:flex;flex-direction:column;gap:4px;padding:14px}.sns-block b{color:${colors.ink};font-size:14px}.sns-block span{color:${colors.muted};font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.poll-block{background:${colors.background};border:1px solid ${colors.border};border-radius:8px;display:flex;flex-direction:column;gap:8px;margin:14px 0;padding:12px}.poll-heading{margin-bottom:2px}.poll-heading b{color:${colors.ink};font-size:16px;line-height:24px}.poll-option{align-items:center;border:1px solid ${colors.border};border-radius:8px;color:${colors.ink};display:flex;min-height:48px;padding:0 12px}.poll-block small{color:${colors.muted};font-size:13px;line-height:19px;text-align:right}
</style></head><body><div id="editor" contenteditable="true" data-placeholder="내용을 입력하세요">${safeContent}</div><script>
const editor=document.getElementById('editor');const fontMap={'1':'13px','2':'14px','3':'16px','4':'18px','5':'24px','6':'32px','7':'40px'};
function syncEmpty(){editor.classList.toggle('is-empty',!(editor.innerText||'').trim()&&!editor.querySelector('img,.media-block,.poll-block'))}
function textNode(node){const marks=[];let p=node.parentElement;while(p&&p!==editor){const tag=p.tagName;if(tag==='STRONG'||tag==='B')marks.push({type:'bold'});if(tag==='EM'||tag==='I')marks.push({type:'italic'});if(tag==='S'||tag==='STRIKE')marks.push({type:'strike'});if(tag==='U')marks.push({type:'underline'});if(tag==='CODE')marks.push({type:'code'});if(tag==='A')marks.push({type:'link',attrs:{href:p.getAttribute('href')||''}});const color=p.style.color||(tag==='FONT'?p.getAttribute('color'):'');const fontSize=p.style.fontSize||(tag==='FONT'?fontMap[p.getAttribute('size')||'']:'');if(color||fontSize)marks.push({type:'textStyle',attrs:{color:color||null,fontSize:fontSize||null}});if(p.style.backgroundColor)marks.push({type:'highlight',attrs:{color:p.style.backgroundColor}});p=p.parentElement}return {type:'text',text:node.nodeValue||'',...(marks.length?{marks}:{})}}
function inline(parent){const out=[];parent.childNodes.forEach(n=>{if(n.nodeType===3){if(n.nodeValue)out.push(textNode(n))}else if(n.nodeType===1){if(n.tagName==='BR')out.push({type:'hardBreak'});else out.push(...inline(n))}});return out}
function block(el){const tag=el.tagName;if(el.dataset.imageShell){const img=el.querySelector('img');const width=Math.round(parseFloat(img&&img.style.width)||img&&img.getBoundingClientRect().width||760);const align=el.dataset.align||'left';return {type:'imageResize',attrs:{src:img&&img.getAttribute('src')||'',alt:img&&img.getAttribute('alt')||'',width,containerStyle:'width: '+width+'px; height: auto; cursor: pointer; margin: 0.5rem 0;',wrapperStyle:'display: flex; justify-content: '+(align==='center'?'center':align==='right'?'flex-end':'flex-start')+'; margin: 0;'}}}if(el.dataset.pollId){let options=[];try{options=JSON.parse(el.dataset.pollOptions||'[]')}catch{}return {type:'poll',attrs:{pollId:el.dataset.pollId,question:el.dataset.pollQuestion||'',options}}}if(el.dataset.youtubeUrl)return {type:'youtube',attrs:{src:el.dataset.youtubeUrl}};if(el.dataset.embedUrl)return {type:'embed',attrs:{url:el.dataset.embedUrl,type:el.dataset.embedType||'generic'}};if(tag==='P'||tag==='DIV')return {type:'paragraph',content:inline(el)};if(/^H[1-3]$/.test(tag))return {type:'heading',attrs:{level:Number(tag[1])},content:inline(el)};if(tag==='BLOCKQUOTE')return {type:'blockquote',content:Array.from(el.children).map(block)};if(tag==='UL'||tag==='OL')return {type:tag==='UL'?'bulletList':'orderedList',content:Array.from(el.children).map(block)};if(tag==='LI')return {type:'listItem',content:[{type:'paragraph',content:inline(el)}]};if(tag==='PRE')return {type:'codeBlock',content:[{type:'text',text:el.innerText||''}]};if(tag==='HR')return {type:'horizontalRule'};if(tag==='IMG')return {type:'image',attrs:{src:el.getAttribute('src')||'',alt:el.getAttribute('alt')||''}};return {type:'paragraph',content:inline(el)}}
function emit(){const children=[];editor.childNodes.forEach(n=>{if(n.nodeType===3){if(n.nodeValue)children.push({type:'paragraph',content:[textNode(n)]})}else if(n.nodeType===1)children.push(block(n))});syncEmpty();window.ReactNativeWebView.postMessage(JSON.stringify({type:'change',document:{type:'doc',content:children.length?children:[{type:'paragraph'}]}}))}
function insertBlock(el){const sel=getSelection();if(sel&&sel.rangeCount&&editor.contains(sel.anchorNode)){const range=sel.getRangeAt(0);range.deleteContents();range.insertNode(el);range.setStartAfter(el);range.collapse(true);sel.removeAllRanges();sel.addRange(range)}else editor.appendChild(el);const p=document.createElement('p');p.appendChild(document.createElement('br'));el.after(p);emit()}
function imageBlock(data){const shell=document.createElement('div');shell.className='image-shell';shell.contentEditable='false';shell.dataset.imageShell='true';shell.dataset.align='left';shell.innerHTML='<div class="image-frame"><div class="image-toolbar">${IMAGE_ALIGNMENT_BUTTONS}</div><img><i class="resize-handle"></i></div>';const img=shell.querySelector('img');img.src=data.src;img.style.width=Math.max(80,Number(data.width)||760)+'px';return shell}
function youtubeBlock(src){const el=document.createElement('div');el.className='media-block youtube-block';el.contentEditable='false';el.dataset.youtubeUrl=src;el.innerHTML='<iframe title="YouTube 영상" frameborder="0" allowfullscreen></iframe><p>YOU·TUBE</p>';el.querySelector('iframe').src=src;return el}
function embedBlock(data){const el=document.createElement('div');el.className='media-block sns-block';el.contentEditable='false';el.dataset.embedUrl=data.url;el.dataset.embedType=data.type||'generic';const b=document.createElement('b');b.textContent=data.type==='instagram'?'Instagram':data.type==='twitter'?'X 게시물':'SNS 게시물';const span=document.createElement('span');span.textContent=data.url;el.append(b,span);return el}
function pollBlock(data){const el=document.createElement('div');el.className='poll-block';el.contentEditable='false';el.dataset.pollId=data.pollId;el.dataset.pollQuestion=data.question;el.dataset.pollOptions=JSON.stringify(data.options);el.innerHTML='<div class="poll-heading"><b></b></div>';el.querySelector('.poll-heading b').textContent=data.question;data.options.forEach(option=>{const row=document.createElement('div');row.className='poll-option';const label=document.createElement('span');label.textContent=option.label;row.append(label);el.append(row)});const small=document.createElement('small');small.textContent='선택지는 최대 ${MAX_POLL_OPTIONS}개까지 추가할 수 있어요.';el.append(small);return el}
function syncImageToolbar(shell){shell.querySelectorAll('[data-image-align]').forEach(button=>button.classList.toggle('active',button.dataset.imageAlign===shell.dataset.align))}editor.addEventListener('click',event=>{const target=event.target;const shell=target.closest&&target.closest('.image-shell');document.querySelectorAll('.image-shell.selected').forEach(el=>{if(el!==shell)el.classList.remove('selected')});if(shell){shell.classList.add('selected');const alignButton=target.closest('[data-image-align]');if(alignButton)shell.dataset.align=alignButton.dataset.imageAlign;syncImageToolbar(shell);if(alignButton)emit();return}const poll=target.closest&&target.closest('.poll-block');if(poll){let options=[];try{options=JSON.parse(poll.dataset.pollOptions||'[]')}catch{}window.ReactNativeWebView.postMessage(JSON.stringify({type:'poll-edit',id:poll.dataset.pollId,question:poll.dataset.pollQuestion,options}))}});
editor.addEventListener('pointerdown',event=>{const handle=event.target.closest&&event.target.closest('.resize-handle');if(!handle)return;event.preventDefault();const shell=handle.closest('.image-shell');const img=shell.querySelector('img');const startX=event.clientX,startWidth=img.getBoundingClientRect().width;handle.setPointerCapture(event.pointerId);const move=e=>{img.style.width=Math.max(80,Math.min(editor.clientWidth,startWidth+(e.clientX-startX)))+'px'};const end=e=>{handle.releasePointerCapture(e.pointerId);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);emit()};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end)});
let timer;editor.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(emit,80)});window.minionCommand=(name,arg)=>{editor.focus();if(name==='insertImage'){insertBlock(imageBlock(arg));return}if(name==='fontSize'){const size=Number(arg);document.execCommand('fontSize',false,size<=13?'1':size<=14?'2':size<=16?'3':size<=20?'4':size<=24?'5':'6');emit();return}if(name==='highlight'){document.execCommand('backColor',false,arg==='transparent'?'transparent':arg);emit();return}if(name==='insertYoutube'){insertBlock(youtubeBlock(arg));return}if(name==='insertEmbed'){insertBlock(embedBlock(arg));return}if(name==='insertPoll'){insertBlock(pollBlock(arg));return}if(name==='updatePoll'){const existing=editor.querySelector('[data-poll-id="'+CSS.escape(arg.pollId)+'"]');if(existing){existing.replaceWith(pollBlock(arg));emit()}return}if(name==='deletePoll'){const existing=editor.querySelector('[data-poll-id="'+CSS.escape(arg)+'"]');if(existing){existing.remove();emit()}return}document.execCommand(name,false,arg||null);emit()};syncEmpty();setTimeout(emit,100);
</script></body></html>`;
}

const styles = StyleSheet.create({
  root: { flex: 1, marginHorizontal: -16, minHeight: 0, paddingHorizontal: 16, position: 'relative' }, webView: { flex: 1 }, count: { fontSize: 13, lineHeight: 19.5, paddingBottom: 4, paddingHorizontal: 2, textAlign: 'right' }, toolbar: { alignItems: 'center', borderBottomWidth: 1, borderTopWidth: 1, flexDirection: 'row', height: 54, justifyContent: 'center', marginHorizontal: -16, paddingHorizontal: 7 }, tool: { alignItems: 'center', borderRadius: 10, height: 44, justifyContent: 'center', width: 44 }, disabled: { opacity: 0.4 }, toolDivider: { height: 24, marginHorizontal: 3, width: 1 }, formatPanel: { bottom: 64, borderRadius: 16, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, left: 8, padding: 8, position: 'absolute', right: 8, zIndex: 10 }, formatTool: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', width: 40 }, formatDivider: { height: 24, marginHorizontal: 4, marginVertical: 8, width: 1 }, formatColorTool: { alignItems: 'center', borderRadius: 4, height: 40, justifyContent: 'center', width: 32 }, formatColorBar: { borderWidth: 1, height: 3, marginTop: 2, width: 14 }, palette: { flexDirection: 'row', gap: 12, paddingBottom: 8 }, swatch: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, linkInput: { borderRadius: 8, borderWidth: 1, fontSize: 14, height: 44, paddingHorizontal: 13 }, sheetPrimary: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', marginTop: 10 }, fieldLabel: { fontSize: 13, lineHeight: 19.5, marginBottom: 6 }, pollInput: { borderRadius: 8, borderWidth: 1, fontSize: 14, height: 44, paddingHorizontal: 13 }, pollOptions: { gap: 8 }, pollOptionRow: { alignItems: 'center', flexDirection: 'row', gap: 10 }, pollOptionInput: { flex: 1 }, removeOption: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 }, addOption: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, height: 44, justifyContent: 'center', marginTop: 10 }, pollActions: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12 }, deletePoll: { justifyContent: 'center', minHeight: 44, minWidth: 80 }, savePoll: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', minWidth: 80, paddingHorizontal: 18 },
});
