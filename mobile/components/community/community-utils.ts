import type { MobileCommunityPostSummary, TiptapDocument, TiptapNode } from '@/lib/api-client';

export const HUB_BOARDS = [
  { label: '실시간', slug: 'live' },
  { label: '분석', slug: 'analysis' },
  { label: '토론', slug: 'discussion' },
  { label: '소식', slug: 'news' },
  { label: '전략', slug: 'strategy' },
  { label: '질문', slug: 'question' },
  { label: '자유', slug: 'free' },
] as const;

export const COMMENT_MAX_LENGTH = 200;
export const POST_TEXT_MAX_LENGTH = 60_000;
export const POST_TITLE_MAX_LENGTH = 100;

export function boardLabel(slug: string) {
  return HUB_BOARDS.find((board) => board.slug === slug)?.label ?? slug;
}

export function displayAuthor(author: MobileCommunityPostSummary['author']) {
  return author.nickname ?? author.guestIpLabel ?? '작성자 없음';
}

export function formatCommunityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 60_000) return '방금 전';
  if (elapsed >= 0 && elapsed < 60 * 60_000) return `${Math.floor(elapsed / 60_000)}분 전`;
  if (elapsed >= 0 && elapsed < 24 * 60 * 60_000) return `${Math.floor(elapsed / (60 * 60_000))}시간 전`;
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`;
}

export function emptyTiptapDocument(): TiptapDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function tiptapTextLength(document: TiptapDocument) {
  let length = 0;
  const visit = (node: TiptapNode) => {
    if (node.type === 'text' && node.text) length += node.text.length;
    node.content?.forEach(visit);
  };
  document.content?.forEach(visit);
  return length;
}

export function isTiptapEmpty(document: TiptapDocument) {
  let content = false;
  const visit = (node: TiptapNode) => {
    if (node.type === 'text' && node.text?.trim()) content = true;
    if (['image', 'imageResize', 'youtube', 'embed', 'poll'].includes(node.type)) content = true;
    node.content?.forEach(visit);
  };
  document.content?.forEach(visit);
  return !content;
}
