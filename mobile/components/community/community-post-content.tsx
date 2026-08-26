import { Image } from 'expo-image';
import Check from 'lucide-react-native/icons/check';
import ExternalLink from 'lucide-react-native/icons/external-link';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityPollDto, TiptapDocument, TiptapNode } from '@/lib/api-client';
import { fetchMobileApi, mutateMobileApi, resolveApiAssetUrl } from '@/lib/api-client';

export function CommunityPostContent({ document }: { document: TiptapDocument }) {
  return <View style={styles.document}>{document.content?.map((node, index) => <BlockNode key={`${node.type}:${index}`} node={node} />)}</View>;
}

function BlockNode({ node, depth = 0 }: { node: TiptapNode; depth?: number }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const foreground = colorScheme === 'dark' ? '#f8f8f8' : '#111827';
  if (node.type === 'paragraph') return <Text style={[styles.paragraph, { color: foreground, ...fonts.regular }]}>{inlineContent(node)}</Text>;
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 2);
    return <Text style={[styles.heading, level === 1 ? styles.headingOne : level === 2 ? styles.headingTwo : styles.headingThree, { color: foreground, ...fonts.bold }]}>{inlineContent(node)}</Text>;
  }
  if (node.type === 'blockquote') return <View style={[styles.blockquote, { borderLeftColor: theme.border }]}>{node.content?.map((child, index) => <BlockNode depth={depth + 1} key={index} node={child} />)}</View>;
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return <View style={styles.list}>{node.content?.map((child, index) => <View key={index} style={styles.listRow}><Text style={[styles.bullet, { color: foreground, ...fonts.regular }]}>{node.type === 'orderedList' ? `${index + 1}.` : '•'}</Text><View style={styles.listContent}><BlockNode depth={depth + 1} node={child} /></View></View>)}</View>;
  }
  if (node.type === 'listItem') return <View>{node.content?.map((child, index) => <BlockNode depth={depth + 1} key={index} node={child} />)}</View>;
  if (node.type === 'codeBlock') return <View style={[styles.codeBlock, { backgroundColor: theme.surfaceMuted }]}><Text selectable style={{ color: foreground, fontFamily: 'monospace', fontSize: 13, lineHeight: 20 }}>{plainText(node)}</Text></View>;
  if (node.type === 'horizontalRule') return <View style={[styles.rule, { backgroundColor: theme.divider }]} />;
  if (node.type === 'image' || node.type === 'imageResize') {
    const src = typeof node.attrs?.src === 'string' ? resolveApiAssetUrl(node.attrs.src) : null;
    const width = Number(node.attrs?.width ?? 0);
    const height = Number(node.attrs?.height ?? 0);
    if (!src) return null;
    return <Image accessibilityLabel={typeof node.attrs?.alt === 'string' ? node.attrs.alt : '게시글 이미지'} contentFit="contain" source={{ uri: src }} style={[styles.image, { aspectRatio: width > 0 && height > 0 ? width / height : 4 / 3, backgroundColor: theme.surfaceMuted }]} transition={180} />;
  }
  if (node.type === 'youtube' || node.type === 'embed') {
    const href = String(node.attrs?.src ?? node.attrs?.url ?? '');
    if (!href) return null;
    const youtubeId = href.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
    return <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(href)} style={[styles.embed, { backgroundColor: theme.surfaceMuted }]}>{youtubeId ? <Image contentFit="cover" source={{ uri: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} /> : null}<View style={styles.embedShade} /><ExternalLink color="#fff" size={24} /><Text numberOfLines={2} style={{ color: '#fff', ...fonts.medium, fontSize: 14 }}>{String(node.attrs?.title ?? '외부 콘텐츠 열기')}</Text></Pressable>;
  }
  if (node.type === 'poll') return <PollNode node={node} />;
  return node.content?.length ? <View>{node.content.map((child, index) => <BlockNode depth={depth + 1} key={index} node={child} />)}</View> : null;
}

function inlineContent(node: TiptapNode) {
  return node.content?.map((child, index) => <Fragment key={index}>{inlineNode(child)}</Fragment>);
}

function inlineNode(node: TiptapNode): React.ReactNode {
  if (node.type === 'hardBreak') return '\n';
  if (node.type !== 'text') return node.content?.map((child, index) => <Fragment key={index}>{inlineNode(child)}</Fragment>);
  const style: Record<string, string | number> = {};
  let href: string | null = null;
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') style.fontWeight = '700';
    if (mark.type === 'italic') style.fontStyle = 'italic';
    if (mark.type === 'strike') style.textDecorationLine = 'line-through';
    if (mark.type === 'underline') style.textDecorationLine = style.textDecorationLine ? `${style.textDecorationLine} underline` : 'underline';
    if (mark.type === 'code') style.fontFamily = 'monospace';
    if (mark.type === 'highlight' && typeof mark.attrs?.color === 'string') style.backgroundColor = mark.attrs.color;
    if (mark.type === 'textStyle' && typeof mark.attrs?.color === 'string') style.color = mark.attrs.color;
    if (mark.type === 'textStyle' && typeof mark.attrs?.fontSize === 'string') style.fontSize = Number.parseInt(mark.attrs.fontSize, 10) || 16;
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string') href = mark.attrs.href;
  }
  return <Text onPress={href ? () => void Linking.openURL(href!) : undefined} style={style}>{node.text ?? ''}</Text>;
}

function plainText(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return node.content?.map(plainText).join('') ?? '';
}

type PollOption = { id: string; label: string };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pollStorageId(value: string, namespace: 'option' | 'poll') {
  if (UUID_PATTERN.test(value)) return value.toLowerCase();
  const input = `${namespace}:${value}`;
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  let hex = seeds.map((seed) => {
    let hash = seed;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }).join('');
  hex = `${hex.slice(0, 12)}5${hex.slice(13, 16)}a${hex.slice(17)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function PollNode({ node }: { node: TiptapNode }) {
  const pollId = typeof node.attrs?.pollId === 'string' ? node.attrs.pollId : '';
  const options = Array.isArray(node.attrs?.options) ? node.attrs.options.filter((item): item is PollOption => Boolean(item && typeof item === 'object' && 'id' in item && 'label' in item)) : [];
  const question = typeof node.attrs?.question === 'string' ? node.attrs.question : '';
  const { fonts, theme } = useMinionTheme();
  const [tally, setTally] = useState<MobileCommunityPollDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storagePollId = pollStorageId(pollId, 'poll');
  useEffect(() => {
    if (!pollId) return;
    let active = true;
    fetchMobileApi<MobileCommunityPollDto>(`/api/mobile/v1/community/polls/${storagePollId}`)
      .then((next) => { if (active) setTally(next); })
      .catch(() => { if (active) setTally(null); });
    return () => { active = false; };
  }, [pollId, storagePollId]);
  const vote = async (optionId: string) => {
    setError(null);
    setLoading(true);
    try {
      setTally(await mutateMobileApi<MobileCommunityPollDto>(`/api/mobile/v1/community/polls/${storagePollId}`, 'POST', { optionId: pollStorageId(optionId, 'option') }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '투표를 처리하지 못했습니다.');
    } finally { setLoading(false); }
  };
  const voted = Boolean(tally?.myOptionId);
  return (
    <View style={[styles.poll, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {question ? <Text style={[styles.pollQuestion, { color: theme.ink, ...fonts.bold }]}>{question}</Text> : null}
      {options.map((option) => {
        const storageOptionId = pollStorageId(option.id, 'option');
        const count = tally?.counts[storageOptionId] ?? 0;
        const percent = voted && tally?.total ? Math.round(count / tally.total * 100) : 0;
        const mine = tally?.myOptionId === storageOptionId;
        return <Pressable disabled={loading} key={option.id} onPress={() => void vote(option.id)} style={[styles.pollOption, { backgroundColor: mine ? `${theme.accent}0d` : theme.surface, borderColor: mine ? theme.accent : theme.border }]}><View style={[styles.pollFill, { backgroundColor: `${theme.accent}1f`, width: `${percent}%` }]} /><Text numberOfLines={1} style={[styles.pollLabel, { color: theme.ink, ...fonts.medium }]}>{option.label || '(빈 선택지)'}</Text>{voted ? <View style={styles.pollResult}>{mine ? <Check color={theme.accent} size={15} strokeWidth={2.5} /> : null}<Text style={{ color: theme.text, ...fonts.medium, fontSize: 13 }}>{percent}%</Text><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>{count}표</Text></View> : null}</Pressable>;
      })}
      <View style={styles.pollStatus}>{loading ? <ActivityIndicator color={theme.accent} size="small" /> : error ? <Text style={{ color: '#ef4444', ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{error}</Text> : <><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>총 {tally?.total ?? 0}명 참여</Text><Text style={[styles.pollHint, { color: theme.muted, ...fonts.medium }]}>{voted ? '선택을 다시 누르면 취소할 수 있어요.' : '선택하면 결과를 확인할 수 있어요.'}</Text></>}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  document: { gap: 0, marginTop: 7.2 },
  paragraph: { fontSize: 14, lineHeight: 24.5, marginBottom: 7.2, minHeight: 16.8 },
  heading: { marginBottom: 4.8, marginTop: 9.6 },
  headingOne: { fontSize: 22.4, lineHeight: 27 },
  headingTwo: { fontSize: 18.9, lineHeight: 24 },
  headingThree: { fontSize: 16.1, lineHeight: 22 },
  blockquote: { borderLeftWidth: 3, gap: 0, marginVertical: 8, paddingLeft: 13.6 },
  list: { gap: 2.1, marginVertical: 6.4, paddingLeft: 10 },
  listRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 14, lineHeight: 24.5, minWidth: 14, textAlign: 'right' },
  listContent: { flex: 1 },
  codeBlock: { borderRadius: 8, marginVertical: 8, paddingHorizontal: 16, paddingVertical: 12 },
  rule: { height: 1, marginVertical: 16 },
  image: { maxHeight: 520, width: '100%' },
  embed: { alignItems: 'center', aspectRatio: 16 / 9, borderRadius: 10, gap: 8, justifyContent: 'center', overflow: 'hidden', width: '100%' },
  embedShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.34)' },
  poll: { borderRadius: 8, borderWidth: 1, gap: 8, marginVertical: 8, padding: 12 },
  pollQuestion: { fontSize: 16, lineHeight: 24, marginBottom: 2 },
  pollOption: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 48, overflow: 'hidden', paddingHorizontal: 12 },
  pollFill: { bottom: 0, left: 0, position: 'absolute', top: 0 },
  pollLabel: { flex: 1, fontSize: 14 },
  pollResult: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  pollStatus: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', minHeight: 24, rowGap: 2 },
  pollHint: { fontSize: 13, lineHeight: 19.5, textAlign: 'right' },
});
