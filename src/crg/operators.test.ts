import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { SETTINGS_ROOT, REGISTERED_PATHS } from './paths.ts';
import { STREAM_DECK_OPERATOR, crgOperatorName, operatorNames, operatorSetting, replaceOnUndo } from './operators.ts';
import { StateStore } from './state.ts';

/** A scoreboard holding one setting for each name given. */
function scoreboard(...names: string[]): StateStore {
  const state = new StateStore();

  state.apply({
    ...Object.fromEntries(names.map((name) => [operatorSetting(name, 'ReplaceButton'), false])),
    'ScoreBoard.Settings.Setting(ScoreBoard.Operator_Default.ReplaceButton)': false,
    'ScoreBoard.Settings.Setting(ScoreBoard.Intermission.PreGame)': 'Time To Derby'
  });

  return state;
}

describe('operator settings', () => {
  it('address one setting of a named profile', () => {
    assert.equal(
      replaceOnUndo('StreamDeck'),
      'ScoreBoard.Settings.Setting(ScoreBoard.Operator.StreamDeck.ReplaceButton)'
    );
  });

  it('are found under the settings the plugin registers for', () => {
    assert.ok(REGISTERED_PATHS.includes(SETTINGS_ROOT));
    assert.ok(replaceOnUndo('StreamDeck').startsWith(SETTINGS_ROOT));
  });
});

describe('crgOperatorName', () => {
  it('makes the name CRG will store, not always the one typed', () => {
    assert.equal(crgOperatorName('Rose City'), 'Rose_City');
    assert.equal(crgOperatorName(' Tara.Byte '), 'Tara_Byte');
    assert.equal(crgOperatorName('Head (NSO)'), 'Head__NSO_');
  });

  it('leaves a name CRG would keep as it is', () => {
    assert.equal(crgOperatorName('StreamDeck'), 'StreamDeck');
  });
});

describe('operatorNames', () => {
  it('reads the profiles out of the settings keys, in alphabetical order', () => {
    assert.deepEqual(operatorNames(scoreboard('wheels', 'Andy', 'TaraByte')), ['Andy', 'TaraByte', 'wheels']);
  });

  it('leaves out CRG’s own default, which is not a profile anyone picks', () => {
    assert.deepEqual(operatorNames(scoreboard('default', 'Andy')), ['Andy']);
  });

  it('names a profile once, however many settings it holds', () => {
    const state = scoreboard('Andy');

    state.apply({ [operatorSetting('Andy', 'TabBar')]: true, [operatorSetting('Andy', 'Auto5')]: false });

    assert.deepEqual(operatorNames(state), ['Andy']);
  });

  it('finds none before CRG has sent its settings', () => {
    assert.deepEqual(operatorNames(new StateStore()), []);
  });
});

describe('the property inspector', () => {
  it('names the same profile the plugin makes, so the two cannot drift', () => {
    const script = readFileSync(
      new URL('../../com.rcrderby.crg-streamdeck.sdPlugin/ui/operators.js', import.meta.url),
      'utf8'
    );

    assert.ok(
      script.includes(`const OWN_PROFILE = '${STREAM_DECK_OPERATOR}';`),
      `ui/operators.js should hold OWN_PROFILE = '${STREAM_DECK_OPERATOR}'`
    );
  });

  it('rewrites a name the way CRG does', () => {
    const script = readFileSync(
      new URL('../../com.rcrderby.crg-streamdeck.sdPlugin/ui/operators.js', import.meta.url),
      'utf8'
    );

    assert.match(script, /const REWRITTEN = \/\[\.\(\) \]\/g;/);
  });
});
