import * as ImagePicker from 'expo-image-picker';
import Bold from 'lucide-react-native/icons/bold';
import Highlighter from 'lucide-react-native/icons/highlighter';
import ImageIcon from 'lucide-react-native/icons/image';
import Italic from 'lucide-react-native/icons/italic';
import List from 'lucide-react-native/icons/list';
import ListOrdered from 'lucide-react-native/icons/list-ordered';
import Redo from 'lucide-react-native/icons/redo';
import Strikethrough from 'lucide-react-native/icons/strikethrough';
import Type from 'lucide-react-native/icons/type';
import Underline from 'lucide-react-native/icons/underline';
import Undo from 'lucide-react-native/icons/undo';
import Video from 'lucide-react-native/icons/video';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityUploadDto, TiptapDocument, TiptapNode } from '@/lib/api-client';
import { uploadMobileApi } from '@/lib/api-client';

type Props = { allowMedia: boolean; onChange: (document: TiptapDocument) => void; value: TiptapDocument };

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
  }
  return output;
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
  if (node.type === 'image' || node.type === 'imageResize') return `<img src="${escapeHtml(String(node.attrs?.src ?? ''))}" alt="${escapeHtml(String(node.attrs?.alt ?? ''))}">`;
  if (node.type === 'youtube') {
    const src = escapeHtml(String(node.attrs?.src ?? ''));
    return `<div class="media-block" contenteditable="false" data-youtube-url="${src}">유튜브 영상 · ${src}</div>`;
  }
  if (node.type === 'embed') {
    const url = escapeHtml(String(node.attrs?.url ?? node.attrs?.src ?? ''));
    const type = escapeHtml(String(node.attrs?.type ?? 'generic'));
    return `<div class="media-block" contenteditable="false" data-embed-url="${url}" data-embed-type="${type}">SNS 링크 · ${url}</div>`;
  }
  if (node.type === 'poll') {
    const pollId = escapeHtml(String(node.attrs?.pollId ?? ''));
    const question = escapeHtml(String(node.attrs?.question ?? ''));
    const options = escapeHtml(JSON.stringify(Array.isArray(node.attrs?.options) ? node.attrs?.options : []));
    return `<div class="poll-block" contenteditable="false" data-poll-id="${pollId}" data-poll-question="${question}" data-poll-options="${options}">투표 · ${question}</div>`;
  }
  return children;
}

function initialHtml(document: TiptapDocument) {
  return document.content?.map(blockHtml).join('') || '<p><br></p>';
}

export function CommunityRichEditor({ allowMedia, onChange, value }: Props) {
  const webView = useRef<WebView>(null);
  const initial = useRef(value).current;
  const { colorScheme, fonts, theme } = useMinionTheme();
  const [uploading, setUploading] = useState(false);
  const [palette, setPalette] = useState<'text' | 'highlight' | null>(null);
  const [sizeOpen, setSizeOpen] = useState(false);
  const html = useMemo(() => editorHtml(initialHtml(initial), { background: theme.surface, border: theme.border, color: theme.text, muted: theme.muted }), [initial, theme.border, theme.muted, theme.surface, theme.text]);
  const command = (name: string, arg = '') => webView.current?.injectJavaScript(`window.minionCommand(${JSON.stringify(name)},${JSON.stringify(arg)});true;`);
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > 20 * 1024 * 1024) { Alert.alert('이미지 첨부 실패', '이미지는 20MB 이하만 선택할 수 있습니다.'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', { name: asset.fileName ?? `community-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg', uri: asset.uri } as never);
      const uploaded = await uploadMobileApi<MobileCommunityUploadDto>('/api/mobile/v1/community/upload', formData);
      command('insertImage', uploaded.url);
    } catch (caught) { Alert.alert('이미지 첨부 실패', caught instanceof Error ? caught.message : '이미지를 업로드하지 못했습니다.'); }
    finally { setUploading(false); }
  };
  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; document?: TiptapDocument };
      if (message.type === 'change' && message.document?.type === 'doc') onChange(message.document);
    } catch { /* Ignore editor bridge noise. */ }
  };
  return (
    <View style={[styles.root, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.toolbar, { borderBottomColor: theme.border }]} contentContainerStyle={styles.toolbarContent}>
        <Tool label="굵게" onPress={() => command('bold')}><Bold color={theme.text} size={19} /></Tool>
        <Tool label="기울임" onPress={() => command('italic')}><Italic color={theme.text} size={19} /></Tool>
        <Tool label="취소선" onPress={() => command('strikeThrough')}><Strikethrough color={theme.text} size={19} /></Tool>
        <Tool label="밑줄" onPress={() => command('underline')}><Underline color={theme.text} size={19} /></Tool>
        <View style={[styles.toolDivider, { backgroundColor: theme.border }]} />
        <Tool label="글자색" onPress={() => setPalette('text')}><Type color={theme.text} size={19} /></Tool>
        <Tool label="형광펜" onPress={() => setPalette('highlight')}><Highlighter color={theme.text} size={19} /></Tool>
        <Pressable accessibilityLabel="글자 크기" onPress={() => setSizeOpen(true)} style={styles.sizeButton}><Text style={{ color: theme.text, fontFamily: fonts.medium, fontSize: 13 }}>16⌄</Text></Pressable>
        <View style={[styles.toolDivider, { backgroundColor: theme.border }]} />
        <Tool label="글머리 목록" onPress={() => command('insertUnorderedList')}><List color={theme.text} size={19} /></Tool>
        <Tool label="번호 목록" onPress={() => command('insertOrderedList')}><ListOrdered color={theme.text} size={19} /></Tool>
        {allowMedia ? <><View style={[styles.toolDivider, { backgroundColor: theme.border }]} /><Tool disabled={uploading} label="이미지 첨부" onPress={() => void pickImage()}>{uploading ? <ActivityIndicator color={theme.accent} size="small" /> : <ImageIcon color={theme.text} size={19} />}</Tool><Tool label="유튜브 영상" onPress={() => command('insertYoutube')}><Video color={theme.text} size={19} /></Tool><Tool label="SNS 임베드" onPress={() => command('insertEmbed')}><Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 11 }}>SNS</Text></Tool><Tool label="투표" onPress={() => command('insertPoll')}><Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 11 }}>투표</Text></Tool></> : null}
        <View style={[styles.toolDivider, { backgroundColor: theme.border }]} />
        <Tool label="실행 취소" onPress={() => command('undo')}><Undo color={theme.text} size={19} /></Tool>
        <Tool label="다시 실행" onPress={() => command('redo')}><Redo color={theme.text} size={19} /></Tool>
      </ScrollView>
      <WebView
        accessibilityLabel="내용"
        automaticallyAdjustContentInsets={false}
        javaScriptEnabled
        keyboardDisplayRequiresUserAction={false}
        onMessage={onMessage}
        originWhitelist={['*']}
        ref={webView}
        scrollEnabled
        source={{ html }}
        style={[styles.webView, { backgroundColor: theme.surface }]}
      />
      <Text style={[styles.hint, { color: theme.muted, fontFamily: fonts.regular }]}>{colorScheme === 'dark' ? '서식을 적용할 텍스트를 선택한 뒤 도구를 눌러주세요.' : '서식을 적용할 텍스트를 선택한 뒤 도구를 눌러주세요.'}</Text>
      <BottomSheet onClose={() => setPalette(null)} open={Boolean(palette)} title={palette === 'highlight' ? '형광펜 색상' : '글자색'}>
        <View style={styles.palette}>{(palette === 'highlight' ? ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fecdd3'] : ['#111827', '#ef4444', '#3b82f6', '#16a34a', '#a855f7']).map((color) => <Pressable accessibilityLabel={color === 'transparent' ? '형광펜 지우기' : `${color} 색상`} key={color} onPress={() => { command(palette === 'highlight' ? 'highlight' : 'foreColor', color); setPalette(null); }} style={[styles.swatch, { backgroundColor: color === 'transparent' ? theme.surface : color, borderColor: theme.border }]}>{color === 'transparent' ? <Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 12 }}>없음</Text> : null}</Pressable>)}</View>
      </BottomSheet>
      <BottomSheet onClose={() => setSizeOpen(false)} open={sizeOpen} title="글자 크기">
        <View style={styles.sizeOptions}>{['12', '14', '16', '18', '20', '24', '32'].map((size) => <Pressable key={size} onPress={() => { command('fontSize', size); setSizeOpen(false); }} style={[styles.sizeOption, { borderColor: theme.border }]}><Text style={{ color: theme.text, fontFamily: fonts.medium, fontSize: Number(size) }}>{size}</Text></Pressable>)}</View>
      </BottomSheet>
    </View>
  );
}

function Tool({ children, disabled, label, onPress }: { children: React.ReactNode; disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={styles.tool}>{children}</Pressable>;
}

function editorHtml(content: string, colors: { background: string; border: string; color: string; muted: string }) {
  const safeContent = content.replace(/<script/gi, '&lt;script');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{box-sizing:border-box}html,body{margin:0;background:${colors.background};color:${colors.color};font-family:Pretendard,-apple-system,sans-serif;font-size:16px;line-height:1.75}#editor{min-height:300px;padding:14px;outline:none;overflow-wrap:anywhere}p{margin:0 0 8px}h1,h2,h3{margin:12px 0 7px}blockquote{border-left:3px solid ${colors.border};margin:10px 0;padding-left:12px}pre{background:${colors.muted}18;border-radius:8px;padding:10px;white-space:pre-wrap}img{display:block;max-width:100%;height:auto;border-radius:8px;margin:8px 0}ul,ol{padding-left:24px}.media-block,.poll-block{border:1px solid ${colors.border};border-radius:8px;margin:8px 0;padding:12px;color:${colors.color};background:${colors.muted}12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.poll-block{white-space:normal;font-weight:700}</style></head><body><div id="editor" contenteditable="true" data-placeholder="내용을 입력하세요">${safeContent}</div><script>
const editor=document.getElementById('editor');
const fontMap={'1':'12px','2':'14px','3':'16px','4':'18px','5':'24px','6':'32px','7':'40px'};
function textNode(node){const marks=[];let p=node.parentElement;while(p&&p!==editor){const tag=p.tagName;if(tag==='STRONG'||tag==='B')marks.push({type:'bold'});if(tag==='EM'||tag==='I')marks.push({type:'italic'});if(tag==='S'||tag==='STRIKE')marks.push({type:'strike'});if(tag==='U')marks.push({type:'underline'});if(tag==='CODE')marks.push({type:'code'});if(tag==='A')marks.push({type:'link',attrs:{href:p.getAttribute('href')||''}});const color=p.style.color||(tag==='FONT'?p.getAttribute('color'):'');const fontSize=p.style.fontSize||(tag==='FONT'?fontMap[p.getAttribute('size')||'']:'');if(color||fontSize)marks.push({type:'textStyle',attrs:{color:color||null,fontSize:fontSize||null}});if(p.style.backgroundColor)marks.push({type:'highlight',attrs:{color:p.style.backgroundColor}});p=p.parentElement}return {type:'text',text:node.nodeValue||'',...(marks.length?{marks}: {})}}
function inline(parent){const out=[];parent.childNodes.forEach(n=>{if(n.nodeType===3){if(n.nodeValue)out.push(textNode(n))}else if(n.nodeType===1){if(n.tagName==='BR')out.push({type:'hardBreak'});else out.push(...inline(n))}});return out}
function block(el){const tag=el.tagName;if(el.dataset.pollId){let options=[];try{options=JSON.parse(el.dataset.pollOptions||'[]')}catch{}return {type:'poll',attrs:{pollId:el.dataset.pollId,question:el.dataset.pollQuestion||'',options}}}if(el.dataset.youtubeUrl)return {type:'youtube',attrs:{src:el.dataset.youtubeUrl}};if(el.dataset.embedUrl)return {type:'embed',attrs:{url:el.dataset.embedUrl,type:el.dataset.embedType||'generic'}};if(tag==='P'||tag==='DIV')return {type:'paragraph',content:inline(el)};if(/^H[1-3]$/.test(tag))return {type:'heading',attrs:{level:Number(tag[1])},content:inline(el)};if(tag==='BLOCKQUOTE')return {type:'blockquote',content:Array.from(el.children).map(block)};if(tag==='UL'||tag==='OL')return {type:tag==='UL'?'bulletList':'orderedList',content:Array.from(el.children).map(block)};if(tag==='LI')return {type:'listItem',content:[{type:'paragraph',content:inline(el)}]};if(tag==='PRE')return {type:'codeBlock',content:[{type:'text',text:el.innerText||''}]};if(tag==='HR')return {type:'horizontalRule'};if(tag==='IMG')return {type:'image',attrs:{src:el.getAttribute('src')||'',alt:el.getAttribute('alt')||''}};return {type:'paragraph',content:inline(el)}}
function emit(){const children=[];editor.childNodes.forEach(n=>{if(n.nodeType===3){if(n.nodeValue)children.push({type:'paragraph',content:[textNode(n)]})}else if(n.nodeType===1)children.push(block(n))});window.ReactNativeWebView.postMessage(JSON.stringify({type:'change',document:{type:'doc',content:children.length?children:[{type:'paragraph'}]}}))}
function uid(){return self.crypto&&self.crypto.randomUUID?self.crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}
function insertBlock(el){const sel=getSelection();if(sel&&sel.rangeCount){const range=sel.getRangeAt(0);range.deleteContents();range.insertNode(el);range.setStartAfter(el);range.collapse(true);sel.removeAllRanges();sel.addRange(range)}else editor.appendChild(el);editor.appendChild(document.createElement('p')).appendChild(document.createElement('br'));emit()}
let timer;editor.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(emit,80)});window.minionCommand=(name,arg)=>{editor.focus();if(name==='insertImage'){document.execCommand('insertHTML',false,'<img src="'+String(arg).replace(/"/g,'&quot;')+'">');emit();return}if(name==='fontSize'){const size=Number(arg);const commandSize=size<=12?'1':size<=14?'2':size<=16?'3':size<=20?'4':size<=24?'5':'6';document.execCommand('fontSize',false,commandSize);emit();return}if(name==='highlight'){document.execCommand('backColor',false,arg==='transparent'?'transparent':arg);emit();return}if(name==='insertYoutube'){const input=prompt('유튜브 URL을 입력해 주세요.');if(!input)return;const match=input.match(/(?:v=|youtu\\.be\\/|embed\\/)([\\w-]{11})/);const id=match&&match[1]?match[1]:(/^[\\w-]{11}$/.test(input)?input:'');if(!id){alert('유효한 유튜브 URL을 입력해 주세요.');return}const el=document.createElement('div');el.contentEditable='false';el.className='media-block';el.dataset.youtubeUrl='https://www.youtube.com/embed/'+id;el.textContent='유튜브 영상 · '+input;insertBlock(el);return}if(name==='insertEmbed'){const input=prompt('인스타그램 또는 트위터(X) 게시글 URL을 입력해 주세요.');if(!input)return;try{const url=new URL(input);if(!['http:','https:'].includes(url.protocol))throw new Error();const el=document.createElement('div');el.contentEditable='false';el.className='media-block';el.dataset.embedUrl=url.toString();el.dataset.embedType=url.hostname.includes('instagram.com')?'instagram':url.hostname.includes('twitter.com')||url.hostname.includes('x.com')?'twitter':'generic';el.textContent='SNS 링크 · '+url.toString();insertBlock(el)}catch{alert('유효한 URL을 입력해 주세요.')}return}if(name==='insertPoll'){const question=prompt('투표 질문을 입력해 주세요.');if(!question||!question.trim())return;const raw=prompt('선택지를 쉼표(,)로 구분해 입력해 주세요.','찬성, 반대');if(!raw)return;const labels=raw.split(',').map(v=>v.trim()).filter(Boolean);if(labels.length<2){alert('선택지를 2개 이상 입력해 주세요.');return}const options=labels.slice(0,8).map(label=>({id:uid(),label}));const el=document.createElement('div');el.contentEditable='false';el.className='poll-block';el.dataset.pollId=uid();el.dataset.pollQuestion=question.trim();el.dataset.pollOptions=JSON.stringify(options);el.textContent='투표 · '+question.trim();insertBlock(el);return}document.execCommand(name,false,arg||null);emit()};setTimeout(emit,100);
</script></body></html>`;
}

const styles = StyleSheet.create({ root: { borderRadius: 8, borderWidth: 1, height: 390, overflow: 'hidden' }, toolbar: { borderBottomWidth: 1, flexGrow: 0, height: 48 }, toolbarContent: { alignItems: 'center', paddingHorizontal: 6 }, tool: { alignItems: 'center', height: 42, justifyContent: 'center', width: 40 }, toolDivider: { height: 24, marginHorizontal: 3, width: 1 }, sizeButton: { alignItems: 'center', borderRadius: 5, height: 34, justifyContent: 'center', marginHorizontal: 3, width: 46 }, webView: { flex: 1 }, hint: { fontSize: 11, lineHeight: 16, paddingHorizontal: 12, paddingVertical: 5 }, palette: { flexDirection: 'row', gap: 12, paddingBottom: 8 }, swatch: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, sizeOptions: { gap: 8, paddingBottom: 8 }, sizeOption: { alignItems: 'center', borderBottomWidth: 1, justifyContent: 'center', minHeight: 48 } });
