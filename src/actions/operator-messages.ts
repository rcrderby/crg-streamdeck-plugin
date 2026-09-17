/**
 * What a property inspector asks the plugin about CRG operator profiles.
 *
 * The inspector cannot reach CRG, so it asks here: for the list its
 * dropdown offers, and to make a profile it does not yet hold. CRG has
 * no command for the second, since a profile comes into being as soon as
 * one of its settings is written.
 */

import streamDeck, { type SendToPluginEvent } from '@elgato/streamdeck';
import type { JsonObject, JsonValue } from '@elgato/utils';

import { crgOperatorName, operatorNames, replaceOnUndo } from '../crg/operators.ts';
import { type PluginContext } from '../context.ts';

/** The name the dropdown asks for its items under. */
export const OPERATOR_SOURCE = 'operators';

type Message = {
  event?: unknown;
  name?: unknown;
};

/** Answers the dropdown, and makes a profile when asked. Anything else is left alone. */
export async function answerOperatorMessage<T extends JsonObject>(
  context: PluginContext,
  event: SendToPluginEvent<JsonValue, T>
): Promise<void> {
  const message = event.payload as Message;

  if (message.event === OPERATOR_SOURCE) {
    await streamDeck.ui.sendToPropertyInspector({ event: OPERATOR_SOURCE, items: offered(context) });

    return;
  }

  if (message.event === 'createOperator' && typeof message.name === 'string') {
    const name = crgOperatorName(message.name);

    // The inspector offers Create only for a new name, but its list can
    // be behind CRG's, and writing to a profile that exists would change
    // its Replace on Undo.
    if (name !== '' && !operatorNames(context.client.state).includes(name)) {
      context.client.set(replaceOnUndo(name), false);
    }
  }
}

/** The profiles the dropdown offers, with the one in use among them even before CRG lists it. */
function offered(context: PluginContext): { label: string; value: string }[] {
  const names = operatorNames(context.client.state);
  const chosen = context.operator.name;
  const listed = names.includes(chosen) ? names : [chosen, ...names];

  return listed.map((name) => ({ label: name, value: name }));
}
