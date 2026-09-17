import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatClock, parseClock } from './time.ts';

describe('formatClock', () => {
  it('formats a jam clock', () => {
    assert.equal(formatClock(120_000), '2:00');
    assert.equal(formatClock(83_000), '1:23');
  });

  it('pads the seconds', () => {
    assert.equal(formatClock(5_000), '0:05');
  });

  it('rounds a clock counting up down to the second, as CRG’s scoreboard does', () => {
    assert.equal(formatClock(5_999), '0:05');
  });

  it('rounds a clock counting down up to the second, as CRG’s scoreboard does', () => {
    assert.equal(formatClock(119_001, true), '2:00');
    assert.equal(formatClock(400, true), '0:01');
    assert.equal(formatClock(0, true), '0:00');
  });

  it('shows hours only once there are hours', () => {
    assert.equal(formatClock(3_600_000), '1:00:00');
    assert.equal(formatClock(3_599_000), '59:59');
  });

  it('never shows a negative clock', () => {
    assert.equal(formatClock(-1), '0:00');
  });
});

describe('parseClock', () => {
  it('reads a clock CRG holds as text', () => {
    assert.equal(parseClock('0:30'), 30_000);
    assert.equal(parseClock('1:00'), 60_000);
    assert.equal(parseClock('1:02:03'), 3_723_000);
    assert.equal(parseClock(' 0:30 '), 30_000);
  });

  it('reads nothing from a value that is not a clock', () => {
    for (const value of ['', 'soon', '0:3a', '::', '1:2:3:4']) {
      assert.equal(parseClock(value), 0, value);
    }
  });
});
