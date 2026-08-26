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
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityUploadDto, TiptapDocument, TiptapNode } from '@/lib/api-client';
import { uploadMobileApi } from '@/lib/api-client';

type Props = { allowEmbeds: boolean; allowMedia: boolean; characterCount: number; characterLimit: number; maxImages: number; onChange: (document: TiptapDocument) => void; value: TiptapDocument };
type LinkMode = 'youtube' | 'sns';
type PaletteMode = 'text' | 'highlight' | null;
type PollOption = { id: string; label: string };
type PollDraft = { id: string | null; options: PollOption[]; question: string };

const MAX_POLL_OPTIONS = 6;

function newId() { return Crypto.randomUUID(); }
function emptyPoll(): PollDraft { return { id: null, options: [{ id: newId(), label: '' }, { id: newId(), label: '' }], question: '' }; }
function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function inlineHtml(node: TiptapNode): string {
  if (node.type === 'hardBreak') return '<br>';
  if (node.type !== 'text') return node.content?.map(inlineHtml).join('') ?? '';
  let output = escapeHtml(node.text ?? '');
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') output = `<strong>${output}</strong>`;
    if (mark.type === 'italic') output = `<em>${output}</em>`;
    if (mark.type === 'strike') output = `<s>${output}</s>`;
    if (mark.type === 'underline') output = `<u>${output}</u>`;
    if (mark.type === 'textStyle') output = `<span style="${mark.attrs?.color ? `color:${mark.attrs.color};` : ''}${mark.attrs?.fontSize ? `font-size:${mark.attrs.fontSize};` : ''}">${output}</span>`;
    if (mark.type === 'highlight') output = `<span style="background-color:${mark.attrs?.color ?? 'transparent'}">${output}</span>`;
  }
  return output;
}

function pollMarkup(pollId: string, question: string, options: PollOption[]) {
  return `<div class="mobile-poll" contenteditable="false" data-poll-id="${escapeHtml(pollId)}" data-poll-question="${escapeHtml(question)}" data-poll-options="${escapeHtml(JSON.stringify(options))}"><div class="mobile-poll-heading"><b>${escapeHtml(question)}</b></div>${options.map((option) => `<div class="mobile-poll-option"><span>${escapeHtml(option.label)}</span></div>`).join('')}<small>선택지는 최대 ${MAX_POLL_OPTIONS}개까지 추가할 수 있어요.</small></div>`;
}

function blockHtml(node: TiptapNode): string {
  const content = node.content?.map((child) => ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(child.type) ? blockHtml(child) : inlineHtml(child)).join('') ?? '';
  if (node.type === 'paragraph') return `<p>${content || '<br>'}</p>`;
  if (node.type === 'heading') return `<h${Number(node.attrs?.level ?? 2)}>${content}</h${Number(node.attrs?.level ?? 2)}>`;
  if (node.type === 'bulletList') return `<ul>${node.content?.map(blockHtml).join('') ?? ''}</ul>`;
  if (node.type === 'orderedList') return `<ol>${node.content?.map(blockHtml).join('') ?? ''}</ol>`;
  if (node.type === 'listItem') return `<li>${node.content?.map(blockHtml).join('') ?? ''}</li>`;
  if (node.type === 'blockquote') return `<blockquote>${node.content?.map(blockHtml).join('') ?? ''}</blockquote>`;
  if (node.type === 'image' || node.type === 'imageResize') return `<img src="${escapeHtml(String(node.attrs?.src ?? ''))}" alt="${escapeHtml(String(node.attrs?.alt ?? ''))}">`;
  if (node.type === 'youtube') { const src = escapeHtml(String(node.attrs?.src ?? '')); return `<div class="mobile-media mobile-youtube" contenteditable="false" data-youtube-url="${src}"><iframe src="${src}" title="YouTube 영상"></iframe><span>YouTube</span></div>`; }
  if (node.type === 'embed') { const url = escapeHtml(String(node.attrs?.url ?? '')); const type = escapeHtml(String(node.attrs?.type ?? 'generic')); return `<div class="mobile-media mobile-sns" contenteditable="false" data-embed-url="${url}" data-embed-type="${type}"><b>${type === 'instagram' ? 'Instagram' : type === 'twitter' ? 'X 게시물' : 'SNS 게시물'}</b><span>${url}</span></div>`; }
  if (node.type === 'poll') return pollMarkup(String(node.attrs?.pollId ?? ''), String(node.attrs?.question ?? ''), Array.isArray(node.attrs?.options) ? node.attrs.options as PollOption[] : []);
  return content;
}

function documentHtml(document: TiptapDocument) { return document.content?.map(blockHtml).join('') || '<p><br></p>'; }

function syncEditorEmpty(editor: HTMLElement) {
  const hasMedia = Boolean(editor.querySelector('img,[data-youtube-url],[data-embed-url],[data-poll-id]'));
  editor.dataset.empty = String(!hasMedia && !editor.textContent?.trim());
}

function inlineNodes(node: Node, marks: NonNullable<TiptapNode['marks']> = []): TiptapNode[] {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ type: 'text', text: node.textContent, ...(marks.length ? { marks } : {}) }] : [];
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === 'BR') return [{ type: 'hardBreak' }];
  const next = [...marks];
  if (node.matches('strong,b')) next.push({ type: 'bold' });
  if (node.matches('em,i')) next.push({ type: 'italic' });
  if (node.matches('s,strike')) next.push({ type: 'strike' });
  if (node.matches('u')) next.push({ type: 'underline' });
  if (node.style.color || node.style.fontSize) next.push({ type: 'textStyle', attrs: { color: node.style.color || null, fontSize: node.style.fontSize || null } });
  if (node.style.backgroundColor) next.push({ type: 'highlight', attrs: { color: node.style.backgroundColor } });
  return Array.from(node.childNodes).flatMap((child) => inlineNodes(child, next));
}

function blockNode(element: HTMLElement): TiptapNode {
  if (element.dataset.pollId) { let options: PollOption[] = []; try { options = JSON.parse(element.dataset.pollOptions ?? '[]') as PollOption[]; } catch { /* Keep empty. */ } return { type: 'poll', attrs: { pollId: element.dataset.pollId, question: element.dataset.pollQuestion ?? '', options } }; }
  if (element.dataset.youtubeUrl) return { type: 'youtube', attrs: { src: element.dataset.youtubeUrl } };
  if (element.dataset.embedUrl) return { type: 'embed', attrs: { url: element.dataset.embedUrl, type: element.dataset.embedType ?? 'generic' } };
  if (element.tagName === 'IMG') return { type: 'image', attrs: { src: element.getAttribute('src') ?? '', alt: element.getAttribute('alt') ?? '' } };
  if (element.matches('ul,ol')) return { type: element.tagName === 'UL' ? 'bulletList' : 'orderedList', content: Array.from(element.children).map((child) => blockNode(child as HTMLElement)) };
  if (element.tagName === 'LI') return { type: 'listItem', content: [{ type: 'paragraph', content: inlineNodes(element) }] };
  if (/^H[1-3]$/.test(element.tagName)) return { type: 'heading', attrs: { level: Number(element.tagName[1]) }, content: inlineNodes(element) };
  if (element.tagName === 'BLOCKQUOTE') return { type: 'blockquote', content: [{ type: 'paragraph', content: inlineNodes(element) }] };
  return { type: 'paragraph', content: inlineNodes(element) };
}

export function CommunityRichEditor({ allowEmbeds, allowMedia, characterCount, characterLimit, maxImages, onChange, value }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const selectionRef = useRef<Range | null>(null);
  const initial = useRef(value).current;
  const initialHtml = useMemo(() => documentHtml(initial), [initial]);
  const { fonts, theme } = useMinionTheme();
  const [uploading, setUploading] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [palette, setPalette] = useState<PaletteMode>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>('youtube');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [pollOpen, setPollOpen] = useState(false);
  const [poll, setPoll] = useState<PollDraft>(emptyPoll);

  useLayoutEffect(() => {
    if (initializedRef.current || !editorRef.current) return;
    editorRef.current.innerHTML = initialHtml;
    syncEditorEmpty(editorRef.current);
    initializedRef.current = true;
  }, [initialHtml]);

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const content = Array.from(editor.childNodes).flatMap<TiptapNode>((node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ type: 'paragraph', content: [{ type: 'text', text: node.textContent }] }] : [];
      return node instanceof HTMLElement ? [blockNode(node)] : [];
    });
    syncEditorEmpty(editor);
    onChange({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] });
  };
  const rememberSelection = () => {
    const selection = window.getSelection(); const editor = editorRef.current;
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const editor = editorRef.current; if (!editor) return;
    editor.focus(); const selection = window.getSelection(); selection?.removeAllRanges();
    if (selectionRef.current && editor.contains(selectionRef.current.commonAncestorContainer)) selection?.addRange(selectionRef.current);
  };
  const execute = (name: string, argument?: string) => { restoreSelection(); document.execCommand(name, false, argument); rememberSelection(); emit(); };
  const insertMarkup = (markup: string) => {
    const editor = editorRef.current; if (!editor) return;
    restoreSelection();
    const template = document.createElement('template'); template.innerHTML = markup;
    const fragment = template.content; const lastInserted = fragment.lastChild;
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const range = selection.getRangeAt(0);
      let topLevel = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer as HTMLElement : range.commonAncestorContainer.parentElement;
      while (topLevel?.parentElement && topLevel.parentElement !== editor) topLevel = topLevel.parentElement;
      if (topLevel?.parentElement === editor) editor.insertBefore(fragment, topLevel.nextSibling);
      else editor.appendChild(fragment);
      if (topLevel?.matches('p') && !topLevel.textContent?.trim() && !topLevel.querySelector('img')) topLevel.remove();
    } else editor.appendChild(fragment);
    const paragraph = document.createElement('p'); paragraph.appendChild(document.createElement('br'));
    if (lastInserted?.parentNode === editor) editor.insertBefore(paragraph, lastInserted.nextSibling);
    else editor.appendChild(paragraph);
    const range = document.createRange(); range.selectNodeContents(paragraph); range.collapse(true); selection?.removeAllRanges(); selection?.addRange(range); selectionRef.current = range.cloneRange();
    emit();
  };

  const pickImage = async () => {
    const remaining = Math.max(0, maxImages - (editorRef.current?.querySelectorAll('img').length ?? 0));
    if (remaining === 0) { Alert.alert('이미지 첨부', `이미지는 ${maxImages}장까지 첨부할 수 있습니다.`); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: remaining > 1, mediaTypes: ['images'], quality: 1, selectionLimit: remaining });
    if (result.canceled || result.assets.length === 0) return;
    if (result.assets.some((asset) => (asset.fileSize ?? 0) > 20 * 1024 * 1024)) { Alert.alert('이미지 첨부 실패', '이미지는 한 장당 20MB 이하만 선택할 수 있습니다.'); return; }
    setUploading(true);
    try {
      for (const asset of result.assets) {
        const formData = new FormData();
        if (asset.file) formData.append('file', asset.file);
        else formData.append('file', { name: asset.fileName ?? `community-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg', uri: asset.uri } as never);
        const uploaded = await uploadMobileApi<MobileCommunityUploadDto>('/api/mobile/v1/community/upload', formData);
        insertMarkup(`<img src="${escapeHtml(uploaded.url)}" alt="">`);
      }
    } catch (caught) { Alert.alert('이미지 첨부 실패', caught instanceof Error ? caught.message : '이미지를 업로드하지 못했습니다.'); }
    finally { setUploading(false); }
  };

  const insertLink = () => {
    const value = linkUrl.trim(); if (!value) return;
    if (linkMode === 'youtube') {
      const match = value.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
      const id = match?.[1] ?? (value.length === 11 && !value.includes('/') ? value : '');
      if (!id) { Alert.alert('YouTube 영상', '유효한 YouTube URL을 입력해 주세요.'); return; }
      insertMarkup(blockHtml({ type: 'youtube', attrs: { src: `https://www.youtube.com/embed/${id}` } }));
    } else {
      try { const parsed = new URL(value); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); const type = parsed.hostname.includes('instagram.com') ? 'instagram' : parsed.hostname.includes('twitter.com') || parsed.hostname.includes('x.com') ? 'twitter' : 'generic'; insertMarkup(blockHtml({ type: 'embed', attrs: { type, url: parsed.toString() } })); }
      catch { Alert.alert('SNS 게시물', '유효한 URL을 입력해 주세요.'); return; }
    }
    setLinkOpen(false); setLinkUrl('');
  };

  const savePoll = () => {
    const question = poll.question.trim(); const options = poll.options.map((option) => ({ ...option, label: option.label.trim() })).filter((option) => option.label);
    if (!question) { Alert.alert('투표 만들기', '질문을 입력해 주세요.'); return; }
    if (options.length < 2) { Alert.alert('투표 만들기', '선택지를 2개 이상 입력해 주세요.'); return; }
    const pollId = poll.id ?? newId(); const markup = pollMarkup(pollId, question, options);
    if (poll.id) { const existing = editorRef.current?.querySelector<HTMLElement>(`[data-poll-id="${CSS.escape(poll.id)}"]`); if (existing) existing.outerHTML = markup; }
    else insertMarkup(markup);
    emit(); setPollOpen(false); setPoll(emptyPoll());
  };
  const deletePoll = () => { if (poll.id) editorRef.current?.querySelector(`[data-poll-id="${CSS.escape(poll.id)}"]`)?.remove(); emit(); setPollOpen(false); setPoll(emptyPoll()); };
  const editPoll = (event: React.MouseEvent<HTMLDivElement>) => { const target = event.target as HTMLElement; const element = target.closest<HTMLElement>('[data-poll-id]'); if (!element) return; let options: PollOption[] = []; try { options = JSON.parse(element.dataset.pollOptions ?? '[]') as PollOption[]; } catch { /* Keep empty. */ } setPoll({ id: element.dataset.pollId ?? null, options: options.length ? options : emptyPoll().options, question: element.dataset.pollQuestion ?? '' }); setPollOpen(true); };

  return <View style={styles.root}>
    <style>{`.mobile-rich-editor{box-sizing:border-box;color:${theme.text};flex:1;font-family:Pretendard,sans-serif;font-size:16px;line-height:1.75;min-height:0;outline:none;overflow-y:auto;padding:16px 0 24px;position:relative;width:100%}.mobile-rich-editor[data-empty="true"]:before{color:${theme.muted};content:attr(data-placeholder);left:0;opacity:.72;pointer-events:none;position:absolute;top:16px}.mobile-rich-editor p{margin:0 0 8px}.mobile-rich-editor img{border-radius:8px;display:block;height:auto;margin:12px 0;max-width:100%}.mobile-media{border:1px solid ${theme.border};border-radius:12px;margin:12px 0;overflow:hidden}.mobile-youtube{aspect-ratio:16/9;background:#000;position:relative}.mobile-youtube iframe{border:0;height:100%;pointer-events:none;width:100%}.mobile-youtube>span{background:rgba(0,0,0,.68);bottom:8px;color:white;font-size:13px;left:8px;padding:4px 8px;position:absolute}.mobile-sns{background:${theme.surfaceMuted};display:flex;flex-direction:column;gap:4px;padding:14px}.mobile-sns>span{color:${theme.muted};font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mobile-poll{border:1px solid ${theme.border};border-radius:8px;display:flex;flex-direction:column;gap:8px;margin:14px 0;padding:12px}.mobile-poll-heading{margin-bottom:2px}.mobile-poll-heading b{color:${theme.ink};font-size:16px;line-height:24px}.mobile-poll-option{align-items:center;border:1px solid ${theme.border};border-radius:8px;display:flex;min-height:48px;padding:0 12px}.mobile-poll small{color:${theme.muted};font-size:13px;line-height:19px;text-align:right}`}</style>
    <div className="mobile-rich-editor" contentEditable data-placeholder="내용을 입력하세요" onBlur={rememberSelection} onClick={editPoll} onInput={emit} onKeyUp={rememberSelection} onMouseUp={rememberSelection} ref={editorRef} suppressContentEditableWarning />
    {formatOpen ? <View style={[styles.formatPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}><Tool compact label="굵게" onPress={() => execute('bold')}><Bold color={theme.text} size={18} /></Tool><Tool compact label="기울임" onPress={() => execute('italic')}><Italic color={theme.text} size={18} /></Tool><Tool compact label="밑줄" onPress={() => execute('underline')}><Underline color={theme.text} size={18} /></Tool><Tool compact label="취소선" onPress={() => execute('strikeThrough')}><Strikethrough color={theme.text} size={18} /></Tool><View style={[styles.formatDivider, { backgroundColor: theme.border }]} /><Tool compact label="글머리 목록" onPress={() => execute('insertUnorderedList')}><List color={theme.text} size={18} /></Tool><Tool compact label="번호 목록" onPress={() => execute('insertOrderedList')}><ListOrdered color={theme.text} size={18} /></Tool><FormatColorTool color="#000000" label="글자색" onPress={() => setPalette('text')}><Type color={theme.text} size={16} /></FormatColorTool><FormatColorTool color="transparent" label="배경색" onPress={() => setPalette('highlight')}><Highlighter color={theme.text} size={16} /></FormatColorTool></View> : null}
    <Text style={[styles.count, { color: characterCount > characterLimit ? '#ef4444' : theme.muted, ...fonts.regular }]}>{characterCount.toLocaleString('ko-KR')}/{characterLimit.toLocaleString('ko-KR')}자</Text>
    <View style={[styles.toolbar, { backgroundColor: theme.surface, borderColor: theme.border }]}>{allowMedia ? <><Tool disabled={uploading} label={uploading ? '이미지 업로드 중' : '이미지 첨부'} onPress={() => void pickImage()}>{uploading ? <ActivityIndicator color={theme.accent} size="small" /> : <ImageIcon color={theme.text} size={18} />}</Tool>{allowEmbeds ? <><Tool label="YouTube 영상 첨부" onPress={() => { setFormatOpen(false); setLinkMode('youtube'); setLinkOpen(true); }}><Video color={theme.text} size={18} /></Tool><Tool label="SNS 게시물 첨부" onPress={() => { setFormatOpen(false); setLinkMode('sns'); setLinkOpen(true); }}><Share2 color={theme.text} size={18} /></Tool></> : null}<Tool label="투표 추가" onPress={() => { setFormatOpen(false); setPoll(emptyPoll()); setPollOpen(true); }}><BarChart3 color={theme.text} size={18} /></Tool></> : null}<Tool active={formatOpen} label="텍스트 서식" onPress={() => setFormatOpen((open) => !open)}><Text style={{ color: formatOpen ? theme.accent : theme.text, ...fonts.medium, fontSize: 16 }}>Aa</Text></Tool><View style={[styles.divider, { backgroundColor: theme.border }]} /><Tool label="실행 취소" onPress={() => execute('undo')}><Undo color={theme.text} size={18} /></Tool><Tool label="다시 실행" onPress={() => execute('redo')}><Redo color={theme.text} size={18} /></Tool></View>
    <BottomSheet onClose={() => setPalette(null)} open={Boolean(palette)} title={palette === 'highlight' ? '배경색' : '글자색'}><View style={styles.palette}>{(palette === 'highlight' ? ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fecdd3'] : ['#111827', '#ef4444', '#3b82f6', '#16a34a', '#a855f7']).map((color) => <Pressable key={color} onPress={() => { execute(palette === 'highlight' ? 'backColor' : 'foreColor', color); setPalette(null); }} style={[styles.swatch, { backgroundColor: color === 'transparent' ? theme.surface : color, borderColor: theme.border }]}>{color === 'transparent' ? <Text style={{ color: theme.text, ...fonts.medium, fontSize: 13 }}>없음</Text> : null}</Pressable>)}</View></BottomSheet>
    <BottomSheet onClose={() => { setLinkOpen(false); setLinkUrl(''); }} open={linkOpen} title={linkMode === 'youtube' ? 'YouTube 영상 넣기' : 'SNS 게시물 넣기'}><TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setLinkUrl} onSubmitEditing={insertLink} placeholder={linkMode === 'youtube' ? 'YouTube URL을 붙여넣으세요' : 'Instagram 또는 X URL을 붙여넣으세요'} placeholderTextColor={theme.muted} style={[styles.input, { borderColor: theme.border, color: theme.text, ...fonts.regular }]} value={linkUrl} /><Pressable disabled={!linkUrl.trim()} onPress={insertLink} style={[styles.primary, { backgroundColor: theme.ink, opacity: linkUrl.trim() ? 1 : 0.4 }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14 }}>넣기</Text></Pressable></BottomSheet>
    <BottomSheet onClose={() => { setPollOpen(false); setPoll(emptyPoll()); }} open={pollOpen} title="투표 만들기"><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, marginBottom: 14 }}>질문과 선택지를 입력해 주세요.</Text><Text style={[styles.label, { color: theme.text, ...fonts.medium }]}>질문</Text><TextInput onChangeText={(question) => setPoll((current) => ({ ...current, question }))} placeholder="무엇을 물어볼까요?" placeholderTextColor={theme.muted} style={[styles.input, { borderColor: theme.border, color: theme.text, ...fonts.medium }]} value={poll.question} /><Text style={[styles.label, { color: theme.text, ...fonts.medium, marginTop: 14 }]}>선택지</Text><View style={styles.options}>{poll.options.map((option, index) => <View key={option.id} style={styles.optionRow}><TextInput onChangeText={(label) => setPoll((current) => ({ ...current, options: current.options.map((item) => item.id === option.id ? { ...item, label } : item) }))} placeholder={`선택지 ${index + 1}`} placeholderTextColor={theme.muted} style={[styles.input, styles.optionInput, { borderColor: theme.border, color: theme.text, ...fonts.medium }]} value={option.label} />{poll.options.length > 2 ? <Pressable onPress={() => setPoll((current) => ({ ...current, options: current.options.filter((item) => item.id !== option.id) }))} style={styles.remove}><X color={theme.muted} size={17} /></Pressable> : null}</View>)}</View>{poll.options.length < MAX_POLL_OPTIONS ? <Pressable onPress={() => setPoll((current) => ({ ...current, options: [...current.options, { id: newId(), label: '' }] }))} style={[styles.add, { backgroundColor: theme.surface, borderColor: theme.border }]}><Plus color={theme.text} size={17} /><Text style={{ color: theme.text, ...fonts.medium, fontSize: 14 }}>선택지 추가</Text></Pressable> : null}<View style={[styles.actions, { borderTopColor: theme.border }]}>{poll.id ? <Pressable onPress={deletePoll} style={styles.delete}><Text style={{ color: '#ef4444', ...fonts.medium, fontSize: 14 }}>투표 삭제</Text></Pressable> : <View style={styles.delete} />}<Pressable onPress={savePoll} style={[styles.save, { backgroundColor: theme.ink }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14 }}>{poll.id ? '수정' : '추가'}</Text></Pressable></View></BottomSheet>
  </View>;
}

function Tool({ active = false, children, compact = false, disabled, label, onPress }: { active?: boolean; children: React.ReactNode; compact?: boolean; disabled?: boolean; label: string; onPress: () => void }) { const { theme } = useMinionTheme(); return <Pressable accessibilityLabel={label} accessibilityState={{ selected: active }} disabled={disabled} onPress={onPress} style={({ pressed }) => [compact ? styles.formatTool : styles.tool, active ? { backgroundColor: `${theme.accent}1f` } : pressed ? { backgroundColor: theme.surfaceMuted } : null, disabled ? { opacity: 0.4 } : null]}>{children}</Pressable>; }

function FormatColorTool({ children, color, label, onPress }: { children: React.ReactNode; color: string; label: string; onPress: () => void }) { const { theme } = useMinionTheme(); return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.formatColorTool, pressed ? { backgroundColor: theme.surfaceMuted } : null]}>{children}<View style={[styles.formatColorBar, { backgroundColor: color, borderColor: theme.border }]} /></Pressable>; }

const styles = StyleSheet.create({ root: { flex: 1, marginHorizontal: -16, minHeight: 0, overflow: 'hidden', paddingHorizontal: 16, position: 'relative' }, count: { flexShrink: 0, fontSize: 13, lineHeight: 19.5, paddingBottom: 4, textAlign: 'right' }, toolbar: { alignItems: 'center', borderBottomWidth: 1, borderTopWidth: 1, flexDirection: 'row', flexShrink: 0, height: 54, justifyContent: 'center', marginHorizontal: -16, paddingHorizontal: 7 }, tool: { alignItems: 'center', borderRadius: 10, height: 44, justifyContent: 'center', width: 44 }, divider: { height: 24, marginHorizontal: 3, width: 1 }, formatPanel: { bottom: 64, borderRadius: 16, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, left: 8, padding: 8, position: 'absolute', right: 8, zIndex: 10 }, formatTool: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', width: 40 }, formatDivider: { height: 24, marginHorizontal: 4, marginVertical: 8, width: 1 }, formatColorTool: { alignItems: 'center', borderRadius: 4, height: 40, justifyContent: 'center', width: 32 }, formatColorBar: { borderWidth: 1, height: 3, marginTop: 2, width: 14 }, palette: { flexDirection: 'row', gap: 12, paddingBottom: 8 }, swatch: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, input: { borderRadius: 8, borderWidth: 1, fontSize: 14, height: 44, paddingHorizontal: 13 }, primary: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', marginTop: 10 }, label: { fontSize: 13, lineHeight: 19.5, marginBottom: 6 }, options: { gap: 8 }, optionRow: { alignItems: 'center', flexDirection: 'row', gap: 10 }, optionInput: { flex: 1 }, remove: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 }, add: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, height: 44, justifyContent: 'center', marginTop: 10 }, actions: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12 }, delete: { justifyContent: 'center', minHeight: 44, minWidth: 80 }, save: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', minWidth: 80, paddingHorizontal: 18 } });
