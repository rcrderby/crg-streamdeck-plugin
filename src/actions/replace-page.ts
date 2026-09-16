/**
 * The keys on the Undo page, which shows CRG's replace menu.
 *
 * Replace on Undo undoes the last clock action and stops every clock
 * until the operator chooses what happens instead. The page shows the
 * same choices as CRG's own screen: what is being replaced, the controls
 * CRG allows now, and CRG's No Action, which keeps the plain undo. Each
 * needs a hold. The deck leaves the page as soon as CRG's replace menu
 * closes, whoever closed it, and Back leaves without answering it. The
 * keys are never veiled.
 */

import { type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { game, label } from '../crg/paths.ts';
import { type ReplaceChoice as Choice, replaceChoices, replacePending } from '../crg/game-state.ts';
import { type KeySpec } from '../render/key.ts';
import { blankKey, replaceChoiceKey, replaceConfirmKey, replaceInfoKey } from '../render/designs.ts';
import { type PluginContext } from '../context.ts';
import { CrgKeyAction } from './key-action.ts';
import { HoldKeyAction } from './hold-key-action.ts';
import { returnToLayout } from './navigation.ts';

const REPLACED = label('Replaced');

/** What CRG shows on its Undo button while a replacement waits. */
const NO_ACTION = 'No Action';

/** The first key: what CRG is waiting to replace, in CRG's own words. */
export class ReplaceInfo extends CrgKeyAction {
  /** Takes the deck off the page once CRG's replace menu closes, whether a key here closed it or the operator screen did. */
  constructor(context: PluginContext) {
    super(context);

    context.client.state.subscribe([REPLACED], () => {
      if (replacePending(context.client.state)) {
        return;
      }

      for (const key of this.visibleKeys) {
        void returnToLayout(key);
      }
    });
  }

  protected override watchedPaths(): readonly string[] {
    return [REPLACED];
  }

  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(): KeySpec {
    return replaceInfoKey(this.context.client.state.getString(REPLACED));
  }
}

/**
 * CRG's No Action, which is CRG's Undo button while a replacement waits.
 *
 * It sends what CRG's own button sends, which answers the menu with No
 * Action and keeps the plain undo. Leaving the page is not this key's
 * job: the deck goes back when CRG closes the menu, however it closed.
 */
export class ReplaceConfirm extends HoldKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [label('Undo'), REPLACED];
  }

  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(_settings: object, actionId: string): KeySpec {
    const text = this.context.client.state.getString(label('Undo'));

    return replaceConfirmKey(text === '' ? NO_ACTION : text, this.holdLevel(actionId));
  }

  protected override completeHold(): void {
    this.context.client.trigger(game('ClockReplace'));
  }
}

type ChoiceSettings = JsonObject & {
  slot?: number | string;
};

/** Which of CRG's allowed choices a key shows, counting from 0. */
function slotOf(settings: ChoiceSettings): number {
  const slot = Number(settings.slot);

  return Number.isInteger(slot) && slot >= 0 ? slot : 0;
}

/**
 * One of the choices CRG allows in place of the undone action.
 *
 * The page holds three of these. The choices CRG allows fill them from
 * the first, and a key with no choice left for it stays blank.
 */
export class ReplaceChoice extends HoldKeyAction<ChoiceSettings> {
  protected override watchedPaths(): readonly string[] {
    return [label('Start'), label('Stop'), label('Timeout'), REPLACED];
  }

  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(settings: ChoiceSettings, actionId: string): KeySpec {
    const choice = this.#choice(settings);

    return choice === undefined ? blankKey() : replaceChoiceKey(choice.text, choice.kind, this.holdLevel(actionId));
  }

  protected override canHold(settings: ChoiceSettings): boolean {
    return this.#choice(settings) !== undefined;
  }

  /** A blank key does nothing when pressed, not even an alert. */
  override onKeyDown(event: KeyDownEvent<ChoiceSettings>): void | Promise<void> {
    if (this.#choice(event.payload.settings) === undefined) {
      return undefined;
    }

    return super.onKeyDown(event);
  }

  protected override async completeHold(action: KeyAction<ChoiceSettings>, settings: ChoiceSettings): Promise<void> {
    const choice = this.#choice(settings);

    if (choice === undefined) {
      await action.showAlert();

      return;
    }

    this.context.client.trigger(game(choice.command));
  }

  #choice(settings: ChoiceSettings): Choice | undefined {
    const state = this.context.client.state;

    return replacePending(state) ? replaceChoices(state)[slotOf(settings)] : undefined;
  }
}
