import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PULSE_FAINTEST, PULSE_MS, SECOND_PULSE_MS, pulseOpacity, pulsePhase } from './pulse.ts';
import { resourceDots } from './icons.ts';

describe('pulseOpacity', () => {
  it('starts each pulse at full, and is faintest halfway through', () => {
    assert.equal(pulseOpacity(0), 1);
    assert.equal(pulseOpacity(PULSE_MS), 1);
    assert.equal(pulseOpacity(PULSE_MS / 2), PULSE_FAINTEST);
  });

  it('stays between its faintest and full', () => {
    for (let now = 0; now < PULSE_MS * 2; now += 37) {
      const opacity = pulseOpacity(now);

      assert.ok(opacity >= PULSE_FAINTEST && opacity <= 1, String(now));
    }
  });
});

describe('resourceDots while a timeout or review runs', () => {
  it('pulses the dot the timeout used, at the position of the count left', () => {
    const circles = resourceDots(3, 1, '#ffffff', 80, undefined, 0.5).match(/<circle[^>]*>/g) ?? [];

    assert.doesNotMatch(circles[0] ?? '', /opacity/);
    assert.match(circles[1] ?? '', /fill="#ffffff" opacity="0.5"/);
    assert.match(circles[2] ?? '', /fill="none"/);
  });

  it('pulses the review mark in the last place, drawn as it was before the review', () => {
    const svg = resourceDots(1, 0, '#ffffff', 80, 'retained', 0.4);

    assert.equal((svg.match(/<line/g) ?? []).length, 2);
    assert.equal((svg.match(/opacity="0.4"/g) ?? []).length, 2);
  });

  it('draws the same dots as before when nothing is running', () => {
    assert.equal(resourceDots(3, 2, '#ffffff'), resourceDots(3, 2, '#ffffff', 80, undefined, undefined));
  });
});

describe('pulsePhase', () => {
  it('keeps a whole swing to the second when asked for one', () => {
    assert.equal(pulsePhase(0, SECOND_PULSE_MS), 0);
    assert.equal(pulsePhase(SECOND_PULSE_MS / 2, SECOND_PULSE_MS), 1);
    assert.equal(pulsePhase(SECOND_PULSE_MS, SECOND_PULSE_MS), 0);
  });

  it('runs from nothing to all and back within one pulse', () => {
    assert.equal(pulsePhase(0), 0);
    assert.equal(pulsePhase(PULSE_MS / 2), 1);
    assert.equal(pulsePhase(PULSE_MS), 0);
  });

  it('repeats every pulse, whichever side of zero the moment falls', () => {
    assert.equal(pulsePhase(PULSE_MS * 3.5), pulsePhase(PULSE_MS / 2));
    assert.equal(pulsePhase(-PULSE_MS / 2), pulsePhase(PULSE_MS / 2));
  });
});
