import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

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
    // Windows PowerShell would read 0x80000003 as a negative number and refuse it
    assert.match(command?.args.at(-1) ?? '', /SetThreadExecutionState\(\[uint32\]2147483651\)/);
    assert.doesNotMatch(command?.args.at(-1) ?? '', /0x8/);
    assert.match(command?.args.at(-1) ?? '', /Get-Process -Id 4242/);
  });

  it('ends the Windows helper on any error, or when Windows refuses the request', () => {
    const script = holdCommand('win32', 4242)?.args.at(-1) ?? '';

    assert.match(script, /^\$ErrorActionPreference = 'Stop'; /);
    assert.match(script, /-eq 0\) \{ exit 1 \}/);
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

  it('starts a helper that stops on its own again, after a wait, saying so', (t) => {
    mock.timers.enable({ apis: ['setTimeout'] });
    t.after(() => mock.timers.reset());
    const fake = new FakeSpawn();
    const errors: string[] = [];
    const keepAwake = new KeepAwake({
      platform: 'win32',
      pid: 7,
      spawn: fake.spawn,
      onError: (cause) => void errors.push(cause.message),
      retryMs: 10
    });

    keepAwake.hold();
    fake.calls[0]?.exit();

    assert.equal(keepAwake.holding, false);
    assert.deepEqual(errors, ['the helper stopped on its own; starting it again in 0 seconds (1 of 3)']);

    mock.timers.tick(20);

    assert.equal(fake.calls.length, 2);
    assert.equal(keepAwake.holding, true);
  });

  it('counts a helper that both fails and exits once', (t) => {
    mock.timers.enable({ apis: ['setTimeout'] });
    t.after(() => mock.timers.reset());
    const fake = new FakeSpawn();
    const errors: string[] = [];
    const keepAwake = new KeepAwake({
      platform: 'darwin',
      pid: 7,
      spawn: fake.spawn,
      onError: (cause) => void errors.push(cause.message),
      retryMs: 10
    });

    keepAwake.hold();
    fake.calls[0]?.fail(new Error('spawn caffeinate ENOENT'));
    fake.calls[0]?.exit();
    mock.timers.tick(20);

    assert.equal(errors.length, 1);
    assert.equal(fake.calls.length, 2);
  });

  it('stays off after three starts that stop, until it is held again', (t) => {
    mock.timers.enable({ apis: ['setTimeout'] });
    t.after(() => mock.timers.reset());
    const fake = new FakeSpawn();
    const errors: string[] = [];
    const keepAwake = new KeepAwake({
      platform: 'win32',
      pid: 7,
      spawn: fake.spawn,
      onError: (cause) => void errors.push(cause.message),
      retryMs: 5
    });

    keepAwake.hold();

    for (let stop = 0; stop < 4; stop += 1) {
      fake.calls.at(-1)?.exit();
      mock.timers.tick(15);
    }

    assert.equal(fake.calls.length, 4, 'the first start and three more');
    assert.equal(keepAwake.holding, false);
    assert.equal(errors.at(-1), 'the helper stopped on its own, and stays off until CRG connects again');

    keepAwake.hold();

    assert.equal(fake.calls.length, 5, 'a new connection starts it afresh');
  });

  it('does not start a helper again once released', (t) => {
    mock.timers.enable({ apis: ['setTimeout'] });
    t.after(() => mock.timers.reset());
    const fake = new FakeSpawn();
    const keepAwake = new KeepAwake({ platform: 'win32', pid: 7, spawn: fake.spawn, retryMs: 10 });

    keepAwake.hold();
    fake.calls[0]?.exit();
    keepAwake.release();
    mock.timers.tick(20);

    assert.equal(fake.calls.length, 1);
    assert.equal(keepAwake.holding, false);
  });

  it('says nothing when a released helper exits', () => {
    const fake = new FakeSpawn();
    const errors: Error[] = [];
    const keepAwake = new KeepAwake({
      platform: 'darwin',
      pid: 7,
      spawn: fake.spawn,
      onError: (cause) => errors.push(cause)
    });

    keepAwake.hold();
    keepAwake.release();
    fake.calls[0]?.exit();

    assert.deepEqual(errors, []);
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
