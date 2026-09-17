import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HOLD_MS, holdProgress } from './hold.ts';
import { holdDial } from './icons.ts';

const AMBER = '#fbbf24';
const GROUND = '#1c1917';

describe('holdProgress', () => {
  it('runs from 0 to 1 over the hold, and stays within that range', () => {
    assert.equal(holdProgress(1000, 1000), 0);
    assert.equal(holdProgress(1000, 1000 + HOLD_MS / 2), 0.5);
    assert.equal(holdProgress(1000, 1000 + HOLD_MS), 1);
    assert.equal(holdProgress(1000, 1000 + HOLD_MS * 3), 1);
    assert.equal(holdProgress(1000, 0), 0);
  });
});

describe('holdDial', () => {
  it('draws nothing until the key is held', () => {
    assert.equal(holdDial(0, AMBER, GROUND), '');
  });

  it('keeps one color for the whole hold', () => {
    for (const level of [0.1, 0.5, 0.75, 0.9, 1]) {
      const dial = holdDial(level, AMBER, GROUND);

      assert.match(dial, /stroke="#fbbf24"/, `at ${level}`);
      assert.doesNotMatch(dial, /#ffffff/, `at ${level}`);
    }
  });

  it('fills in many small steps rather than in quarters', () => {
    assert.notEqual(holdDial(0.3, AMBER, GROUND), holdDial(0.35, AMBER, GROUND));
  });

  it('shows a full circle once the hold is complete', () => {
    const done = holdDial(1, AMBER, GROUND);

    assert.equal((done.match(/<circle/g) ?? []).length, 3);
    assert.doesNotMatch(done, /<path/);
  });
});
