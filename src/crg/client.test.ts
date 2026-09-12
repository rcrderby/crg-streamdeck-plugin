import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readSessionCookies } from './client.ts';

describe('readSessionCookies', () => {
  it('reads the cookie CRG 2027 sets', () => {
    const header =
      'CRG_SCOREBOARD=node0rsql88rbnu5tj0kg5610wgu6.node0; Path=/; ' +
      'Expires=Sun, 27-Sep-2026 17:41:29 GMT; Max-Age=1296000; HttpOnly; SameSite=Lax';

    assert.equal(readSessionCookies([header]), 'CRG_SCOREBOARD=node0rsql88rbnu5tj0kg5610wgu6.node0');
  });

  it('reads a cookie under any name, because CRG chooses it', () => {
    assert.equal(readSessionCookies(['JSESSIONID=abc123; Path=/']), 'JSESSIONID=abc123');
  });

  it('keeps every cookie it is sent', () => {
    const value = readSessionCookies(['A=1; Path=/', 'B=2; HttpOnly']);

    assert.equal(value, 'A=1; B=2');
  });

  it('returns nothing when no cookie was set', () => {
    assert.equal(readSessionCookies([]), undefined);
    assert.equal(readSessionCookies(['Path=/; HttpOnly']), undefined);
  });
});
