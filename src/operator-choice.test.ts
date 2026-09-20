import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OperatorChoice } from './operator-choice.ts';
import { STREAM_DECK_OPERATOR } from './crg/operators.ts';

describe('the operator profile the deck uses', () => {
  it('starts with the deck’s own, and takes the name it is given', () => {
    const choice = new OperatorChoice();

    assert.equal(choice.name, STREAM_DECK_OPERATOR);

    choice.set('Rose_City');

    assert.equal(choice.name, 'Rose_City');
  });

  it('falls back to the deck’s own for a blank name', () => {
    const choice = new OperatorChoice();

    choice.set('Rose_City');
    choice.set('   ');

    assert.equal(choice.name, STREAM_DECK_OPERATOR);
  });

  it('tells the keys when the profile changes, and says nothing when it does not', () => {
    const choice = new OperatorChoice();
    let told = 0;

    choice.onChange(() => (told += 1));
    choice.set('Rose_City');
    choice.set('Rose_City');
    choice.set(' Rose_City ');

    assert.equal(told, 1, 'the same profile, however it is written, is no change');
  });
});
