/**
 * Draws a key as an SVG image.
 *
 * The drawing is written in a square viewBox rather than in pixels, so
 * one description fits every Stream Deck model: the hardware scales it
 * to whatever its keys are. Text arriving from CRG is escaped on the
 * way in, and colors are used only once they read as hex colors.
 */

import { DEFAULT_BACKGROUND, DEFAULT_FOREGROUND, escapeXml, safeColor } from './theme.ts';

/** The side of the square everything is positioned within. */
export const VIEWBOX = 100;

/** A line of text on a key. */
export type KeyText = {
  readonly text: string;
  /** Baseline, from the top of the viewBox. */
  readonly y: number;
  readonly size: number;
  readonly weight?: 'normal' | 'bold' | undefined;
  readonly color?: string | undefined;
  readonly opacity?: number | undefined;
};

/** Everything drawn on one key. */
export type KeySpec = {
  readonly background?: string | undefined;
  readonly foreground?: string | undefined;
  /** A bar across the top, used to mark a team or a state. */
  readonly accent?: string | undefined;
  /** An outline, used to mark a key as active. */
  readonly outline?: string | undefined;
  readonly texts?: readonly KeyText[] | undefined;
};

const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const ACCENT_HEIGHT = 8;

const OUTLINE_WIDTH = 5;

function text(line: KeyText, foreground: string): string {
  const weight = line.weight === 'bold' ? 700 : 400;
  const fill = safeColor(line.color, foreground);
  const opacity = line.opacity !== undefined && line.opacity < 1 ? ` opacity="${clamp(line.opacity)}"` : '';

  return (
    `<text x="${VIEWBOX / 2}" y="${line.y}" fill="${fill}" font-family="${FONT_STACK}" ` +
    `font-size="${line.size}" font-weight="${weight}" text-anchor="middle"${opacity}>` +
    `${escapeXml(line.text)}</text>`
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Builds the SVG markup for a key. */
export function renderKeySvg(spec: KeySpec): string {
  const background = safeColor(spec.background, DEFAULT_BACKGROUND);
  const foreground = safeColor(spec.foreground, DEFAULT_FOREGROUND);

  const parts = [`<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="${background}"/>`];

  if (spec.accent !== undefined) {
    parts.push(`<rect width="${VIEWBOX}" height="${ACCENT_HEIGHT}" fill="${safeColor(spec.accent, foreground)}"/>`);
  }

  if (spec.outline !== undefined) {
    const inset = OUTLINE_WIDTH / 2;

    parts.push(
      `<rect x="${inset}" y="${inset}" width="${VIEWBOX - OUTLINE_WIDTH}" height="${VIEWBOX - OUTLINE_WIDTH}" ` +
        `fill="none" stroke="${safeColor(spec.outline, foreground)}" stroke-width="${OUTLINE_WIDTH}"/>`
    );
  }

  for (const line of spec.texts ?? []) {
    parts.push(text(line, foreground));
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" ` +
    `width="${VIEWBOX}" height="${VIEWBOX}">${parts.join('')}</svg>`
  );
}

/** Builds the image Stream Deck draws on a key. */
export function renderKey(spec: KeySpec): string {
  return `data:image/svg+xml;base64,${Buffer.from(renderKeySvg(spec), 'utf8').toString('base64')}`;
}
