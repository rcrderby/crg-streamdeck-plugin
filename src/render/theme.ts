/**
 * Team colors, and the guards around the text CRG supplies.
 *
 * Team names and colors are typed by an operator and drawn into an SVG,
 * so both are checked here rather than at each call site: text is
 * escaped, and a color is used only when it reads as a hex color.
 */

import { type StateStore } from '../crg/state.ts';
import { type TeamNumber, team, teamColor } from '../crg/paths.ts';

/** The colors one team's keys are drawn in. */
export type TeamTheme = {
  readonly background: string;
  readonly foreground: string;
  readonly glow: string | undefined;
  readonly name: string;
};

/** Drawn when CRG offers no color for a team. */
export const DEFAULT_BACKGROUND = '#111111';

export const DEFAULT_FOREGROUND = '#ffffff';

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
};

/** Escapes text so it cannot change the markup it is placed in. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);
}

/** Returns the color when it is a hex color, and the fallback when it is not. */
export function safeColor(value: string | undefined, fallback: string): string {
  return value !== undefined && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

/**
 * The relative luminance of a hex color, per WCAG.
 *
 * Short forms are expanded first, and any alpha channel is ignored
 * because a key is drawn over an opaque background.
 */
export function luminance(color: string): number {
  const hex = color.replace('#', '');
  const full = hex.length <= 4 ? [...hex].map((character) => character + character).join('') : hex;
  const channels = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255);

  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The WCAG contrast ratio between two hex colors, from 1 to 21. */
export function contrastRatio(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Picks the readable foreground for a background.
 *
 * A league chooses its own operator colors, so the pair CRG supplies
 * can be unreadable on a key. The requested color is kept when it
 * clears the ratio, and black or white replaces it when it does not.
 */
export function readableForeground(background: string, requested: string, minimumRatio = 4.5): string {
  if (contrastRatio(background, requested) >= minimumRatio) {
    return requested;
  }

  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#000000') ? '#ffffff' : '#000000';
}

/**
 * Reads a team's 'operator' colors and display name.
 *
 * CRG leaves a color empty until someone sets it, so the uniform color
 * stands in for the background, and a default stands in after that.
 */
export function teamTheme(state: StateStore, number: TeamNumber): TeamTheme {
  const uniform = state.getString(team(number, 'UniformColor'));

  const background = safeColor(state.getString(teamColor(number, 'bg')), safeColor(uniform, DEFAULT_BACKGROUND));
  const requested = safeColor(state.getString(teamColor(number, 'fg')), DEFAULT_FOREGROUND);
  const glow = state.getString(teamColor(number, 'glow'));

  const name =
    state.getString(team(number, 'AlternateName(operator)')) ||
    state.getString(team(number, 'Name')) ||
    uniform ||
    `Team ${number}`;

  return {
    background,
    foreground: readableForeground(background, requested),
    glow: HEX_COLOR.test(glow.trim()) ? glow.trim() : undefined,
    name
  };
}
