/**
 * The approved key designs, as descriptions the renderer draws.
 *
 * Each builder takes a team's colors and plain values rather than CRG
 * state, so the actions stay thin and every design can be tested without
 * a scoreboard. Team text carries the team's glow color as an offset
 * shadow, and every key that can be active carries the same top bar.
 */

import type { ConnectionStatus } from '../crg/client.ts';
import type { LineupWarning, ReplaceChoiceKind } from '../crg/game-state.ts';
import { BAR_SHIFT, type KeySpec, type KeyText, VIEWBOX, estimateTextWidth } from './key.ts';
import {
  ICON_CENTER_Y,
  ICON_RADIUS,
  ICON_REACH,
  TRIP_SIGN_RADIUS,
  backArrow,
  hazardStripes,
  holdDial,
  leadIcon,
  lostLeadIcon,
  medicalCross,
  noPivotIcon,
  plate,
  resourceDots,
  shadowed,
  starPassIcon,
  triangle,
  tripSign,
  undoArrow,
  type ReviewMark
} from './icons.ts';
import { type TeamTheme, blend, panelColor, readableOpacity } from './theme.ts';

export const TIMEOUT_RED = '#b91c1c';

export const INJURY_BACKGROUND = '#7c2d12';

export const INJURY_FOREGROUND = '#fed7aa';

export const UNDO_BACKGROUND = '#1c1917';

export const UNDO_FOREGROUND = '#fbbf24';

/** Room a line of text has across a key, leaving a margin at each edge. */
const TEXT_ROOM = 92;

/** A resource title's opacity once a team has none left. */
const SPENT_OPACITY = 0.38;

/**
 * The ratio text that is meant to read as spent holds.
 *
 * It is WCAG's bar for large text and for a graphic, rather than the one
 * for body text, because saying a team has none left is what the fade is
 * for and holding the full ratio would undo it.
 */
const SPENT_RATIO = 3;

export type JammerKind = 'lead' | 'starPass' | 'noPivot';

/** A jammer key's icon and caption. A solid shadow gives a stripe drawn faded on purpose a clear edge. */
type JammerDesign = { caption: string; icon: (theme: TeamTheme) => string; solidShadow?: boolean };

const JAMMER: Readonly<Record<JammerKind, JammerDesign>> = {
  lead: { caption: 'Lead', icon: (theme) => leadIcon(theme.foreground) },
  starPass: { caption: 'Star Pass', icon: (theme) => starPassIcon(theme.foreground) },
  noPivot: { caption: 'No Pivot', icon: (theme) => noPivotIcon(theme.foreground, theme.background), solidShadow: true }
};

/**
 * A line of bold text in a team's colors, shadowed in its glow color.
 *
 * A line asked for faded is faded only as far as it stays readable
 * against the key, since the team's foreground was chosen against the
 * key at full strength.
 */
function teamText(
  theme: TeamTheme,
  text: string,
  y: number,
  size: number,
  extra: Partial<KeyText> = {},
  minimumRatio?: number
): KeyText {
  const line: KeyText = { text, y, size, weight: 'bold', color: theme.foreground, shadow: theme.glow, ...extra };

  if (line.opacity === undefined) {
    return line;
  }

  return { ...line, opacity: readableOpacity(theme.background, theme.foreground, line.opacity, minimumRatio) };
}

/**
 * Where every team key's name sits, as drawn: one line across the deck,
 * below the top bar on the keys that have one.
 */
const NAME_LINE = 30;

/**
 * The team name every team key carries at the top, in the team's text color and glow.
 *
 * A key with a top bar draws its content lower by the bar's shift, so
 * its name is set higher by the same amount and lands on the same line.
 */
function teamName(theme: TeamTheme, onBar: boolean): KeyText {
  return teamText(theme, theme.name, onBar ? NAME_LINE - BAR_SHIFT : NAME_LINE, 11);
}

/** How much of its size a line of capitals stands, from its baseline to the top of its letters. */
const CAP_HEIGHT = 0.72;

/** A position to the hundredth, the precision a key's markup is written in. */
function hundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

function capHeight(size: number): number {
  return CAP_HEIGHT * size;
}

/** How far letters such as j, p, and y reach below the line, as a share of the size. */
const DESCENDER = 0.21;

/** The height a line of text stands, counting the letters that hang below its baseline when it has them. */
function lineHeight(text: string, size: number): number {
  return capHeight(size) + (/[gjpqy]/.test(text) ? DESCENDER * size : 0);
}

/**
 * Where each of a key's blocks starts, spaced so every gap is the same:
 * above the first, between each pair, and below the last.
 *
 * A key's content is spread over the room below its team name, or below
 * its top bar, down to the key's bottom edge.
 */
export function evenly(top: number, bottom: number, heights: readonly number[]): number[] {
  const gap = (bottom - top - heights.reduce((total, height) => total + height, 0)) / (heights.length + 1);
  let next = top + gap;

  return heights.map((height) => {
    const start = next;

    next += height + gap;

    return start;
  });
}

/** A position as drawn, in the key's own terms: a key with a top bar draws its content lower by the bar's shift. */
function onKey(drawn: number, onBar: boolean): number {
  return onBar ? drawn - BAR_SHIFT : drawn;
}

/** How large a jammer icon is drawn, so the team name has room above it. */
const ICON_SCALE = 0.8;

const JAMMER_CAPTION_SIZE = 17;

/**
 * The icon line and caption line Lead, Lost Lead, Star Pass, and No Pivot share.
 *
 * They are spaced evenly for the tallest icon, so a row of the four lines
 * up, and a shorter icon sits centered on the same line. Lost Lead's
 * HOLD sits in its top bar, so it needs no line of its own.
 */
function jammerLines(): { icon: number; caption: number } {
  const reach = ICON_REACH * ICON_SCALE;
  const [iconTop = 0, captionTop = 0] = evenly(NAME_LINE, VIEWBOX, [reach * 2, capHeight(JAMMER_CAPTION_SIZE)]);

  return { icon: onKey(iconTop + reach, true), caption: onKey(captionTop + capHeight(JAMMER_CAPTION_SIZE), true) };
}

/** Where the reason box and its word sit, from the center of the icon they lie across. */
const REASON_BOX_OFFSET = -9;

const REASON_TEXT_OFFSET = 6;

/** An icon scaled about its own center and set down at another height, keeping its shape. */
function placed(markup: string, fromY: number, toY: number): string {
  return `<g transform="translate(50 ${Math.round(toY * 100) / 100}) scale(${ICON_SCALE}) translate(-50 ${-fromY})">${markup}</g>`;
}

/** A drawing in a team's colors, shadowed in its glow color as its text is. */
function teamShape(theme: TeamTheme, markup: string, solid = false): string {
  return shadowed(markup, theme.glow, solid);
}

function teamKey(theme: TeamTheme, spec: KeySpec): KeySpec {
  return { background: theme.background, foreground: theme.foreground, ...spec };
}

/**
 * Lead, Lost Lead, Star Pass, or No Pivot: an icon over a one-line caption, all captions one size.
 *
 * A key CRG will not act on right now is subdued, with the reason across its icon.
 */
export function jammerKey(theme: TeamTheme, kind: JammerKind, active: boolean, disabledReason?: string): KeySpec {
  const design = JAMMER[kind];
  const lines = jammerLines();

  if (disabledReason === undefined) {
    return teamKey(theme, {
      shapes: [teamShape(theme, placed(design.icon(theme), ICON_CENTER_Y, lines.icon), design.solidShadow)],
      texts: [teamName(theme, true), teamText(theme, design.caption, lines.caption, JAMMER_CAPTION_SIZE)],
      bar: { active }
    });
  }

  const faded: TeamTheme = { ...theme, foreground: blend(theme.foreground, theme.background, SPENT_OPACITY) };

  return teamKey(theme, {
    shapes: [
      placed(design.icon(faded), ICON_CENTER_Y, lines.icon),
      teamShape(theme, plate(12, lines.icon + REASON_BOX_OFFSET, 76, 20, theme.background))
    ],
    texts: [
      teamName(theme, true),
      teamText(theme, design.caption, lines.caption, JAMMER_CAPTION_SIZE, { opacity: SPENT_OPACITY }, SPENT_RATIO),
      teamText(theme, disabledReason, lines.icon + REASON_TEXT_OFFSET, 13)
    ],
    bar: { active }
  });
}

/**
 * Lost Lead: the struck star, with HOLD in its top bar.
 *
 * It sits beside Lead and undoes it, so it needs a deliberate hold. Its
 * circle, caption, and lines match Lead's, so the two line up. The top
 * bar carries the hold rather than a dial, which would compete with
 * whatever color the team brings, and HOLD rides in the bar with it.
 */
export function lostLeadKey(theme: TeamTheme, active: boolean, level = 0): KeySpec {
  const lines = jammerLines();

  return teamKey(theme, {
    shapes: [
      teamShape(
        theme,
        placed(lostLeadIcon(theme.foreground, theme.background, ICON_CENTER_Y, ICON_RADIUS), ICON_CENTER_Y, lines.icon)
      )
    ],
    texts: [teamName(theme, true), teamText(theme, 'Lost Lead', lines.caption, JAMMER_CAPTION_SIZE)],
    bar: { active, progress: level, label: 'HOLD' }
  });
}

/** NI: large letters, active while the jammer is on their initial trip. */
export function noInitialKey(theme: TeamTheme, active: boolean): KeySpec {
  return teamKey(theme, { texts: [teamName(theme, true), teamText(theme, 'NI', 70, 42)], bar: { active } });
}

function resourceTitle(theme: TeamTheme, lines: readonly string[], spent: boolean): KeyText[] {
  return lines.map((line, index) =>
    teamText(theme, line, 46 + index * 17, 14, spent ? { opacity: SPENT_OPACITY } : {}, SPENT_RATIO)
  );
}

/** Team Timeout: a dot per timeout left, active while the team's timeout runs, with the dot it used pulsing. */
export function teamTimeoutKey(
  theme: TeamTheme,
  total: number,
  left: number,
  active: boolean,
  pulse?: number
): KeySpec {
  return teamKey(theme, {
    shapes: [teamShape(theme, resourceDots(total, left, theme.foreground, 83, undefined, pulse))],
    texts: [teamName(theme, true), ...resourceTitle(theme, ['Team', 'Timeout'], left === 0)],
    bar: { active }
  });
}

/** Official Review: a dot per review left, marked for a review won, active while the review runs, with its mark pulsing. */
export function officialReviewKey(
  theme: TeamTheme,
  total: number,
  left: number,
  mark: ReviewMark | undefined,
  active: boolean,
  pulse?: number
): KeySpec {
  return teamKey(theme, {
    shapes: [teamShape(theme, resourceDots(Math.max(1, total), left, theme.foreground, 83, mark, pulse))],
    texts: [teamName(theme, true), ...resourceTitle(theme, ['Official', 'Review'], left === 0)],
    bar: { active }
  });
}

/** What an Official Review Options key does: marks the team's review retained, or taken as a team timeout. */
export type ReviewOption = 'retained' | 'timeout';

/**
 * Review Retained or As a Team Timeout, under the team's name, with the top bar active while it is set.
 *
 * Review Retained reads Review Won once the team has no retains left
 * this period, since winning the review then keeps nothing. The key is
 * darkened while the team has no review running, as it has nothing to
 * act on.
 */
export function reviewOptionKey(
  theme: TeamTheme,
  option: ReviewOption,
  on: boolean,
  available: boolean,
  won = false
): KeySpec {
  const lines = option === 'timeout' ? ['As a Team', 'Timeout'] : ['Review', won ? 'Won' : 'Retained'];

  return teamKey(theme, {
    texts: [teamName(theme, true), ...lines.map((line, index) => teamText(theme, line, 50 + index * 18, 15))],
    bar: { active: on },
    subdued: !available
  });
}

/** Injury: a medical cross in its own colors, with the top bar. */
export function injuryKey(active: boolean): KeySpec {
  return {
    background: INJURY_BACKGROUND,
    foreground: INJURY_FOREGROUND,
    shapes: [medicalCross(50, 40, 30, INJURY_FOREGROUND)],
    texts: [{ text: 'Injury', y: 84, size: 14, weight: 'bold' }],
    bar: { active }
  };
}

/** Trip Points: puts a fixed number of points on the trip, with no border and no dimming. */
export function tripPointsKey(theme: TeamTheme, points: number): KeySpec {
  return teamKey(theme, {
    texts: [teamName(theme, false), teamText(theme, `+${points}`, TRIP_NUMBER_LINE, TRIP_NUMBER_SIZE)]
  });
}

/** The size of the number on Trip Points, Up 1, and Down 1, which share one line. */
const TRIP_NUMBER_SIZE = 40;

/** The line the trip numbers stand on. */
const TRIP_NUMBER_LINE = 74;

/** The Up 1 and Down 1 arrow: its width, and where it and the 1 are centered across the key. */
const TRIP_ARROW_WIDTH = 32;

const TRIP_ARROW_X = 35;

const TRIP_ONE_X = 69;

/** Up 1 or Down 1: the arrow sits left of the 1, both centered on the line the trip numbers share. */
export function tripAdjustKey(theme: TeamTheme, up: boolean): KeySpec {
  const middle = TRIP_NUMBER_LINE - capHeight(TRIP_NUMBER_SIZE) / 2;

  return teamKey(theme, {
    shapes: [teamShape(theme, triangle(up, TRIP_ARROW_X, middle, TRIP_ARROW_WIDTH, theme.foreground))],
    texts: [teamName(theme, false), teamText(theme, '1', TRIP_NUMBER_LINE, TRIP_NUMBER_SIZE, { x: TRIP_ONE_X })]
  });
}

const TRIP_CHANGE_SIZE = 12;

/** Add Trip or Remove Trip: a filled disc with the sign cut out of it. */
export function tripChangeKey(theme: TeamTheme, add: boolean): KeySpec {
  const label = add ? 'Add Trip' : 'Remove Trip';
  const [signTop = 0, labelTop = 0] = evenly(NAME_LINE, VIEWBOX, [
    TRIP_SIGN_RADIUS * 2,
    lineHeight(label, TRIP_CHANGE_SIZE)
  ]);

  return teamKey(theme, {
    shapes: [teamShape(theme, tripSign(add, theme.foreground, theme.background, signTop + TRIP_SIGN_RADIUS))],
    texts: [teamName(theme, false), teamText(theme, label, labelTop + capHeight(TRIP_CHANGE_SIZE), TRIP_CHANGE_SIZE)]
  });
}

const SCORE_TOTAL_SIZE = 32;

/** The jam points, at seven tenths of the total's size. */
const SCORE_JAM_SIZE = 11.9;

/** Padding inside a panel, and the gap between the two, as shares of the jam points' size. */
const SCORE_PAD = 0.3;

const SCORE_GAP = 0.16;

/** The room the two panels share. */
const SCORE_ROOM = 92;

const SCORE_TRIP_SIZE = 11;

/**
 * Score: the total beside this jam's points, each on a panel of its own.
 *
 * The pair sits the way a scoreboard sets it: the jam's points smaller
 * and on the outside, so team 1's key reads total then jam points and
 * team 2's reads jam points then total, both standing on one line. Each
 * panel is cut to a fixed width, the jam's for two digits, so nothing
 * moves as the score climbs; a longer number shrinks into its panel.
 */
export function scoreKey(theme: TeamTheme, total: number, jam: number, trip: number, mirrored = false): KeySpec {
  const pad = SCORE_JAM_SIZE * SCORE_PAD;
  const totalPad = SCORE_TOTAL_SIZE * SCORE_PAD * 0.55;

  const room = estimateTextWidth('88', SCORE_JAM_SIZE, 'bold');
  const jamPanel = room + pad * 2;
  const gap = SCORE_JAM_SIZE * SCORE_GAP;
  const totalPanel = SCORE_ROOM - gap - jamPanel;

  // Rounded once here, so both panels' feet land on exactly the same line once drawn.
  const totalHeight = hundredths(CAP_HEIGHT * SCORE_TOTAL_SIZE + totalPad * 2);
  const jamHeight = hundredths(CAP_HEIGHT * SCORE_JAM_SIZE + pad * 2);

  // The panels and the trip count are spaced evenly below the name; both numbers stand on the panels' foot.
  const [panelsTop = 0, tripTop = 0] = evenly(NAME_LINE, VIEWBOX, [totalHeight, capHeight(SCORE_TRIP_SIZE)]);
  const baseline = hundredths(panelsTop + totalHeight);

  const left = 50 - (totalPanel + gap + jamPanel) / 2;
  const totalLeft = mirrored ? left + jamPanel + gap : left;
  const jamLeft = mirrored ? left : left + totalPanel + gap;
  const panel = panelColor(theme.background, theme.foreground);

  return teamKey(theme, {
    shapes: [
      teamShape(theme, plate(totalLeft, baseline - totalHeight, totalPanel, totalHeight, panel, totalPad * 0.6)),
      teamShape(theme, plate(jamLeft, baseline - jamHeight, jamPanel, jamHeight, panel, pad * 0.7))
    ],
    texts: [
      teamName(theme, false),
      teamText(theme, String(total), baseline - totalPad, SCORE_TOTAL_SIZE, {
        x: totalLeft + totalPanel / 2,
        width: totalPanel - totalPad * 2
      }),
      teamText(theme, String(jam), baseline - pad, SCORE_JAM_SIZE, {
        x: jamLeft + jamPanel / 2,
        width: room
      }),
      teamText(theme, `TRIP ${trip}`, tripTop + capHeight(SCORE_TRIP_SIZE), SCORE_TRIP_SIZE, { opacity: 0.7 })
    ],
    informational: true
  });
}

/** Breaks a CRG label into the two lines a key has room for. */
function splitWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return words.length === 0 ? [''] : words;
  }

  const middle = Math.ceil(words.length / 2);

  return [words.slice(0, middle).join(' '), words.slice(middle).join(' ')];
}

export const JAM_STOP = '#8c1d1d';

export const JAM_START = '#14532d';

export const JAM_IDLE = '#26262b';

/** What Start Jam turns once the lineup is nearly up. */
export const JAM_LINEUP_DUE = '#9a3412';

/** Start Jam as the lineup runs out: green, then orange, then moving between them. */
export function lineupBackground(warning: LineupWarning, phase = 0): string {
  if (warning === 'none') {
    return JAM_START;
  }

  return warning === 'due' ? JAM_LINEUP_DUE : blend(JAM_LINEUP_DUE, JAM_START, phase);
}

/**
 * Jam Control: what the key does, the clock that moment runs on, and which clock it is.
 *
 * What a press does leads, since the key is a button before it is a
 * clock, and the clock's own name closes the key. With no clock running
 * the wording fills the key instead, as it does before a game.
 */
export function jamControlKey(
  text: string,
  time: string | undefined,
  foot: readonly string[],
  background: string,
  dimmed: boolean
): KeySpec {
  const opacity = dimmed ? 0.45 : 1;
  const stacked = foot.length > 1;

  // Two lines start higher and leave the clock less room, so a long clock
  // name and the jam number both read at the size one line would.
  const footBase = stacked ? 82 : 90;
  const footLines: KeyText[] = foot.map((line, index) => ({
    text: line,
    y: footBase + index * 12,
    size: 10,
    weight: 'bold',
    opacity: opacity * 0.6
  }));

  if (time === undefined) {
    const lines = splitWords(text.toUpperCase());
    const middle = foot.length === 0 ? 56 : 52;

    return {
      background,
      foreground: '#ffffff',
      texts: [
        ...lines.map((line, index) => ({
          text: line,
          y: middle + (index - (lines.length - 1) / 2) * 20,
          size: 17,
          weight: 'bold' as const,
          opacity
        })),
        ...footLines
      ]
    };
  }

  return {
    background,
    foreground: '#ffffff',
    texts: [
      { text: text.toUpperCase(), y: 26, size: 13, weight: 'bold', opacity },
      { text: time, y: stacked ? 62 : 66, size: stacked ? 26 : 28, opacity },
      ...footLines
    ]
  };
}

/** Timeout or Official Timeout: red, with the top bar active while its kind of timeout runs. */
export function timeoutKey(lines: readonly string[], active: boolean): KeySpec {
  return {
    background: TIMEOUT_RED,
    foreground: '#ffffff',
    texts: lines.map((line, index) => ({
      text: line,
      y: 56 + (index - (lines.length - 1) / 2) * 20,
      size: 17,
      weight: 'bold' as const
    })),
    bar: { active }
  };
}

/**
 * Undo: an amber U turn on hazard striping, so it stands apart from every other key.
 *
 * It reads HOLD. With Replace on Undo in use it carries the top bar,
 * green while CRG holds its replace menu open, and the bar carries the
 * hold rather than a dial. Without it the key has no bar, since it never
 * opens that menu, and the dial shows the hold instead.
 */
export function undoKey(level = 0, waiting?: boolean): KeySpec {
  const carries = waiting !== undefined;

  return {
    background: UNDO_BACKGROUND,
    foreground: UNDO_FOREGROUND,
    shapes: [
      hazardStripes(UNDO_FOREGROUND),
      undoArrow(50, 38, 17, UNDO_FOREGROUND),
      ...(carries ? [] : [holdDial(level, UNDO_FOREGROUND, UNDO_BACKGROUND)])
    ],
    texts: [
      { text: 'Undo', y: 72, size: 14, weight: 'bold' },
      { text: 'HOLD', y: 86, size: 10, weight: 'bold', opacity: 0.8 }
    ],
    ...(carries ? { bar: { active: waiting, progress: level, fill: 'active' as const } } : {})
  };
}

/** The two lines a key held to act closes with, naming what the hold does. */
function holdTo(verb: string): KeyText[] {
  return ['HOLD TO', verb.toUpperCase()].map((text, index) => ({
    text,
    y: 76 + index * 12,
    size: 10,
    weight: 'bold' as const,
    opacity: 0.8
  }));
}

/** The two lines every key on the Undo page but the informational one closes with. */
function holdToConfirm(): KeyText[] {
  return holdTo('confirm');
}

/** The first key on the Undo page: the action CRG is waiting to replace, marked as doing nothing when pressed. */
export function replaceInfoKey(replaced: string): KeySpec {
  return {
    background: UNDO_BACKGROUND,
    foreground: UNDO_FOREGROUND,
    texts: [
      { text: 'REPLACE', y: 28, size: 11, weight: 'bold', opacity: 0.8 },
      { text: replaced, y: 56, size: 16, weight: 'bold' },
      { text: 'WITH', y: 80, size: 11, weight: 'bold', opacity: 0.8 }
    ],
    informational: true
  };
}

/** CRG's No Action on the Undo page, drawn like the Undo key that opened it: holding it keeps the undo. */
export function replaceConfirmKey(labelText: string, level = 0): KeySpec {
  return {
    background: UNDO_BACKGROUND,
    foreground: UNDO_FOREGROUND,
    shapes: [
      hazardStripes(UNDO_FOREGROUND),
      undoArrow(50, 30, 14, UNDO_FOREGROUND),
      holdDial(level, UNDO_FOREGROUND, UNDO_BACKGROUND)
    ],
    texts: [{ text: labelText, y: 58, size: 15, weight: 'bold' }, ...holdToConfirm()]
  };
}

const CHOICE_BACKGROUNDS: Readonly<Record<ReplaceChoiceKind, string>> = {
  start: '#14532d',
  stop: '#8c1d1d',
  timeout: TIMEOUT_RED
};

/**
 * One of the choices CRG allows in place of an undone action, in CRG's words, colored by what it does.
 *
 * A choice replaces what was undone and cannot be taken back, so its hold
 * runs red across a gray bar.
 */
export function replaceChoiceKey(text: string, kind: ReplaceChoiceKind, level = 0): KeySpec {
  return {
    background: CHOICE_BACKGROUNDS[kind],
    foreground: '#ffffff',
    bar: { active: false, progress: level, fill: 'danger' },
    texts: [{ text, y: 52, size: 17, weight: 'bold' }, ...holdToConfirm()]
  };
}

/** A key on a page with nothing to offer right now, drawn like an empty key. */
export function blankKey(): KeySpec {
  return { background: '#000000' };
}

/** The dark gray of the keys that move between pages or change a setting, rather than act on the game. */
const SETTINGS_BACKGROUND = '#27272a';

/** Back, on every page the plugin opens. */
export function backKey(): KeySpec {
  return {
    background: SETTINGS_BACKGROUND,
    foreground: '#ffffff',
    shapes: [backArrow(50, 40, 18, '#ffffff')],
    texts: [{ text: 'Back', y: 80, size: 15, weight: 'bold' }]
  };
}

type ConnectionLook = {
  readonly background: string;
  readonly accent: string;
  readonly headline: string;
  readonly detail: string;
  /** What holding the connection page's key does in this state. */
  readonly verb: 'connect' | 'disconnect';
};

const CONNECTION_LOOKS: Readonly<Record<ConnectionStatus, ConnectionLook>> = {
  connected: { background: '#04170c', accent: '#22c55e', headline: 'CRG', detail: 'Connected', verb: 'disconnect' },
  connecting: { background: '#1c1503', accent: '#eab308', headline: 'CRG', detail: 'Connecting', verb: 'disconnect' },
  disconnected: { background: '#1f0708', accent: '#ef4444', headline: 'NO CRG', detail: 'Offline', verb: 'disconnect' },
  unauthorized: {
    background: '#1f0708',
    accent: '#f97316',
    headline: 'NO CRG',
    detail: 'Not allowed',
    verb: 'disconnect'
  },
  stopped: { background: '#18181b', accent: '#71717a', headline: 'CRG', detail: 'Disconnected', verb: 'connect' }
};

/**
 * CRG Connection: whether the plugin is connected, apart from a deck disconnected on purpose.
 *
 * The operator profile the deck keeps its settings under sits below the
 * state, in italics, so it reads as a name rather than a state.
 */
export function connectionKey(status: ConnectionStatus, operator = ''): KeySpec {
  const look = CONNECTION_LOOKS[status];
  const named = operator !== '';

  const texts: KeyText[] = [
    { text: look.headline, y: named ? 34 : 42, size: 19, weight: 'bold' },
    { text: look.detail, y: named ? 55 : 66, size: 13, opacity: 0.85 }
  ];

  if (named) {
    texts.push({ text: operator, y: 75, size: 11, italic: true, opacity: 0.7 });
  }

  return { background: look.background, foreground: '#ffffff', accent: look.accent, texts, opensPage: true };
}

/** Automation: opens the page of CRG's automation settings. */
export function automationKey(): KeySpec {
  return {
    background: SETTINGS_BACKGROUND,
    foreground: '#ffffff',
    texts: [{ text: 'Automation', y: 56, size: 15, weight: 'bold' }],
    opensPage: true
  };
}

/** The dark neutral the JRDA keys stand on, since they speak for the game rather than a team. */
const JRDA_BACKGROUND = '#26262b';

/** Where sudden scoring stands: not in the ruleset, allowed but not reached, or under way this period. */
export type SuddenScoring = 'off' | 'allowed' | 'active';

/**
 * Sudden Scoring: whether CRG has the period in JRDA sudden scoring.
 *
 * It only shows whether or not CRG enabled sudden scoring, and uses the informational tab.
 * It reads ENABLED with the top bar green while the period is in sudden scoring, and
 * DISABLED while the ruleset allows it but the the conditions are not met.
 * Without sudden scoring enabled in the ruleset it is darkened.
 */
export function suddenScoringKey(state: SuddenScoring): KeySpec {
  const active = state === 'active';

  return {
    background: JRDA_BACKGROUND,
    foreground: '#ffffff',
    texts: [
      { text: 'Sudden', y: 40, size: 15, weight: 'bold' },
      { text: 'Scoring', y: 57, size: 15, weight: 'bold' },
      { text: active ? 'ENABLED' : 'DISABLED', y: 80, size: 11, weight: 'bold', ...(active ? {} : { opacity: 0.75 }) }
    ],
    bar: { active },
    informational: true,
    subdued: state === 'off'
  };
}

/**
 * Continuation Upcoming: the time a continued jam would run, set with a hold.
 *
 * The time sits under a small CONTINUATION title, with JAM TIME REMAINING
 * beneath it and HOLD in the top bar. The key is darkened when conditions
 * for a continuation are not met.  Displays a dash when there is no time to show.
 */
export function continuationKey(time: string | undefined, on: boolean, available: boolean, level = 0): KeySpec {
  return {
    background: JRDA_BACKGROUND,
    foreground: '#ffffff',
    texts: [
      { text: 'CONTINUATION', y: 26, size: 11, weight: 'bold', opacity: 0.75 },
      { text: time ?? '—', y: 60, size: 30 },
      { text: 'JAM TIME', y: 76, size: 9, weight: 'bold', opacity: 0.8 },
      { text: 'REMAINING', y: 86, size: 9, weight: 'bold', opacity: 0.8 }
    ],
    bar: { active: on, progress: level, label: 'HOLD' },
    subdued: !available
  };
}

/** The automation settings the Automation page can switch. */
export type AutomationSetting = 'endJams' | 'endTeamTimeouts';

const AUTOMATION_LABELS: Readonly<Record<AutomationSetting, readonly string[]>> = {
  endJams: ['Auto End', 'Jams'],
  endTeamTimeouts: ['Auto End', 'Team', 'Timeouts']
};

/** A gray key's name, centered on the key; a three line name is set smaller and closer, so it stays clear of the bar. */
function settingsName(lines: readonly string[], middle = 56): KeyText[] {
  const three = lines.length > 2;
  const gap = three ? 15 : 17;

  return lines.map((text, index) => ({
    text,
    y: middle + (index - (lines.length - 1) / 2) * gap,
    size: three ? 13.5 : 15,
    weight: 'bold' as const
  }));
}

/** Auto End Jams or Auto End Team Timeouts: the setting's name, with the top bar active while it is on. */
export function automationToggleKey(setting: AutomationSetting, on: boolean): KeySpec {
  return {
    background: SETTINGS_BACKGROUND,
    foreground: '#ffffff',
    texts: settingsName(AUTOMATION_LABELS[setting]),
    bar: { active: on }
  };
}

/** A gray key that opens one of the plugin's pages. */
function pageOpenerKey(lines: readonly string[]): KeySpec {
  return { background: SETTINGS_BACKGROUND, foreground: '#ffffff', texts: settingsName(lines), opensPage: true };
}

/** End of Period Controls: opens the page of end of period controls. */
export function endOfPeriodKey(): KeySpec {
  return pageOpenerKey(['End of', 'Period', 'Controls']);
}

/** Timeout Before Period End: opens the page that starts a timeout with seconds left on the period clock. */
export function periodEndTimeoutKey(): KeySpec {
  return pageOpenerKey(['Timeout', 'Before', 'Period End']);
}

/** Where the official score stands: held back by CRG, ready to set, or set. */
export type OfficialScoreState = 'waiting' | 'ready' | 'official';

/**
 * Official Score: set with a hold, and only one way.
 *
 * Its note reads UNOFFICIAL, or OFFICIAL with the top bar green once set,
 * when a hold does nothing more. While CRG holds the score back the key
 * is darkened and reads WAIT, with the time left when the plugin can
 * tell it.
 */
export function officialScoreKey(state: OfficialScoreState, wait?: string, level = 0): KeySpec {
  const official = state === 'official';
  const note = official ? 'OFFICIAL' : state === 'ready' ? 'UNOFFICIAL' : wait === undefined ? 'WAIT' : `WAIT ${wait}`;

  return {
    background: SETTINGS_BACKGROUND,
    foreground: '#ffffff',
    texts: [
      { text: 'Official', y: 42, size: 15, weight: 'bold' },
      { text: 'Score', y: 59, size: 15, weight: 'bold' },
      { text: note, y: 81, size: 11, weight: 'bold', ...(official ? {} : { opacity: 0.75 }) }
    ],
    bar: official ? { active: true } : { active: false, progress: level, label: 'HOLD' },
    subdued: state === 'waiting'
  };
}

/** Where overtime stands: not offered by CRG, offered, or under way. */
export type OvertimeState = 'unavailable' | 'ready' | 'overtime';

/**
 * Start Overtime Lineup: started with a hold, and only one way.
 *
 * It is darkened until CRG offers an overtime lineup, and reads IN
 * OVERTIME with the top bar green while the game is in overtime.
 */
export function overtimeLineupKey(state: OvertimeState, level = 0): KeySpec {
  const overtime = state === 'overtime';

  return {
    background: SETTINGS_BACKGROUND,
    foreground: '#ffffff',
    texts: [
      ...settingsName(['Start', 'Overtime', 'Lineup'], 51),
      ...(overtime ? [{ text: 'IN OVERTIME', y: 85, size: 9, weight: 'bold' as const }] : [])
    ],
    bar: overtime ? { active: true } : { active: false, progress: level, label: 'HOLD' },
    subdued: state === 'unavailable'
  };
}

/** Show Clock During Final Score: a plain toggle, with the top bar active while it is on. */
export function clockDuringFinalScoreKey(on: boolean): KeySpec {
  return {
    background: SETTINGS_BACKGROUND,
    foreground: '#ffffff',
    texts: settingsName(['Show Clock', 'During', 'Final Score']),
    bar: { active: on }
  };
}

/** The seconds the Timeout Before Period End page will leave on the period clock. It only shows. */
export function periodEndSecondsKey(time: string): KeySpec {
  return {
    background: SETTINGS_BACKGROUND,
    foreground: '#ffffff',
    texts: [
      { text: 'PERIOD CLOCK', y: 28, size: 10, weight: 'bold', opacity: 0.75 },
      { text: time, y: 64, size: 30 },
      { text: 'AT TIMEOUT', y: 84, size: 9, weight: 'bold', opacity: 0.75 }
    ],
    informational: true
  };
}

/** +1 or −1 on the Timeout Before Period End page, darkened when it cannot go lower. */
export function secondsStepKey(up: boolean, available = true): KeySpec {
  return {
    background: SETTINGS_BACKGROUND,
    foreground: '#ffffff',
    texts: [
      { text: up ? '+1' : '\u22121', y: 60, size: 34, weight: 'bold' },
      { text: 'SECOND', y: 82, size: 10, weight: 'bold', opacity: 0.75 }
    ],
    subdued: !available
  };
}

/** Start Timeout on the Timeout Before Period End page: timeout red, with HOLD in the top bar. */
export function startPeriodEndTimeoutKey(level = 0): KeySpec {
  return {
    background: TIMEOUT_RED,
    foreground: '#ffffff',
    texts: [
      { text: 'Start', y: 48, size: 17, weight: 'bold' },
      { text: 'Timeout', y: 68, size: 17, weight: 'bold' }
    ],
    bar: { active: false, progress: level, label: 'HOLD' }
  };
}

/**
 * The connection page's key: drawn like CRG Connection, closing with what a hold does.
 *
 * The top bar carries the hold. It is green while the plugin is connected
 * or trying to be, and a hold to disconnect runs red across it; once the
 * deck is disconnected on purpose it is gray, and a hold to connect runs
 * green across it.
 */
export function connectionToggleKey(status: ConnectionStatus, level = 0): KeySpec {
  const look = CONNECTION_LOOKS[status];
  const connecting = look.verb === 'connect';

  return {
    background: look.background,
    foreground: '#ffffff',
    bar: { active: !connecting, progress: level, fill: connecting ? 'next' : 'danger' },
    texts: [
      { text: look.headline, y: 34, size: 19, weight: 'bold' },
      { text: look.detail, y: 54, size: 13, opacity: 0.85 },
      ...holdTo(look.verb)
    ]
  };
}

const CLOCK_BACKGROUND = '#0b0b0f';

const CLOCK_RUNNING = '#22c55e';

const CLOCK_STOPPED = '#3f3f46';

const CLOCK_LABEL_SIZE = 17;

/** Splits a label at the space nearest its middle when it is too wide for one line. */
function labelLines(label: string): string[] {
  if (estimateTextWidth(label, CLOCK_LABEL_SIZE, 'bold') <= TEXT_ROOM || !label.includes(' ')) {
    return [label];
  }

  const spaces = [...label].flatMap((character, index) => (character === ' ' ? [index] : []));
  const middle = spaces.reduce((best, index) =>
    Math.abs(index - label.length / 2) < Math.abs(best - label.length / 2) ? index : best
  );

  return [label.slice(0, middle), label.slice(middle + 1)];
}

/**
 * A clock: its title over its time, with a green accent while it runs, marked as doing nothing when pressed.
 *
 * With no time, as when CRG's scoreboard hides the clock, the title
 * alone fills the key and the accent goes with it: there is no clock to
 * call running or stopped.
 */
export function clockKey(title: string, time: string | undefined, running: boolean): KeySpec {
  const texts: KeyText[] =
    time === undefined
      ? labelLines(title).map((line, index, lines) => ({
          text: line,
          y: 58 + (index - (lines.length - 1) / 2) * 20,
          size: CLOCK_LABEL_SIZE,
          weight: 'bold'
        }))
      : [
          { text: title, y: 30, size: 13, weight: 'bold', opacity: 0.75 },
          { text: time, y: 72, size: 30 }
        ];

  return {
    background: CLOCK_BACKGROUND,
    foreground: '#ffffff',
    ...(time === undefined ? {} : { accent: running ? CLOCK_RUNNING : CLOCK_STOPPED }),
    texts,
    informational: true
  };
}
