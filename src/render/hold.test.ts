import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HOLD_MS, HOLD_WARNING, holdProgress } from './hold.ts';
import { holdDial } from './icons.ts';

const AMBER = '#fbbf24';
const WHITE = '#ffffff';
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
    assert.equal(holdDial(0, AMBER, WHITE, GROUND), '');
  });

  it('fills in its own color, then takes its second color at three quarters of the hold', () => {
    const early = holdDial(0.5, AMBER, WHITE, GROUND);
    const late = holdDial(HOLD_WARNING, AMBER, WHITE, GROUND);

    assert.match(early, /stroke="#fbbf24"/);
    assert.doesNotMatch(early, /#ffffff/);
    assert.match(late, /stroke="#ffffff"/);
    assert.doesNotMatch(late, /#fbbf24/);
  });

  it('fills in many small steps rather than in quarters', () => {
    assert.notEqual(holdDial(0.3, AMBER, WHITE, GROUND), holdDial(0.35, AMBER, WHITE, GROUND));
  });

  it('shows a full circle once the hold is complete', () => {
    const done = holdDial(1, AMBER, WHITE, GROUND);

    assert.equal((done.match(/<circle/g) ?? []).length, 3);
    assert.doesNotMatch(done, /<path/);
  });
});
