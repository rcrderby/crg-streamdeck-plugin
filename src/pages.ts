/**
 * The pages of keys the plugin ships, and the Stream Deck models they fit.
 *
 * Stream Deck ties each page file to one device type, so each page ships
 * once per model, with the same keys in the top left of every one.
 * scripts/build-profiles.mjs writes the files for the same models.
 */

export type Page = 'connection' | 'undo' | 'automation';

export const PAGES: readonly Page[] = ['connection', 'undo', 'automation'];

/** The device types a page ships for, and the name each file goes by. */
export const PAGE_DEVICES: Readonly<Record<number, string>> = {
  0: 'stream-deck',
  1: 'mini',
  2: 'xl',
  3: 'mobile',
  7: 'plus',
  9: 'neo',
  10: 'studio',
  11: 'virtual',
  13: 'plus-xl'
};

/** The manifest name of a page for one device type, or undefined when none ships for that model. */
export function pageProfile(page: Page, deviceType: number): string | undefined {
  const device = PAGE_DEVICES[deviceType];

  return device === undefined ? undefined : `profiles/${page}-${device}`;
}
