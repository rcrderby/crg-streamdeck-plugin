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
import { type KeySpec, type KeyText, estimateTextWidth } from './key.ts';
import {
  backArrow,
  hazardStripes,
  holdDial,
  leadIcon,
  lostLeadIcon,
  medicalCross,
  noPivotIcon,
  plate,
  resourceDots,
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

const JAMMER: Readonly<Record<JammerKind, { caption: string; icon: (theme: TeamTheme) => string }>> = {
  lead: { caption: 'Lead', icon: (theme) => leadIcon(theme.foreground) },
  starPass: { caption: 'Star Pass', icon: (theme) => starPassIcon(theme.foreground) },
  noPivot: { caption: 'No Pivot', icon: (theme) => noPivotIcon(theme.foreground, theme.background) }
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

/** The team name every scoring key carries at the top. */
function teamName(theme: TeamTheme, y = 22): KeyText {
  return teamText(theme, theme.name, y, 11, { opacity: 0.8 });
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

  if (disabledReason === undefined) {
    return teamKey(theme, {
      shapes: [design.icon(theme)],
      texts: [teamText(theme, design.caption, 82, 17)],
      bar: { active }
    });
  }

  const faded: TeamTheme = { ...theme, foreground: blend(theme.foreground, theme.background, SPENT_OPACITY) };

  return teamKey(theme, {
    shapes: [design.icon(faded), plate(12, 29, 76, 20, theme.background)],
    texts: [
      teamText(theme, design.caption, 82, 17, { opacity: SPENT_OPACITY }, SPENT_RATIO),
      teamText(theme, disabledReason, 44, 13)
    ],
    bar: { active }
  });
}

/**
 * Lost Lead: the struck star drawn small, with HOLD beneath it.
 *
 * It sits beside Lead and undoes it, so it needs a deliberate hold. The
 * top bar carries the hold rather than a dial, which would compete with
 * whatever color the team brings.
 */
export function lostLeadKey(theme: TeamTheme, active: boolean, level = 0): KeySpec {
  return teamKey(theme, {
    shapes: [lostLeadIcon(theme.foreground, theme.background)],
    texts: [teamText(theme, 'Lost Lead', 68, 15), teamText(theme, 'HOLD', 84, 10, { opacity: 0.8 })],
    bar: { active, progress: level }
  });
}

/** NI: large letters, active while the jammer is on their initial trip. */
export function noInitialKey(theme: TeamTheme, active: boolean): KeySpec {
  return teamKey(theme, { texts: [teamText(theme, 'NI', 64, 42)], bar: { active } });
}

function resourceTitle(theme: TeamTheme, lines: readonly string[], spent: boolean): KeyText[] {
  return lines.map((line, index) =>
    teamText(theme, line, 40 + index * 17, 14, spent ? { opacity: SPENT_OPACITY } : {}, SPENT_RATIO)
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
    shapes: [resourceDots(total, left, theme.foreground, 80, undefined, pulse)],
    texts: resourceTitle(theme, ['Team', 'Timeout'], left === 0),
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
    shapes: [resourceDots(Math.max(1, total), left, theme.foreground, 80, mark, pulse)],
    texts: resourceTitle(theme, ['Official', 'Review'], left === 0),
    bar: { active }
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
  return teamKey(theme, { texts: [teamName(theme), teamText(theme, `+${points}`, 74, 40)] });
}

/** Up 1 or Down 1: the arrow sits left of the 1, both centered on one line. */
export function tripAdjustKey(theme: TeamTheme, up: boolean): KeySpec {
  return teamKey(theme, {
    shapes: [triangle(up, 37, 60, 22, theme.foreground)],
    texts: [teamName(theme), teamText(theme, '1', 71, 30, { x: 66 })]
  });
}

/** Add Trip or Remove Trip: a filled disc with the sign cut out of it. */
export function tripChangeKey(theme: TeamTheme, add: boolean): KeySpec {
  return teamKey(theme, {
    shapes: [tripSign(add, theme.foreground, theme.background)],
    texts: [teamName(theme), teamText(theme, add ? 'Add Trip' : 'Remove Trip', 89, 12)]
  });
}

const SCORE_TOTAL_SIZE = 32;

/** The jam points, at seven tenths of the total's size. */
const SCORE_JAM_SIZE = 11.9;

/** Padding inside a panel, and the gap between the two, as shares of the jam points' size. */
const SCORE_PAD = 0.3;

const SCORE_GAP = 0.16;

/** How much of a size a digit stands, which is what sets a panel's height. */
const CAP_HEIGHT = 0.72;

/** The line both numbers sit on, and the room the two panels share. */
const SCORE_BASELINE = 63;

const SCORE_ROOM = 92;

/**
 * Score: the total beside this jam's points, each on a panel of its own.
 *
 * The pair sits the way a scoreboard sets it, the jam's points to the
 * right of the total and smaller, both standing on one line. Each panel
 * is cut to a fixed width, the jam's for two digits, so nothing moves as
 * the score climbs; a longer number shrinks into its panel instead.
 */
export function scoreKey(theme: TeamTheme, total: number, jam: number, trip: number): KeySpec {
  const pad = SCORE_JAM_SIZE * SCORE_PAD;
  const totalPad = SCORE_TOTAL_SIZE * SCORE_PAD * 0.55;

  const room = estimateTextWidth('88', SCORE_JAM_SIZE, 'bold');
  const jamPanel = room + pad * 2;
  const gap = SCORE_JAM_SIZE * SCORE_GAP;
  const totalPanel = SCORE_ROOM - gap - jamPanel;

  const totalHeight = CAP_HEIGHT * SCORE_TOTAL_SIZE + totalPad * 2;
  const jamHeight = CAP_HEIGHT * SCORE_JAM_SIZE + pad * 2;

  const left = 50 - (totalPanel + gap + jamPanel) / 2;
  const jamLeft = left + totalPanel + gap;
  const panel = panelColor(theme.background, theme.foreground);

  return teamKey(theme, {
    shapes: [
      plate(left, SCORE_BASELINE - totalHeight, totalPanel, totalHeight, panel, totalPad * 0.6),
      plate(jamLeft, SCORE_BASELINE - jamHeight, jamPanel, jamHeight, panel, pad * 0.7)
    ],
    texts: [
      teamName(theme, 20),
      teamText(theme, String(total), SCORE_BASELINE - totalPad, SCORE_TOTAL_SIZE, {
        x: left + totalPanel / 2,
        width: totalPanel - totalPad * 2,
        shadow: undefined
      }),
      teamText(theme, String(jam), SCORE_BASELINE - pad, SCORE_JAM_SIZE, {
        x: jamLeft + jamPanel / 2,
        width: room,
        shadow: undefined
      }),
      teamText(theme, `TRIP ${trip}`, 93, 11, { opacity: 0.7 })
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

/** The two lines every key on the Undo page but the informational one closes with. */
function holdToConfirm(color?: string): KeyText[] {
  return ['HOLD TO', 'CONFIRM'].map((text, index) => ({
    text,
    y: 76 + index * 12,
    size: 10,
    weight: 'bold' as const,
    opacity: 0.8,
    color
  }));
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

/** One of the choices CRG allows in place of an undone action, in CRG's words, colored by what it does. */
export function replaceChoiceKey(text: string, kind: ReplaceChoiceKind, level = 0): KeySpec {
  const background = CHOICE_BACKGROUNDS[kind];

  return {
    background,
    foreground: '#ffffff',
    shapes: [holdDial(level, UNDO_FOREGROUND, background)],
    texts: [{ text, y: 52, size: 17, weight: 'bold' }, ...holdToConfirm()]
  };
}

/** A key on a page with nothing to offer right now, drawn like an empty key. */
export function blankKey(): KeySpec {
  return { background: '#000000' };
}

/** Back, on the connection page. */
export function backKey(): KeySpec {
  return {
    background: '#27272a',
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

/** Red for disconnecting a connected deck, which cuts it off from CRG. */
const SEVERE_TEXT = '#f87171';

const SEVERE_DIAL = '#ef4444';

/**
 * CRG Connection: whether the plugin is connected, apart from a deck disconnected on purpose.
 *
 * The operator profile the deck keeps its settings under sits at the
 * foot of the key, in italics, so it reads as a name rather than a state.
 */
export function connectionKey(status: ConnectionStatus, operator = ''): KeySpec {
  const look = CONNECTION_LOOKS[status];

  const texts: KeyText[] = [
    { text: look.headline, y: 42, size: 19, weight: 'bold' },
    { text: look.detail, y: 66, size: 13, opacity: 0.85 }
  ];

  if (operator !== '') {
    texts.push({ text: operator, y: 90, size: 11, italic: true, opacity: 0.7 });
  }

  return { background: look.background, foreground: '#ffffff', accent: look.accent, texts };
}

/** The connection page's key: the state first, then what a hold does, in red while it would disconnect a connected deck. */
export function connectionToggleKey(status: ConnectionStatus, level = 0): KeySpec {
  const look = CONNECTION_LOOKS[status];
  const severe = status === 'connected';
  const hint: Partial<KeyText> = severe ? { weight: 'bold', color: SEVERE_TEXT } : { opacity: 0.8 };

  return {
    background: look.background,
    foreground: '#ffffff',
    accent: look.accent,
    shapes: [holdDial(level, severe ? SEVERE_DIAL : look.accent, look.background, 82, 24)],
    texts: [
      { text: look.detail, y: 50, size: 17, weight: 'bold' },
      { text: 'Hold to', y: 68, size: 12, ...hint },
      { text: look.verb, y: 82, size: 12, ...hint }
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
