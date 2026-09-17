/**
 * Which CRG operator profile the deck is using.
 *
 * The plugin keeps its own settings under an operator profile rather
 * than CRG's default, and the connection key chooses which. The choice
 * is one per plugin, so it lives here and every key reads the same one.
 */

import { STREAM_DECK_OPERATOR } from './crg/operators.ts';

export class OperatorChoice {
  #name = STREAM_DECK_OPERATOR;
  readonly #listeners = new Set<() => void>();

  /** The profile in use, which is the deck's own until someone picks another. */
  get name(): string {
    return this.#name;
  }

  /** Points the plugin at a profile, telling everything that follows it. */
  set(name: string | undefined): void {
    const next = (name ?? '').trim() === '' ? STREAM_DECK_OPERATOR : (name as string).trim();

    if (next === this.#name) {
      return;
    }

    this.#name = next;

    for (const listener of this.#listeners) {
      listener();
    }
  }

  onChange(listener: () => void): void {
    this.#listeners.add(listener);
  }
}
