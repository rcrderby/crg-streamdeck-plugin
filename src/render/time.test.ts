import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatClock } from './time.ts';

describe('formatClock', () => {
  it('formats a jam clock', () => {
    assert.equal(formatClock(120_000), '2:00');
    assert.equal(formatClock(83_000), '1:23');
  });

  it('pads the seconds', () => {
    assert.equal(formatClock(5_000), '0:05');
  });

  it('rounds down to the second, as a scoreboard does', () => {
    assert.equal(formatClock(5_999), '0:05');
  });

  it('shows hours only once there are hours', () => {
    assert.equal(formatClock(3_600_000), '1:00:00');
    assert.equal(formatClock(3_599_000), '59:59');
  });

  it('never shows a negative clock', () => {
    assert.equal(formatClock(-1), '0:00');
  });
});
