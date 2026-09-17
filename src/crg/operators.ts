/**
 * The operator profiles CRG keeps, and the names it accepts for them.
 *
 * CRG holds no list of operators. Its own login screen reads every
 * scoreboard setting and takes the names out of the keys, which is what
 * this does. A profile exists as soon as one setting is written under
 * its name, so creating one is a write rather than a command.
 */

import { type StateStore } from './state.ts';

/** Where CRG keeps the settings of an operator it knows by name. */
export const OPERATOR_PREFIX = 'ScoreBoard.Settings.Setting(ScoreBoard.Operator.';

/** CRG's fallback operator, which is not a profile anyone picks. */
export const DEFAULT_OPERATOR = 'default';

/** The profile the plugin makes for itself, and uses until an operator picks another. */
export const STREAM_DECK_OPERATOR = 'StreamDeck';

/** Reads or writes one setting of a named operator. */
export function operatorSetting(operator: string, field: string): string {
  return `${OPERATOR_PREFIX}${operator}.${field})`;
}

/** Enable Replace on Undo for one operator, which is the setting the Undo key follows. */
export function replaceOnUndo(operator: string): string {
  return operatorSetting(operator, 'ReplaceButton');
}

/**
 * The name CRG will store, which is not always the name typed.
 *
 * CRG replaces spaces, dots, and parentheses when an operator logs in,
 * so 'Rose City' is kept as 'Rose_City'.
 */
export function crgOperatorName(typed: string): string {
  return typed.trim().replaceAll(/[.() ]/g, '_');
}

/**
 * Every operator CRG holds a setting for, in the order a list shows them.
 *
 * CRG's own fallback operator and any blank name are left out, since
 * neither is a profile anyone would choose.
 */
export function operatorNames(state: StateStore): string[] {
  const names = new Set<string>();

  for (const [path] of state.startingWith(OPERATOR_PREFIX)) {
    const name = path.slice(OPERATOR_PREFIX.length).split('.')[0] ?? '';

    if (name.trim() !== '' && name !== DEFAULT_OPERATOR) {
      names.add(name);
    }
  }

  return [...names].sort((first, second) => first.localeCompare(second));
}
