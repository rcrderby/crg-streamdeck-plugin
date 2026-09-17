/**
 * The game's own controls: Timeout, Official Timeout, and Undo.
 *
 * The two timeout keys are red, and show the top bar like every key that
 * can be active: green while their kind of timeout is running, gray
 * otherwise. Undo stands apart on hazard striping and needs a hold,
 * since a stray press can undo something that matters.
 */

import { type DidReceiveSettingsEvent, type KeyAction, type SendToPluginEvent } from '@elgato/streamdeck';
import type { JsonObject, JsonValue } from '@elgato/utils';

import { TIMEOUTS, game, isUnavailable, label } from '../crg/paths.ts';
import { replaceOnUndo } from '../crg/operators.ts';
import { type TimeoutKind, replacePending, runningTimeout } from '../crg/game-state.ts';
import { type KeySpec } from '../render/key.ts';
import { timeoutKey, undoKey } from '../render/designs.ts';
import { pageProfile } from '../pages.ts';
import { type PluginContext } from '../context.ts';
import { CrgKeyAction } from './key-action.ts';
import { HoldKeyAction } from './hold-key-action.ts';
import { answerOperatorMessage } from './operator-messages.ts';
import { openPage } from './navigation.ts';

abstract class TimeoutControl extends CrgKeyAction {
  protected abstract get lines(): readonly string[];

  /** The kind of running timeout this key shows as active. */
  protected abstract get kind(): TimeoutKind;

  /** The CRG control this key triggers. */
  protected abstract get control(): string;

  protected override watchedPaths(): readonly string[] {
    return [TIMEOUTS.running, game('TimeoutOwner'), game('OfficialReview'), 'ScoreBoard.CurrentGame.Team(*).Id'];
  }

  protected override describe(): KeySpec {
    return timeoutKey(this.lines, runningTimeout(this.context.client.state).kind === this.kind);
  }

  override onKeyDown(): void {
    this.context.client.trigger(this.control);
  }
}

export class Timeout extends TimeoutControl {
  protected override get lines(): readonly string[] {
    return ['Timeout'];
  }

  protected override get kind(): TimeoutKind {
    return 'untyped';
  }

  protected override get control(): string {
    return game('Timeout');
  }
}

export class OfficialTimeout extends TimeoutControl {
  protected override get lines(): readonly string[] {
    return ['Official', 'Timeout'];
  }

  protected override get kind(): TimeoutKind {
    return 'official';
  }

  protected override get control(): string {
    return game('OfficialTimeout');
  }
}

type UndoSettings = JsonObject & {
  /** What CRG holds for Replace on Undo, shown and set by the switch in the key's settings. */
  replaceOnUndo?: boolean | string;
};

function usesReplaceOnUndo(settings: UndoSettings): boolean {
  return settings.replaceOnUndo === true || settings.replaceOnUndo === 'true';
}

/**
 * Undo follows CRG's own undo control once held, and is subdued when CRG has nothing to undo.
 *
 * Replace on Undo is CRG's setting, kept under the deck's own operator
 * profile, so the key's switch shows and changes what CRG holds. While
 * it is on, the hold undoes, asks CRG to wait for a replacement, and
 * opens the Undo page. When CRG is already waiting it only opens the
 * page. The key carries the top bar then, green while CRG waits. On a
 * model with no Undo page it simply undoes.
 */
export class Undo extends HoldKeyAction<UndoSettings> {
  #unfollow: (() => void) | undefined;

  /** Follows CRG's setting, and moves with the profile when the choice changes. */
  constructor(context: PluginContext) {
    super(context);

    this.#follow();
    context.operator.onChange(() => {
      this.#follow();
      this.#showWhatCrgHolds();
      this.redrawAll();
    });
  }

  protected override watchedPaths(): readonly string[] {
    return [label('Undo'), label('Replaced')];
  }

  protected override describe(settings: UndoSettings, actionId: string): KeySpec {
    const level = this.holdLevel(actionId);
    const key = this.#replacing(settings) ? undoKey(level, replacePending(this.context.client.state)) : undoKey(level);

    return this.canHold() ? key : { ...key, subdued: true };
  }

  /** Lists the CRG operator profiles for the settings dropdown. */
  override onSendToPlugin(event: SendToPluginEvent<JsonValue, UndoSettings>): Promise<void> {
    return answerOperatorMessage(this.context, event);
  }

  /** Using the key's switch sets Replace on Undo for the deck's operator profile, which CRG creates on the first write. */
  override onDidReceiveSettings(event: DidReceiveSettingsEvent<UndoSettings>): void {
    super.onDidReceiveSettings(event);

    const wanted = usesReplaceOnUndo(event.payload.settings);

    if (wanted !== this.#held()) {
      this.context.client.set(this.#path(), wanted);
    }
  }

  protected override canHold(): boolean {
    return !isUnavailable(this.context.client.state.getString(label('Undo')));
  }

  /**
   * What CRG holds, or undefined until CRG has said.
   *
   * An absent setting is not a false one: CRG has simply never been told,
   * which is how a scoreboard looks before anyone uses the switch.
   */
  #held(): boolean | undefined {
    const state = this.context.client.state;
    const path = this.#path();

    return state.get(path) === undefined ? undefined : state.getBoolean(path);
  }

  /** Where the chosen operator profile keeps the setting. */
  #path(): string {
    return replaceOnUndo(this.context.operator.name);
  }

  /** Watches the chosen profile's setting, dropping the profile watched before. */
  #follow(): void {
    this.#unfollow?.();
    this.#unfollow = this.context.client.state.subscribe([this.#path()], () => {
      this.#showWhatCrgHolds();
      this.redrawAll();
    });
  }

  /** CRG's setting, falling back to what the key remembers until CRG has said. */
  #replacing(settings: UndoSettings): boolean {
    return this.#held() ?? usesReplaceOnUndo(settings);
  }

  /** Writes CRG's value into each key's settings, which is what the property inspector reads. */
  #showWhatCrgHolds(): void {
    const held = this.#held();

    if (held === undefined) {
      return;
    }

    for (const key of this.visibleKeys) {
      const settings = this.settingsOf(key.id);

      if (settings !== undefined && usesReplaceOnUndo(settings) !== held) {
        void key.setSettings({ ...settings, replaceOnUndo: held });
      }
    }
  }

  protected override async completeHold(action: KeyAction<UndoSettings>, settings: UndoSettings): Promise<void> {
    const client = this.context.client;
    const replacing = this.#replacing(settings) && pageProfile('undo', action.device.type) !== undefined;

    if (!replacing) {
      client.trigger(game('ClockUndo'));

      return;
    }

    if (!replacePending(client.state)) {
      client.trigger(game('ClockReplace'));
    }

    await openPage(action, 'undo');
  }
}
