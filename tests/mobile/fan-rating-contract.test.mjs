import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('web and mobile ratings share the same validated submission service', async () => {
  const [webAction, mobileRoute, service] = await Promise.all([
    read('app/matches/[matchId]/actions.ts'),
    read('app/api/mobile/v1/matches/[matchId]/ratings/route.ts'),
    read('lib/fan-rating-submission.ts'),
  ]);

  assert.match(webAction, /submitFanRating\(/);
  assert.match(mobileRoute, /submitFanRating\(/);
  assert.match(service, /isSetRatingOpen/);
  assert.match(service, /isCommunityUserSanctioned/);
  assert.match(service, /findProfanity/);
  assert.match(service, /onConflict:\s*"set_id,player_id,author_id"/);
});

test('native rating composer uses the shared bottom sheet and authenticated API mutation', async () => {
  const [component, contracts] = await Promise.all([
    read('mobile/components/matches/match-rating-tab.tsx'),
    read('packages/contracts/src/mobile-v1.ts'),
  ]);

  assert.match(component, /<BottomSheet[\s\S]*title=\{selectedPlayer \? `\$\{selectedPlayer\.name\} 평가`/);
  assert.match(component, /mutateMobileApi<MobileFanRatingMutationDto>/);
  assert.match(component, /0\.5\)\.toFixed\(1\)/);
  assert.match(component, /maxLength=\{MAX_REVIEW_LENGTH\}/);
  assert.match(contracts, /matchRating:\s*\{ method: "POST"[\s\S]*auth: "required"/);
});

test('mobile rating set selector does not expose the narrow snapshot image button', async () => {
  const [screen, selector] = await Promise.all([
    read('mobile/app/(tabs)/matches/[matchId].tsx'),
    read('mobile/components/matches/match-set-selector.tsx'),
  ]);

  assert.doesNotMatch(screen, /snapshotUrl/);
  assert.doesNotMatch(selector, /ImageIcon|openBrowserAsync|snapshotUrl/);
});

test('mobile web and native rating copy use 14px text including the composer', async () => {
  const [webForm, webComments, nativeRating, bottomSheet] = await Promise.all([
    read('app/matches/[matchId]/set-rating-form.tsx'),
    read('app/matches/[matchId]/rating-comment-list.tsx'),
    read('mobile/components/matches/match-rating-tab.tsx'),
    read('mobile/components/bottom-sheet.tsx'),
  ]);

  assert.match(webForm, /titleClassName="!text-\[14px\]"/);
  assert.match(webForm, /p-3 text-\[14px\] leading-\[22px\]/);
  assert.match(webComments, /text-\[14px\][^"\n]*sm:text-base/);
  assert.doesNotMatch(nativeRating, /fontSize:\s*16/);
  assert.match(nativeRating, /reviewInput:\s*\{[^}]*fontSize:\s*14[^}]*lineHeight:\s*22/);
  assert.match(nativeRating, /titleStyle=\{styles\.sheetTitle\}/);
  assert.match(bottomSheet, /titleStyle\?:\s*StyleProp<TextStyle>/);
});
