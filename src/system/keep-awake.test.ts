import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTIVITY_INTERVAL_MS, KeepAwake, activityCommand, holdCommand, type Helper } from './keep-awake.ts';

/** A stand-in for spawning processes, which records each one and lets a test end it. */
class FakeSpawn {
  readonly calls: {
    command: string;
    args: readonly string[];
    killed: boolean;
    exit: () => void;
    fail: (cause: Error) => void;
  }[] = [];

  readonly spawn = (command: string, args: readonly string[]): Helper => {
    let exitListener = (): void => undefined;
    let errorListener = (_cause: Error): void => undefined;
    const call = {
      command,
      args,
      killed: false,
      exit: () => exitListener(),
      fail: (cause: Error) => errorListener(cause)
    };

    this.calls.push(call);

    return {
      kill: () => {
        call.killed = true;
      },
      onError: (listener) => {
        errorListener = listener;
      },
      onExit: (listener) => {
        exitListener = listener;
      }
    };
  };
}

describe('holdCommand', () => {
  it('runs caffeinate on macOS, keeping display and system awake until the plugin exits', () => {
    assert.deepEqual(holdCommand('darwin', 4242), {
      command: '/usr/bin/caffeinate',
      args: ['-d', '-i', '-w', '4242']
    });
  });

  it('holds a power request through PowerShell on Windows, watching the plugin', () => {
    const command = holdCommand('win32', 4242, 'D:\\Windows\\');

    assert.equal(command?.command, 'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    assert.match(command?.args.at(-1) ?? '', /SetThreadExecutionState\(0x80000003\)/);
    assert.match(command?.args.at(-1) ?? '', /Get-Process -Id 4242/);
  });

  it('has nothing for other platforms, or for a process id that is not one', () => {
    assert.equal(holdCommand('linux', 4242), undefined);
    assert.equal(holdCommand('darwin', Number.NaN), undefined);
    assert.equal(holdCommand('darwin', -1), undefined);
  });
});

describe('activityCommand', () => {
  it('declares user activity on macOS only', () => {
    assert.deepEqual(activityCommand('darwin'), { command: '/usr/bin/caffeinate', args: ['-u', '-t', '1'] });
    assert.equal(activityCommand('win32'), undefined);
  });
});

describe('KeepAwake', () => {
  it('starts one helper however often it is asked to hold', () => {
    const fake = new FakeSpawn();
    const keepAwake = new KeepAwake({ platform: 'darwin', pid: 7, spawn: fake.spawn });

    keepAwake.hold();
    keepAwake.hold();

    assert.equal(fake.calls.length, 1);
    assert.equal(keepAwake.holding, true);
  });

  it('stops the helper when released', () => {
    const fake = new FakeSpawn();
    const keepAwake = new KeepAwake({ platform: 'darwin', pid: 7, spawn: fake.spawn });

    keepAwake.hold();
    keepAwake.release();

    assert.equal(fake.calls[0]?.killed, true);
    assert.equal(keepAwake.holding, false);
  });

  it('holds again after its helper exits on its own', () => {
    const fake = new FakeSpawn();
    const keepAwake = new KeepAwake({ platform: 'darwin', pid: 7, spawn: fake.spawn });

    keepAwake.hold();
    fake.calls[0]?.exit();
    keepAwake.hold();

    assert.equal(fake.calls.length, 2);
  });

  it('reports a helper that cannot start, and stops holding', () => {
    const fake = new FakeSpawn();
    const errors: Error[] = [];
    const keepAwake = new KeepAwake({
      platform: 'darwin',
      pid: 7,
      spawn: fake.spawn,
      onError: (cause) => errors.push(cause)
    });

    keepAwake.hold();
    fake.calls[0]?.fail(new Error('spawn caffeinate ENOENT'));

    assert.equal(errors.length, 1);
    assert.equal(keepAwake.holding, false);
  });

  it('does nothing on a platform it cannot keep awake', () => {
    const fake = new FakeSpawn();
    const keepAwake = new KeepAwake({ platform: 'linux', pid: 7, spawn: fake.spawn });

    keepAwake.hold();
    keepAwake.nudge();

    assert.equal(keepAwake.supported, false);
    assert.equal(fake.calls.length, 0);
  });

  it('marks Windows as a beta', () => {
    assert.equal(new KeepAwake({ platform: 'win32', pid: 7 }).beta, true);
    assert.equal(new KeepAwake({ platform: 'darwin', pid: 7 }).beta, false);
  });

  it('declares activity on a key press while holding, at most once per interval', () => {
    const fake = new FakeSpawn();
    let now = 1_000_000;
    const keepAwake = new KeepAwake({ platform: 'darwin', pid: 7, spawn: fake.spawn, now: () => now });

    keepAwake.hold();
    keepAwake.nudge();
    keepAwake.nudge();
    now += ACTIVITY_INTERVAL_MS;
    keepAwake.nudge();

    assert.deepEqual(
      fake.calls.map((call) => call.args.join(' ')),
      ['-d -i -w 7', '-u -t 1', '-u -t 1']
    );
  });

  it('declares no activity while not holding', () => {
    const fake = new FakeSpawn();
    const keepAwake = new KeepAwake({ platform: 'darwin', pid: 7, spawn: fake.spawn });

    keepAwake.nudge();

    assert.equal(fake.calls.length, 0);
  });
});
