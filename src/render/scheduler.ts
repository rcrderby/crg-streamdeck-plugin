/**
 * Paces how often keys redraw.
 *
 * CRG sends clock updates far faster than a Stream Deck should be asked
 * to redraw, and a deck can hold thirty keys watching the same game.
 * Work is collected by key and run on a tick, so a burst of updates
 * costs one redraw per key rather than one per message.
 */

/** Ten redraws a second is as fast as a key is worth updating. */
export const DEFAULT_INTERVAL_MS = 100;

export class RenderScheduler {
  readonly #intervalMs: number;
  readonly #pending = new Map<string, () => void>();
  readonly #setTimer: typeof setTimeout;

  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(intervalMs: number = DEFAULT_INTERVAL_MS, setTimer: typeof setTimeout = setTimeout) {
    this.#intervalMs = intervalMs;
    this.#setTimer = setTimer;
  }

  /** How many keys are waiting to redraw. */
  get pending(): number {
    return this.#pending.size;
  }

  /**
   * Queues a redraw, replacing any redraw already queued for that key.
   *
   * The newest description of a key is the only one worth drawing, so
   * an earlier one is dropped rather than drawn and immediately
   * overwritten.
   */
  request(key: string, render: () => void): void {
    this.#pending.set(key, render);

    if (this.#timer === undefined) {
      this.#timer = this.#setTimer(() => this.flush(), this.#intervalMs);
    }
  }

  /** Runs every queued redraw now. */
  flush(): void {
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }

    const due = [...this.#pending.values()];

    this.#pending.clear();

    for (const render of due) {
      render();
    }
  }

  /** Drops everything queued and stops the tick. */
  clear(): void {
    this.#pending.clear();

    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }
}
