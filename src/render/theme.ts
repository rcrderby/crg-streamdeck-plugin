/**
 * Team colors, and the guards around the text CRG supplies.
 *
 * Team names and colors are typed by an operator and drawn into an SVG,
 * so both are checked here rather than at each call site: text is
 * escaped, and a color is used only when it reads as a hex color.
 */

import { type StateStore } from '../crg/state.ts';
import { COLOR_SETS, type ColorSlot, type TeamNumber, team, teamColor } from '../crg/paths.ts';

/** The colors one team's keys are drawn in. */
export type TeamTheme = {
  readonly background: string;
  readonly foreground: string;
  readonly glow: string | undefined;
  readonly name: string;
};

/**
 * Drawn when CRG holds no colors for a team at all.
 *
 * The two teams come out as opposites so they stay apart at a glance,
 * whoever is playing.
 */
export const TEAM_DEFAULTS: Readonly<Record<TeamNumber, { background: string; foreground: string }>> = {
  1: { background: '#000000', foreground: '#ffffff' },
  2: { background: '#ffffff', foreground: '#000000' }
};

export const DEFAULT_BACKGROUND = TEAM_DEFAULTS[1].background;

export const DEFAULT_FOREGROUND = TEAM_DEFAULTS[1].foreground;

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

/** The six hex digits of a color, for mixing. */
function channels(color: string): number[] {
  const digits = safeColor(color, '#000000').slice(1);
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits;

  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
}

/**
 * A color partway from a background to a foreground.
 *
 * It stands in for opacity on a drawing made of overlapping parts, which
 * would show their overlaps if each part were made transparent.
 */
export function blend(foreground: string, background: string, amount: number): string {
  const from = channels(background);
  const to = channels(foreground);

  return `#${to
    .map((value, index) => {
      const base = from[index] ?? 0;

      return Math.round(base + (value - base) * amount)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

/** How far a panel stands from the key behind it. */
export const PANEL_CONTRAST = 1.35;

/** The most of the way toward the foreground a panel is ever mixed. */
const PANEL_MOST_LIFT = 0.5;

/** How finely the mix is searched for. */
const PANEL_STEPS = 24;

/**
 * A panel set the same step apart from whatever key it sits on.
 *
 * Mixing in a fixed share of the foreground leaves the step varying with
 * the color underneath, so the share is searched for instead. Every
 * league's colors then carry the same panel, rather than one that reads
 * on some and washes out on others.
 */
export function panelColor(background: string, foreground: string): string {
  const key = safeColor(background, DEFAULT_BACKGROUND);
  let low = 0;
  let high = PANEL_MOST_LIFT;

  for (let step = 0; step < PANEL_STEPS; step += 1) {
    const middle = (low + high) / 2;

    if (contrastRatio(blend(foreground, key, middle), key) < PANEL_CONTRAST) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return blend(foreground, key, (low + high) / 2);
}

/**
 * Reads one color slot across the sets, in order of preference.
 *
 * A game that nobody has configured holds a preset set but no operator
 * set, so a key still comes out in the team's colors.
 */
function colorSlot(state: StateStore, number: TeamNumber, slot: ColorSlot): string {
  for (const set of COLOR_SETS) {
    const value = state.getString(teamColor(number, slot, set));

    if (value !== '') {
      return value;
    }
  }

  return '';
}

/**
 * Reads a team's colors and display name.
 *
 * The operator set comes first, then the preset set. A game holding
 * neither falls to the team defaults, which are opposites rather than
 * a color nobody picked.
 */
export function teamTheme(state: StateStore, number: TeamNumber): TeamTheme {
  const defaults = TEAM_DEFAULTS[number];

  const background = safeColor(colorSlot(state, number, 'bg'), defaults.background);
  const requested = safeColor(colorSlot(state, number, 'fg'), defaults.foreground);
  const glow = colorSlot(state, number, 'glow');

  const name =
    state.getString(team(number, 'AlternateName(operator)')) ||
    state.getString(team(number, 'Name')) ||
    state.getString(team(number, 'UniformColor')) ||
    `Team ${number}`;

  return {
    background,
    foreground: readableForeground(background, requested),
    glow: HEX_COLOR.test(glow.trim()) ? glow.trim() : undefined,
    name
  };
}
