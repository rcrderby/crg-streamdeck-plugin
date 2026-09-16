/**
 * Keeps the computer awake while the plugin is connected to CRG.
 *
 * An operator can go minutes without touching the computer itself, and
 * the operating system does not count a Stream Deck press as activity.
 * While connected, a helper process holds the system's own stay-awake
 * request; when it is released, or the plugin exits, the request ends.
 *
 * macOS uses the built-in caffeinate tool, told to exit with the plugin,
 * and each key press also declares user activity. Windows holds a power
 * request through PowerShell, and is a beta until tried on Windows.
 */

import { spawn } from 'node:child_process';

/** A running helper process, reduced to what this module needs of it. */
export type Helper = {
  kill(): void;
  onError(listener: (cause: Error) => void): void;
  onExit(listener: () => void): void;
};

export type Spawn = (command: string, args: readonly string[]) => Helper;

export type Command = {
  readonly command: string;
  readonly args: readonly string[];
};

export type KeepAwakeOptions = {
  readonly platform: NodeJS.Platform;
  /** The plugin's process id, which the helper watches so it never outlives the plugin. */
  readonly pid: number;
  readonly spawn?: Spawn | undefined;
  readonly now?: (() => number) | undefined;
  readonly onError?: ((cause: Error) => void) | undefined;
};

/** Key presses closer together than this declare activity once. */
export const ACTIVITY_INTERVAL_MS = 10_000;

/**
 * Windows execution state flags: continuous, system required, display
 * required. The request lasts as long as the process that set it.
 */
const WINDOWS_STAY_AWAKE = '0x80000003';

/** How often the Windows helper checks that the plugin is still running. */
const WINDOWS_WATCH_SECONDS = 15;

function spawnHelper(command: string, args: readonly string[]): Helper {
  const child = spawn(command, [...args], { stdio: 'ignore', windowsHide: true });

  return {
    kill: () => {
      child.kill();
    },
    onError: (listener) => {
      child.on('error', listener);
    },
    onExit: (listener) => {
      child.on('exit', () => listener());
    }
  };
}

/** The PowerShell script that holds the request, and exits once the plugin is gone. */
function windowsScript(pid: number): string {
  return [
    '$signature = \'[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);\'',
    '$power = Add-Type -MemberDefinition $signature -Name PowerRequest -Namespace CrgStreamDeck -PassThru',
    `$null = $power::SetThreadExecutionState(${WINDOWS_STAY_AWAKE})`,
    `while (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds ${WINDOWS_WATCH_SECONDS} }`
  ].join('; ');
}

/** The helper that holds a stay-awake request on this platform, if there is one. */
export function holdCommand(platform: NodeJS.Platform, pid: number): Command | undefined {
  if (!Number.isInteger(pid) || pid <= 0) {
    return undefined;
  }

  if (platform === 'darwin') {
    return { command: 'caffeinate', args: ['-d', '-i', '-w', String(pid)] };
  }

  if (platform === 'win32') {
    return { command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', windowsScript(pid)] };
  }

  return undefined;
}

/** The helper that declares user activity on this platform, if there is one. */
export function activityCommand(platform: NodeJS.Platform): Command | undefined {
  return platform === 'darwin' ? { command: 'caffeinate', args: ['-u', '-t', '1'] } : undefined;
}

export class KeepAwake {
  readonly #platform: NodeJS.Platform;
  readonly #pid: number;
  readonly #spawn: Spawn;
  readonly #now: () => number;
  readonly #onError: (cause: Error) => void;

  #helper: Helper | undefined;
  #lastActivity = -Infinity;

  constructor(options: KeepAwakeOptions) {
    this.#platform = options.platform;
    this.#pid = options.pid;
    this.#spawn = options.spawn ?? spawnHelper;
    this.#now = options.now ?? Date.now;
    this.#onError = options.onError ?? (() => undefined);
  }

  /** True when this platform has a way to keep the computer awake. */
  get supported(): boolean {
    return holdCommand(this.#platform, this.#pid) !== undefined;
  }

  /** True where keeping awake has not yet been tried on real hardware. */
  get beta(): boolean {
    return this.#platform === 'win32';
  }

  get holding(): boolean {
    return this.#helper !== undefined;
  }

  /** Starts holding the computer awake. Holding again changes nothing. */
  hold(): void {
    if (this.#helper !== undefined) {
      return;
    }

    const command = holdCommand(this.#platform, this.#pid);

    if (command === undefined) {
      return;
    }

    const helper = this.#spawn(command.command, command.args);

    this.#helper = helper;

    helper.onError((cause) => {
      if (this.#helper === helper) {
        this.#helper = undefined;
      }

      this.#onError(cause);
    });

    helper.onExit(() => {
      if (this.#helper === helper) {
        this.#helper = undefined;
      }
    });
  }

  /** Lets the computer sleep again on its own settings. */
  release(): void {
    const helper = this.#helper;

    this.#helper = undefined;
    helper?.kill();
  }

  /**
   * Counts a key press as user activity, while holding.
   *
   * Presses within a few seconds of each other declare it once, so a
   * busy jam does not start a process per press.
   */
  nudge(): void {
    if (this.#helper === undefined) {
      return;
    }

    const command = activityCommand(this.#platform);
    const now = this.#now();

    if (command === undefined || now - this.#lastActivity < ACTIVITY_INTERVAL_MS) {
      return;
    }

    this.#lastActivity = now;
    this.#spawn(command.command, command.args).onError((cause) => this.#onError(cause));
  }
}
