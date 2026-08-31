import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = (...segments) => fs.readFile(path.join(root, ...segments), 'utf8');

test('web and mobile reactions use the existing anonymous identity instead of requiring login', async () => {
  const [actions, reactionRoute, postScreen, contracts] = await Promise.all([
    source('lib', 'community', 'actions.ts'),
    source('app', 'api', 'mobile', 'v1', 'community', 'reactions', 'route.ts'),
    source('mobile', 'components', 'community', 'community-post-screen.tsx'),
    source('packages', 'contracts', 'src', 'mobile-v1.ts'),
  ]);

  assert.match(actions, /communityMutationActor/);
  assert.match(actions, /actor: \{ guestKey: guest\.key \}/);
  assert.match(reactionRoute, /getMobileCommunityActor/);
  assert.match(reactionRoute, /\{ guestKey: actor\.guest\.key \}/);
  assert.doesNotMatch(reactionRoute, /로그인이 필요합니다/);
  assert.doesNotMatch(postScreen, /requireLogin/);
  assert.match(contracts, /communityReactions: \{[^\n]+auth: "optional"/);
  assert.match(contracts, /communityReports: \{[^\n]+auth: "optional"/);
});

test('guest reports reject self-reports and persist a deduplicated guest actor', async () => {
  const [actions, reportRoute, data] = await Promise.all([
    source('lib', 'community', 'actions.ts'),
    source('app', 'api', 'mobile', 'v1', 'community', 'reports', 'route.ts'),
    source('lib', 'data', 'community.ts'),
  ]);

  assert.match(actions, /post\.guestKey === resolved\.guestKey/);
  assert.match(actions, /comment\.guestKey === resolved\.guestKey/);
  assert.match(reportRoute, /item\.guestKey === actor\.guest\.key/);
  assert.match(data, /guest_key: params\.reporterGuestKey \?\? null/);
});

test('web and mobile comment action slots delete owned comments and flag other comments', async () => {
  const [actions, mapper, mobileScreen, reportRoute, webComments, reportButton] = await Promise.all([
    source('lib', 'community', 'actions.ts'),
    source('lib', 'mobile', 'community.ts'),
    source('mobile', 'components', 'community', 'community-post-screen.tsx'),
    source('app', 'api', 'mobile', 'v1', 'community', 'reports', 'route.ts'),
    source('components', 'community', 'comment-list.tsx'),
    source('components', 'community', 'report-button.tsx'),
  ]);

  assert.match(mapper, /permissions: \{ canDelete: canManage, canEdit: canManage && comment\.contentKind === "text", canReport: !canManage \}/);
  assert.match(mobileScreen, /comment\.permissions\.canDelete[\s\S]*accessibilityLabel="댓글 삭제"[\s\S]*<Trash2/);
  assert.match(mobileScreen, /comment\.permissions\.canReport[\s\S]*accessibilityLabel="리폿"[\s\S]*<Flag/);
  assert.doesNotMatch(mobileScreen, /accessibilityLabel="리폿"[^\n]*<Ellipsis/);

  assert.match(webComments, /comment\.authorId === viewerId/);
  assert.match(webComments, /comment\.guestKey === currentGuestKey/);
  assert.match(webComments, /ownsComment\(comment\)[\s\S]*aria-label=\{pending \? "댓글 삭제 중" : "댓글 삭제"\}[\s\S]*<Trash2/);
  assert.match(webComments, /:\s*\([\s\S]*<ReportButton target="comment"/);
  assert.doesNotMatch(reportButton, /MoreVertical/);
  assert.match(reportButton, /postButton \? <><Flag[\s\S]*:\s*<Flag size=\{17\}/);
  assert.match(reportButton, /placeholder="리폿 사유"/);
  assert.match(reportButton, /reason: value/);
  assert.match(mobileScreen, /const startReport/);
  assert.match(mobileScreen, /const submitReport/);
  assert.match(mobileScreen, /reason, scope:[^\n]+\.\.\.reportTarget/);
  assert.match(mobileScreen, /<BottomSheet[^\n]+리폿[^\n]+>[\s\S]*placeholder="리폿 사유"/);
  assert.match(reportRoute, /if \(!reason\) return mobileError\("BAD_REQUEST", "리폿 사유를 입력해주세요\."/);

  assert.match(actions, /export async function deleteCommentAction/);
  assert.match(actions, /comment\.authorId === user\?\.id/);
  assert.match(actions, /comment\.guestKey === guestKey/);
  assert.match(actions, /if \(!isRegisteredOwner && !isGuestOwner\)/);
  assert.equal((actions.match(/if \(!reason\) return \{ ok: false, error: "리폿 사유를 입력해주세요\." \}/g) ?? []).length, 2);
});

test('database migration enforces one actor and one guest reaction or report per target', async () => {
  const migration = await source('supabase', 'migrations', '20260827094131_allow_guest_community_reactions_reports.sql');

  assert.equal((migration.match(/num_nonnulls\(user_id, guest_key\) = 1/g) ?? []).length, 4);
  assert.match(migration, /idx_post_honors_unique_guest/);
  assert.match(migration, /idx_post_dislikes_unique_guest/);
  assert.match(migration, /idx_comment_honors_unique_guest/);
  assert.match(migration, /idx_comment_dislikes_unique_guest/);
  assert.match(migration, /idx_post_reports_unique_guest_post/);
  assert.match(migration, /idx_post_reports_unique_guest_comment/);
  assert.match(migration, /revoke all on table public\.post_reports from anon, authenticated/);
});
