/**
 * Opening the plugin's pages of keys, and returning from them.
 *
 * A page is a profile the plugin ships. Stream Deck asks the operator to
 * add it the first time the plugin opens it on a device.
 */

import streamDeck from '@elgato/streamdeck';

import { type Page, pageProfile } from '../pages.ts';

type OnDevice = { readonly device: { readonly id: string; readonly type: number } };

/** Switches the key's device to one of the plugin's pages, and reports false when none ships for that model. */
export async function openPage(action: OnDevice, page: Page): Promise<boolean> {
  const profile = pageProfile(page, action.device.type);

  if (profile === undefined) {
    return false;
  }

  await streamDeck.profiles.switchToProfile(action.device.id, profile);

  return true;
}

/** Returns the key's device to the profile it showed before the page opened. */
export function returnToLayout(action: OnDevice): Promise<void> {
  return streamDeck.profiles.switchToProfile(action.device.id);
}

/**
 * Moves from one of the plugin's pages to another.
 *
 * Stream Deck returns a device to the profile it showed before the last
 * switch, so going straight from page to page would make Back return to
 * the page just left. Going by way of the layout keeps the layout as the
 * profile every page returns to.
 */
export async function movePage(action: OnDevice, page: Page): Promise<boolean> {
  if (pageProfile(page, action.device.type) === undefined) {
    return false;
  }

  await returnToLayout(action);

  return openPage(action, page);
}
