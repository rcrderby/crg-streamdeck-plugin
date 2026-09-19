/**
 * The seconds the Timeout Before Period End page leaves on the period clock.
 *
 * Its keys share one count, which starts at one second each time the
 * page opens and never drops below zero. The count is one per plugin, so
 * it lives here and every key reads the same one.
 */

/** The count the page opens with. */
export const PERIOD_END_START_SECONDS = 1;

export class PeriodEndSeconds {
  #value = PERIOD_END_START_SECONDS;
  readonly #listeners = new Set<() => void>();

  get value(): number {
    return this.#value;
  }

  /** Moves the count by a number of seconds, stopping at zero. */
  step(by: number): void {
    this.#set(this.#value + by);
  }

  /** Puts the count back to the one second the page opens with. */
  reset(): void {
    this.#set(PERIOD_END_START_SECONDS);
  }

  onChange(listener: () => void): void {
    this.#listeners.add(listener);
  }

  #set(value: number): void {
    const next = Math.max(0, value);

    if (next === this.#value) {
      return;
    }

    this.#value = next;

    for (const listener of this.#listeners) {
      listener();
    }
  }
}
