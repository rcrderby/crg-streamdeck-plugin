import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runStartup, type StartupStep } from './startup.ts';

function recorder() {
  const logged: string[] = [];
  const exits: number[] = [];

  return {
    logged,
    exits,
    log: { error: (message: string) => void logged.push(message) },
    exit: (code: number) => void exits.push(code)
  };
}

/** A step that records that it ran, and fails when asked to. */
function step(name: string, ran: string[], failure?: unknown): StartupStep {
  return {
    name,
    run: () => {
      ran.push(name);

      return failure === undefined ? Promise.resolve() : Promise.reject(failure);
    }
  };
}

describe('starting the plugin', () => {
  it('runs every step in order, and stays running', async () => {
    const ran: string[] = [];
    const parts = recorder();

    const started = await runStartup(
      [step('connect to Stream Deck', ran), step('read the session', ran), step('read the settings', ran)],
      parts.log,
      parts.exit
    );

    assert.equal(started, true);
    assert.deepEqual(ran, ['connect to Stream Deck', 'read the session', 'read the settings']);
    assert.deepEqual(parts.exits, []);
    assert.deepEqual(parts.logged, []);
  });

  it('exits at the first step that fails, naming it and why', async () => {
    const ran: string[] = [];
    const parts = recorder();

    const started = await runStartup(
      [
        step('connect to Stream Deck', ran, new Error('connect ECONNREFUSED 127.0.0.1:28196')),
        step('read the settings', ran)
      ],
      parts.log,
      parts.exit
    );

    assert.equal(started, false);
    assert.deepEqual(ran, ['connect to Stream Deck'], 'nothing after the failure runs');
    assert.deepEqual(parts.exits, [1]);
    assert.deepEqual(parts.logged, [
      'Could not start: connect to Stream Deck failed: connect ECONNREFUSED 127.0.0.1:28196'
    ]);
  });

  it('says why, whatever was thrown', async () => {
    const parts = recorder();

    await runStartup([step('read the settings', [], 'no answer')], parts.log, parts.exit);

    assert.deepEqual(parts.logged, ['Could not start: read the settings failed: no answer']);
  });

  it('catches a step that throws rather than rejects', async () => {
    const parts = recorder();
    const throwing: StartupStep = {
      name: 'connect to Stream Deck',
      run: () => {
        throw new Error('missing registration arguments');
      }
    };

    assert.equal(await runStartup([throwing], parts.log, parts.exit), false);
    assert.deepEqual(parts.exits, [1]);
  });
});
