import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detailOf, messageOf } from './errors.ts';

describe('how a failure is worded for the log', () => {
  it('gives the message of an error, and the text of anything else thrown', () => {
    assert.equal(messageOf(new Error('the disk is full')), 'the disk is full');
    assert.equal(messageOf('no answer'), 'no answer');
  });

  it('gives the stack of an unexpected error, which names where it happened', () => {
    assert.match(detailOf(new Error('boom')), /^Error: boom\n\s+at /);
    assert.equal(detailOf(42), '42');
  });
});
