/** How the plugin words a failure for its log. */

/** An error's message, whatever was thrown. */
export function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * An error's stack, or its message when it has none.
 *
 * For the failures nobody expected, where where it happened is what
 * finding the cause needs.
 */
export function detailOf(cause: unknown): string {
  return cause instanceof Error && cause.stack !== undefined ? cause.stack : messageOf(cause);
}
