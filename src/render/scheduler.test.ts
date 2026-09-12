import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RenderScheduler } from './scheduler.ts';

/** Runs the scheduler's tick by hand, so the tests do not wait on a clock. */
function manualScheduler(): { scheduler: RenderScheduler; tick: () => void } {
  let due: (() => void) | undefined;

  const setTimer = ((callback: () => void) => {
    due = callback;

    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  return {
    scheduler: new RenderScheduler(100, setTimer),
    tick: () => due?.()
  };
}

describe('RenderScheduler', () => {
  it('draws a key once for a burst of requests', () => {
    const { scheduler, tick } = manualScheduler();
    const drawn: string[] = [];

    scheduler.request('key', () => drawn.push('first'));
    scheduler.request('key', () => drawn.push('second'));
    scheduler.request('key', () => drawn.push('third'));

    assert.deepEqual(drawn, []);

    tick();

    assert.deepEqual(drawn, ['third']);
  });

  it('keeps one redraw per key', () => {
    const { scheduler, tick } = manualScheduler();
    const drawn: string[] = [];

    scheduler.request('a', () => drawn.push('a'));
    scheduler.request('b', () => drawn.push('b'));

    assert.equal(scheduler.pending, 2);

    tick();

    assert.deepEqual(drawn.sort(), ['a', 'b']);
    assert.equal(scheduler.pending, 0);
  });

  it('draws everything waiting when it is flushed', () => {
    const { scheduler } = manualScheduler();
    let drawn = 0;

    scheduler.request('a', () => (drawn += 1));
    scheduler.flush();

    assert.equal(drawn, 1);
  });

  it('draws nothing after it is cleared', () => {
    const { scheduler, tick } = manualScheduler();
    let drawn = 0;

    scheduler.request('a', () => (drawn += 1));
    scheduler.clear();
    tick();

    assert.equal(drawn, 0);
  });
});
