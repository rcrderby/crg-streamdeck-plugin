/**
 * The scoreboard state the plugin holds, and the subscriptions that
 * read it.
 *
 * CRG sends deltas: a message carries only the paths that changed, and
 * a null value means the path was deleted. Subscribers name the paths
 * they draw from, and hear about a batch once, rather than once per
 * path in it.
 */

/** A value CRG sends. A deleted path arrives as null. */
export type StateValue = string | number | boolean | null;

/** Called with the paths that changed in one message. */
export type StateListener = (changed: ReadonlySet<string>) => void;

type Subscription = {
  readonly matches: (path: string) => boolean;
  readonly listener: StateListener;
};

/**
 * Builds a matcher for a CRG path pattern.
 *
 * A '*' stands for one path component or one argument inside
 * parentheses, which is how CRG's own pages register for a group of
 * paths such as 'Team(*).Score'.
 */
export function toPattern(path: string): RegExp {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '[^.()]*')}$`);
}

export class StateStore {
  readonly #values = new Map<string, StateValue>();
  readonly #subscriptions = new Set<Subscription>();

  /** Every path currently held. */
  get size(): number {
    return this.#values.size;
  }

  /** The raw value at a path, or undefined when CRG has not sent one. */
  get(path: string): StateValue | undefined {
    return this.#values.get(path);
  }

  /** The value at a path as text, or the fallback when it is absent or empty. */
  getString(path: string, fallback = ''): string {
    const value = this.#values.get(path);

    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return String(value);
  }

  /** The value at a path as a number, or the fallback when it does not read as one. */
  getNumber(path: string, fallback = 0): number {
    const value = this.#values.get(path);

    if (value === undefined || value === null || value === '' || typeof value === 'boolean') {
      return fallback;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * The value at a path as a flag.
   *
   * CRG sends booleans as JSON booleans, and older builds send the
   * strings 'true' and 'false', so both are read.
   */
  getBoolean(path: string, fallback = false): boolean {
    const value = this.#values.get(path);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    return fallback;
  }

  /** Every held path under a prefix, with its value. */
  startingWith(prefix: string): [string, StateValue][] {
    return [...this.#values].filter(([path]) => path.startsWith(prefix));
  }

  /**
   * Every held path that matches a pattern, with its value.
   *
   * A star matches one path component or argument, as in a
   * subscription, so 'Period(*).Timeout(*).Running' finds every timeout
   * in every period.
   */
  matching(path: string): [string, StateValue][] {
    const pattern = toPattern(path);

    return [...this.#values].filter(([held]) => pattern.test(held));
  }

  /**
   * Applies one delta from CRG and tells the subscriptions it touched.
   *
   * A path whose value is unchanged is not reported, so a message that
   * repeats what is already held redraws nothing.
   */
  apply(delta: Readonly<Record<string, StateValue>>): ReadonlySet<string> {
    const changed = new Set<string>();

    for (const [path, value] of Object.entries(delta)) {
      if (value === null) {
        if (this.#values.delete(path)) {
          changed.add(path);
        }

        continue;
      }

      if (this.#values.get(path) !== value) {
        this.#values.set(path, value);
        changed.add(path);
      }
    }

    if (changed.size > 0) {
      this.#notify(changed);
    }

    return changed;
  }

  /** Forgets everything, so a reconnect starts from what CRG sends next. */
  clear(): void {
    this.#values.clear();
  }

  /**
   * Calls the listener whenever one of the paths changes.
   *
   * Returns the function that ends the subscription.
   */
  subscribe(paths: readonly string[], listener: StateListener): () => void {
    const patterns = paths.map(toPattern);

    return this.#add({ matches: (path) => patterns.some((pattern) => pattern.test(path)), listener });
  }

  /**
   * Calls the listener whenever any path under a prefix changes.
   *
   * CRG keeps a settings name inside parentheses, dots and all, which no
   * wildcard reaches, so a subtree is followed by its prefix instead.
   */
  subscribePrefix(prefix: string, listener: StateListener): () => void {
    return this.#add({ matches: (path) => path.startsWith(prefix), listener });
  }

  #add(subscription: Subscription): () => void {
    this.#subscriptions.add(subscription);

    return () => {
      this.#subscriptions.delete(subscription);
    };
  }

  #notify(changed: ReadonlySet<string>): void {
    const paths = [...changed];

    for (const subscription of this.#subscriptions) {
      if (paths.some((path) => subscription.matches(path))) {
        subscription.listener(changed);
      }
    }
  }
}
