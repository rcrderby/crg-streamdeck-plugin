import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clockTitle } from './clock-title.ts';

describe('clockTitle', () => {
  it('carries the number for the clocks officials call by number', () => {
    assert.equal(clockTitle('Period', 1), 'PERIOD 1');
    assert.equal(clockTitle('Period', 2), 'PERIOD 2');
    assert.equal(clockTitle('Jam', 14), 'JAM 14');
  });

  it('leaves the clocks nobody counts unnumbered', () => {
    assert.equal(clockTitle('Lineup', 3), 'LINEUP');
    assert.equal(clockTitle('Timeout', 2), 'TIMEOUT');
    assert.equal(clockTitle('Intermission', 1), 'INTERMISSION');
  });

  it('omits the number before a period or jam has one', () => {
    assert.equal(clockTitle('Period', 0), 'PERIOD');
    assert.equal(clockTitle('Jam', 0), 'JAM');
  });

  it('follows the name CRG gives a clock, such as the lineup clock after a timeout', () => {
    assert.equal(clockTitle('Lineup', 3, 'Post Timeout'), 'POST TIMEOUT');
    assert.equal(clockTitle('Lineup', 3, 'Lineup'), 'LINEUP');
    assert.equal(clockTitle('Period', 2, 'Period'), 'PERIOD 2');
  });

  it('falls back to the clock’s own name when CRG sends none', () => {
    assert.equal(clockTitle('Lineup', 3, '  '), 'LINEUP');
  });
});
