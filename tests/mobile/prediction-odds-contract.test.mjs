import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('mobile web hides prediction odds while retaining desktop odds', async () => {
  const sources = await Promise.all([
    read('app/predictions/prediction-board.tsx'),
    read('components/domain/prediction-match-bar.tsx'),
    read('components/domain/prediction-market-line.tsx'),
  ]);

  for (const source of sources) {
    assert.match(source, /hidden[^"\n]*sm:inline/);
    assert.match(source, /teamAOdds/);
    assert.match(source, /teamBOdds/);
  }
});

test('native prediction cards do not render odds', async () => {
  const sources = await Promise.all([
    read('mobile/components/predictions/prediction-match-card.tsx'),
    read('mobile/components/matches/match-preview-tab.tsx'),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(source, /teamAOdds|teamBOdds|oddsLabel|choiceOdds|\b배\b/);
    assert.match(source, /teamAPercent/);
    assert.match(source, /teamBPercent/);
  }
});
