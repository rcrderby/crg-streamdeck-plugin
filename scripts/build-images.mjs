// Draws the repository's key images from the same designs the plugin
// draws, so a picture cannot drift from what a deck shows.
//
//     node scripts/build-images.mjs
//
// Writes the deck preview, the key reference sheets, and the legend's
// examples under docs/images.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const IMAGES = new URL('docs/images/', ROOT);

const { renderKeySvg, VIEWBOX } = await import('../src/render/key.ts');
const d = await import('../src/render/designs.ts');
const { holdDial } = await import('../src/render/icons.ts');

export const IMAGE_SOURCES = ['src/render/designs.ts', 'src/render/icons.ts', 'src/render/key.ts'];

/** Two teams whose colors are as far apart as a league's usually are. */
const WHEELS = { background: '#38205b', foreground: '#ffffff', glow: '#000000', name: 'Wheels' };
const JUSTICE = { background: '#ffffff', foreground: '#38205b', glow: '#cbd5e1', name: 'Justice' };

const GAP = 14;
const EDGE = 20;
const RADIUS = 10;

const GROUND = '#000000';
const PAPER = '#141417';
const LABEL = '#d4d4d8';
const CAPTION = '#8b8b93';
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Escapes text so it cannot change the markup it is placed in. */
function escape(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

/** One key, drawn on a rounded tile the way a deck shows it. */
function tile(spec, x, y) {
  const inner = renderKeySvg(spec)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');

  return (
    `<svg x="${x}" y="${y}" width="${VIEWBOX}" height="${VIEWBOX}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">` +
    `<rect width="${VIEWBOX}" height="${VIEWBOX}" rx="${RADIUS}" fill="${GROUND}"/>` +
    `<g clip-path="inset(0 round ${RADIUS}px)">${inner}</g>` +
    `</svg>`
  );
}

function text(value, x, y, { size = 13, color = LABEL, weight = 'normal', anchor = 'start' } = {}) {
  return (
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" ` +
    `fill="${color}" text-anchor="${anchor}">${escape(value)}</text>`
  );
}

// ---------------------------------------------------------------------
// The deck preview: an XL mid jam, laid out the way an operator works a game.
// ---------------------------------------------------------------------

const DECK = [
  [
    d.jammerKey(WHEELS, 'lead', false),
    d.lostLeadKey(WHEELS, true),
    d.scoreKey(WHEELS, 113, 0, 1),
    d.jamControlKey('Stop Jam', '1:04', ['JAM 13'], d.JAM_STOP, false),
    d.clockKey('PERIOD 2', '12:26', true),
    d.scoreKey(JUSTICE, 109, 4, 3, true),
    d.lostLeadKey(JUSTICE, false),
    d.jammerKey(JUSTICE, 'lead', true)
  ],
  [
    d.noInitialKey(WHEELS, true),
    d.teamTimeoutKey(WHEELS, 3, 2, false),
    d.officialReviewKey(WHEELS, 1, 1, undefined, false),
    d.timeoutKey(['Official', 'Timeout'], false),
    d.timeoutKey(['Timeout'], false),
    d.officialReviewKey(JUSTICE, 1, 1, undefined, false),
    d.teamTimeoutKey(JUSTICE, 3, 1, false),
    d.noInitialKey(JUSTICE, false)
  ],
  [
    d.jammerKey(WHEELS, 'starPass', true),
    d.tripAdjustKey(WHEELS, true),
    d.tripAdjustKey(WHEELS, false),
    d.undoKey(),
    d.connectionKey('connected', 'StreamDeck'),
    d.tripAdjustKey(JUSTICE, false),
    d.tripAdjustKey(JUSTICE, true),
    d.jammerKey(JUSTICE, 'starPass', false)
  ],
  [
    d.tripPointsKey(WHEELS, 4),
    d.tripPointsKey(WHEELS, 3),
    d.tripPointsKey(WHEELS, 2),
    d.tripPointsKey(WHEELS, 1),
    d.tripPointsKey(JUSTICE, 1),
    d.tripPointsKey(JUSTICE, 2),
    d.tripPointsKey(JUSTICE, 3),
    d.tripPointsKey(JUSTICE, 4)
  ]
];

/** A grid of keys on one deck-colored ground, as a deck shows them. */
function deck(rows, label = '') {
  const columns = Math.max(...rows.map((row) => row.length));
  const width = EDGE * 2 + columns * VIEWBOX + (columns - 1) * GAP;
  const height = EDGE * 2 + rows.length * VIEWBOX + (rows.length - 1) * GAP;
  const keys = rows.flatMap((row, down) =>
    row.map((spec, across) => tile(spec, EDGE + across * (VIEWBOX + GAP), EDGE + down * (VIEWBOX + GAP)))
  );

  return {
    width,
    height,
    markup: `<rect width="${width}" height="${height}" rx="${EDGE}" fill="${GROUND}"/>${keys.join('')}`,
    label
  };
}

const preview = deck(DECK);

writeFileSync(
  fileURLToPath(new URL('crg-streamdeck-plugin-preview.svg', IMAGES)),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${preview.width} ${preview.height}" ` +
    `width="${preview.width}" height="${preview.height}" role="img" ` +
    `aria-label="A Stream Deck XL running the plugin's keys during a jam">${preview.markup}</svg>\n`
);

// ---------------------------------------------------------------------
// The reference sheet: every key, and every state that carries meaning.
// ---------------------------------------------------------------------

const SHEET = [
  {
    section: 'Game Control',
    actions: [
      {
        name: 'CRG Connection',
        slugs: ['connection'],
        keys: [
          ['Connected', d.connectionKey('connected', 'StreamDeck')],
          ['Connecting', d.connectionKey('connecting', 'StreamDeck')],
          ['Offline', d.connectionKey('disconnected', 'StreamDeck')],
          ['Not allowed', d.connectionKey('unauthorized', 'StreamDeck')],
          ['Manually disconnected', d.connectionKey('stopped', 'StreamDeck')]
        ]
      },
      {
        name: 'Automation',
        slugs: ['automation'],
        keys: [['Opens a page', d.automationKey()]]
      },
      {
        name: 'Jam Control',
        slugs: ['jam-control'],
        keys: [
          ['No active jam', d.jamControlKey('Start Jam', undefined, ['JAM 13'], d.lineupBackground('none'), false)],
          ['Lineup', d.jamControlKey('Start Jam', '0:21', ['LINEUP', 'JAM 13'], d.lineupBackground('none'), false)],
          [
            'Post timeout',
            d.jamControlKey('Start Jam', '0:21', ['POST TIMEOUT', 'JAM 13'], d.lineupBackground('none'), false)
          ],
          [
            'Lineup time short',
            d.jamControlKey('Start Jam', '0:27', ['LINEUP', 'JAM 13'], d.lineupBackground('due'), false)
          ],
          [
            'Lineup expired',
            d.jamControlKey('Start Jam', '0:32', ['LINEUP', 'JAM 13'], d.lineupBackground('over', 0.5), false)
          ],
          ['Jam active', d.jamControlKey('Stop Jam', '1:04', ['JAM 13'], d.JAM_STOP, false)],
          ['Timeout active', d.jamControlKey('End Timeout', '0:43', ['JAM 13'], d.TIMEOUT_RED, false)],
          ['Unavailable', d.jamControlKey('Start Jam', undefined, ['JAM 13'], d.JAM_IDLE, true)]
        ]
      },
      {
        name: 'Untyped timeout',
        slugs: ['timeout'],
        keys: [
          ['Inactive', d.timeoutKey(['Timeout'], false)],
          ['Active', d.timeoutKey(['Timeout'], true)]
        ]
      },
      {
        name: 'Official Timeout',
        slugs: ['official-timeout'],
        keys: [
          ['Inactive', d.timeoutKey(['Official', 'Timeout'], false)],
          ['Active', d.timeoutKey(['Official', 'Timeout'], true)]
        ]
      },
      {
        name: 'Undo',
        slugs: ['undo'],
        keys: [
          ['Ready', d.undoKey()],
          ['Pressed', d.undoKey(0.6)],
          ['Nothing to undo', { ...d.undoKey(), subdued: true }],
          ['Replace enabled', d.undoKey(0, false)],
          ['Pressed', d.undoKey(0.6, false)]
        ]
      }
    ]
  },
  {
    section: 'Jammer Status',
    actions: [
      {
        name: 'Lead',
        slugs: ['lead'],
        keys: [
          ['Not lead', d.jammerKey(WHEELS, 'lead', false)],
          ['Lead', d.jammerKey(WHEELS, 'lead', true)]
        ]
      },
      {
        name: 'Lost Lead',
        slugs: ['lost-lead'],
        keys: [
          ['Not lost', d.lostLeadKey(WHEELS, false)],
          ['Pressed', d.lostLeadKey(WHEELS, false, 0.6)],
          ['Lead lost', d.lostLeadKey(WHEELS, true)]
        ]
      },
      {
        name: 'Star Pass',
        slugs: ['star-pass'],
        keys: [
          ['No star pass', d.jammerKey(WHEELS, 'starPass', false)],
          ['Star pass', d.jammerKey(WHEELS, 'starPass', true)],
          ['Team has no pivot', d.jammerKey(WHEELS, 'starPass', false, 'NO PIVOT')]
        ]
      },
      {
        name: 'No Pivot',
        slugs: ['no-pivot'],
        keys: [
          ['Pivot in lineup', d.jammerKey(WHEELS, 'noPivot', false)],
          ['No pivot in lineup', d.jammerKey(WHEELS, 'noPivot', true)]
        ]
      },
      {
        name: 'NI',
        slugs: ['no-initial'],
        keys: [
          ['On initial trip', d.noInitialKey(WHEELS, true)],
          ['On scoring trip', d.noInitialKey(WHEELS, false)]
        ]
      },
      {
        name: 'Injury',
        slugs: ['injury'],
        keys: [
          ['Inactive', d.injuryKey(false)],
          ['Active', d.injuryKey(true)]
        ]
      }
    ]
  },
  {
    section: 'Team Timeouts and Reviews',
    actions: [
      {
        name: 'Team Timeout',
        slugs: ['team-timeout'],
        keys: [
          ['Three remaining', d.teamTimeoutKey(WHEELS, 3, 3, false)],
          ['One remaining', d.teamTimeoutKey(WHEELS, 3, 1, false)],
          ['None remaining', d.teamTimeoutKey(WHEELS, 3, 0, false)],
          ['In progress', d.teamTimeoutKey(WHEELS, 3, 2, true, 0.5)]
        ]
      },
      {
        name: 'Official Review',
        slugs: ['official-review'],
        keys: [
          ['One remaining', d.officialReviewKey(WHEELS, 1, 1, undefined, false)],
          ['First review won', d.officialReviewKey(WHEELS, 1, 1, 'retained', false)],
          ['Second review won', d.officialReviewKey(WHEELS, 1, 1, 'twice', false)],
          ['None remaining', d.officialReviewKey(WHEELS, 1, 0, undefined, false)],
          ['In progress', d.officialReviewKey(WHEELS, 1, 1, undefined, true, 0.5)]
        ]
      },
      {
        name: 'Official Review Options',
        slugs: ['official-review-options'],
        keys: [
          ['No review running', d.reviewOptionKey(WHEELS, 'retained', false, false)],
          ['Review running', d.reviewOptionKey(WHEELS, 'retained', false, true)],
          ['Retained', d.reviewOptionKey(WHEELS, 'retained', true, true)],
          ['No retains left', d.reviewOptionKey(WHEELS, 'retained', false, true, true)],
          ['As a team timeout', d.reviewOptionKey(JUSTICE, 'timeout', false, true)],
          ['Taken as a timeout', d.reviewOptionKey(JUSTICE, 'timeout', true, true)]
        ]
      }
    ]
  },
  {
    section: 'Scoring',
    actions: [
      {
        name: 'Trip Points',
        slugs: ['trip-score'],
        keys: [0, 1, 2, 3, 4].map((points) => [
          `${points} point${points === 1 ? '' : 's'}`,
          d.tripPointsKey(WHEELS, points)
        ])
      },
      {
        name: 'Up 1 and Down 1',
        slugs: ['trip-points-up', 'trip-points-down'],
        keys: [
          ['Add 1 point', d.tripAdjustKey(WHEELS, true)],
          ['Remove 1 point', d.tripAdjustKey(WHEELS, false)]
        ]
      },
      {
        name: 'Add Trip and Remove Trip',
        slugs: ['add-trip', 'remove-trip'],
        keys: [
          ['Add Trip', d.tripChangeKey(WHEELS, true)],
          ['Remove Trip', d.tripChangeKey(WHEELS, false)]
        ]
      },
      {
        name: 'Team 1 score - total and jam total',
        slugs: ['score'],
        keys: [
          ['Early in a game', d.scoreKey(WHEELS, 8, 4, 2)],
          ['Later in a game', d.scoreKey(WHEELS, 113, 0, 1)]
        ]
      },
      {
        name: 'Team 2 score - jam total and total',
        slugs: ['score'],
        keys: [
          ['Early in a game', d.scoreKey(JUSTICE, 6, 3, 2, true)],
          ['Later in a game', d.scoreKey(JUSTICE, 109, 14, 3, true)]
        ]
      }
    ]
  },
  {
    section: 'Clocks',
    actions: [
      {
        name: 'Clock',
        slugs: ['clock'],
        keys: [
          ['Period', d.clockKey('PERIOD 2', '12:26', true)],
          ['Jam', d.clockKey('JAM 13', '1:04', true)],
          ['Lineup', d.clockKey('LINEUP', '0:21', true)],
          ['Post timeout', d.clockKey('POST TIMEOUT', '0:21', true)],
          ['Untyped', d.clockKey('TIMEOUT', '0:43', true)],
          ['Intermission', d.clockKey('INTERMISSION', '5:00', true)]
        ]
      },
      {
        name: 'Active Clock',
        slugs: ['active-clock'],
        keys: [
          ['During a period', d.clockKey('PERIOD 2', '12:26', true)],
          ['Between periods', d.clockKey('INTERMISSION', '5:00', true)],
          ['Pre-game', d.clockKey('COMING UP', undefined, false)]
        ]
      }
    ]
  },
  {
    section: 'Pages of Buttons',
    actions: [
      {
        name: 'Connection page',
        slugs: ['back', 'connection-toggle'],
        keys: [
          ['Back', d.backKey()],
          ['Connected', d.connectionToggleKey('connected')],
          ['Pressed', d.connectionToggleKey('connected', 0.6)],
          ['Disconnected', d.connectionToggleKey('stopped')],
          ['Pressed', d.connectionToggleKey('stopped', 0.6)]
        ]
      },
      {
        name: 'Undo page',
        slugs: ['replace-info', 'replace-confirm', 'replace-choice'],
        keys: [
          ['Action to replace', d.replaceInfoKey('Stop Jam')],
          ['Confirm undo', d.replaceConfirmKey('No Action')],
          ['Start Jam', d.replaceChoiceKey('Start Jam', 'start')],
          ['Pressed', d.replaceChoiceKey('Start Jam', 'start', 0.6)],
          ['Stop Jam', d.replaceChoiceKey('Stop Jam', 'stop')],
          ['Timeout', d.replaceChoiceKey('Timeout', 'timeout')],
          ['No choice for this key', d.blankKey()]
        ]
      },
      {
        name: 'Automation page',
        slugs: ['auto-end-jams', 'auto-end-team-timeouts'],
        keys: [
          ['Off', d.automationToggleKey('endJams', false)],
          ['On', d.automationToggleKey('endJams', true)],
          ['Off', d.automationToggleKey('endTeamTimeouts', false)],
          ['On', d.automationToggleKey('endTeamTimeouts', true)]
        ]
      }
    ]
  }
];

/** Every action the sheet draws, so a new one cannot be left out of it. */
const drawn = new Set(SHEET.flatMap(({ actions }) => actions.flatMap((action) => action.slugs)));
const declared = JSON.parse(
  readFileSync(fileURLToPath(new URL('com.rcrderby.crg-streamdeck.sdPlugin/manifest.json', ROOT)), 'utf8')
).Actions.map((entry) => entry.UUID.slice(entry.UUID.lastIndexOf('.') + 1));
const missing = declared.filter((slug) => !drawn.has(slug));

if (missing.length > 0) {
  throw new Error(`The key reference draws no picture of: ${missing.join(', ')}`);
}

/** The pages as an operator meets them, in the positions the profiles place them. */
const PAGES = [
  {
    name: 'The connection page',
    rows: [[d.backKey(), d.connectionToggleKey('connected')]]
  },
  {
    name: 'The Undo page',
    rows: [
      [d.replaceInfoKey('Stop Jam'), d.replaceConfirmKey('No Action'), d.backKey()],
      [d.replaceChoiceKey('Start Jam', 'start'), d.replaceChoiceKey('Timeout', 'timeout'), d.blankKey()]
    ]
  },
  {
    name: 'The Automation page',
    rows: [[d.backKey(), d.automationToggleKey('endJams', false), d.automationToggleKey('endTeamTimeouts', true)]]
  }
];

const MARGIN = 30;
const COLUMNS = 6;
const CAPTION_DROP = 20;
const ROW_STEP = VIEWBOX + CAPTION_DROP + 30;
const NAME_DROP = 22;

const sheetWidth = MARGIN * 2 + COLUMNS * VIEWBOX + (COLUMNS - 1) * GAP;

/** One section of the reference, drawn as its own image. */
function drawSection(actions, extras = []) {
  const parts = [];
  let y = MARGIN;

  for (const action of actions) {
    for (let start = 0; start < action.keys.length; start += COLUMNS) {
      const chunk = action.keys.slice(start, start + COLUMNS);

      y += NAME_DROP;
      parts.push(
        text(start === 0 ? action.name : `${action.name}, continued`, MARGIN, y, { size: 14, weight: 'bold' })
      );
      y += 12;

      chunk.forEach(([caption, spec], index) => {
        const x = MARGIN + index * (VIEWBOX + GAP);

        parts.push(tile(spec, x, y));
        parts.push(
          text(caption, x + VIEWBOX / 2, y + VIEWBOX + CAPTION_DROP - 6, { size: 11, color: CAPTION, anchor: 'middle' })
        );
      });

      y += ROW_STEP;
    }
  }

  for (const page of extras) {
    const drawn = deck(page.rows);

    y += NAME_DROP;
    parts.push(text(page.name, MARGIN, y, { size: 14, weight: 'bold' }));
    y += 12;
    parts.push(
      `<svg x="${MARGIN}" y="${y}" width="${drawn.width}" height="${drawn.height}" ` +
        `viewBox="0 0 ${drawn.width} ${drawn.height}">${drawn.markup}</svg>`
    );
    y += drawn.height + 20;
  }

  const height = y + MARGIN - 20;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheetWidth} ${height}" ` +
    `width="${sheetWidth}" height="${height}" role="img" aria-label="Plugin buttons and the states they show">` +
    `<rect width="${sheetWidth}" height="${height}" fill="${PAPER}"/>${parts.join('')}</svg>\n`
  );
}

/** The file name a section goes by, which its page links to. */
function slugFor(section) {
  return section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const REFERENCE = new URL('button-reference/', IMAGES);

mkdirSync(fileURLToPath(REFERENCE), { recursive: true });

const written = SHEET.map(({ section, actions }) => {
  const file = `${slugFor(section)}.svg`;
  const extras = section === 'Pages of Buttons' ? PAGES : [];

  writeFileSync(fileURLToPath(new URL(file, REFERENCE)), drawSection(actions, extras));

  // The path as the page links it, which sits beside the page in docs/.
  return { section, path: `images/button-reference/${file}` };
});

// ---------------------------------------------------------------------
// The legend: each symbol and color shown on a button, as a deck shows it.
// ---------------------------------------------------------------------

const GENERIC_BACKGROUND = '#27272a';

/** A plain key, so a symbol that any key can carry is shown on its own. */
function generic({ hold = [], ...extra } = {}) {
  const label = { text: 'Button', y: hold.length > 0 ? 50 : 56, size: 17, weight: 'bold' };
  const captions = hold.map((line, index) => ({
    text: line,
    y: 76 + index * 12,
    size: 10,
    weight: 'bold',
    opacity: 0.8
  }));

  return { background: GENERIC_BACKGROUND, foreground: '#ffffff', texts: [label, ...captions], ...extra };
}

const LEGEND = [
  // Symbols any button can carry.
  ['informational', [['', generic({ informational: true })]]],
  ['opens-page', [['', generic({ opensPage: true })]]],
  [
    'top-bar',
    [
      ['Off', generic({ bar: { active: false } })],
      ['On', generic({ bar: { active: true } })]
    ]
  ],
  [
    'hold-bar',
    [
      ['Turning on', generic({ hold: ['HOLD'], bar: { active: false, progress: 0.6 } })],
      ['Turning off', generic({ hold: ['HOLD'], bar: { active: true, progress: 0.6 } })]
    ]
  ],
  [
    'hold-bar-red',
    [
      ['From on', generic({ hold: ['HOLD TO', 'DISCONNECT'], bar: { active: true, progress: 0.6, fill: 'danger' } })],
      ['From off', generic({ hold: ['HOLD TO', 'CONFIRM'], bar: { active: false, progress: 0.6, fill: 'danger' } })]
    ]
  ],
  [
    'hold-dial',
    [
      ['Held briefly', generic({ hold: ['HOLD'], shapes: [holdDial(0.3, d.UNDO_FOREGROUND, GENERIC_BACKGROUND)] })],
      ['Nearly done', generic({ hold: ['HOLD'], shapes: [holdDial(0.85, d.UNDO_FOREGROUND, GENERIC_BACKGROUND)] })]
    ]
  ],
  [
    'hold-caption',
    [
      ['', generic({ hold: ['HOLD'] })],
      ['', generic({ hold: ['HOLD TO', 'CONFIRM'] })]
    ]
  ],
  [
    'darkened',
    [
      ['Available', generic()],
      ['Darkened', generic({ subdued: true })]
    ]
  ],
  // Symbols and colors particular to one kind of button.
  [
    'dots',
    [
      ['Three left', d.teamTimeoutKey(WHEELS, 3, 3, false)],
      ['One left', d.teamTimeoutKey(WHEELS, 3, 1, false)],
      ['In use', d.teamTimeoutKey(WHEELS, 3, 2, true, 0.5)]
    ]
  ],
  [
    'review-marks',
    [
      ['Plus sign', d.officialReviewKey(WHEELS, 1, 1, 'retained', false)],
      ['Line', d.officialReviewKey(WHEELS, 1, 1, 'twice', false)]
    ]
  ],
  ['faded-title', [['None left', d.teamTimeoutKey(WHEELS, 3, 0, false)]]],
  ['reason', [['', d.jammerKey(WHEELS, 'starPass', false, 'NO PIVOT')]]],
  [
    'score-panels',
    [
      ['Team 1', d.scoreKey(WHEELS, 113, 4, 2)],
      ['Team 2', d.scoreKey(JUSTICE, 109, 4, 3, true)]
    ]
  ],
  [
    'jam-control-colors',
    [
      ['Start', d.jamControlKey('Start Jam', '0:21', ['LINEUP', 'JAM 13'], d.lineupBackground('none'), false)],
      ['Start soon', d.jamControlKey('Start Jam', '0:27', ['LINEUP', 'JAM 13'], d.lineupBackground('due'), false)],
      ['Stop', d.jamControlKey('Stop Jam', '1:04', ['JAM 13'], d.JAM_STOP, false)],
      ['End timeout', d.jamControlKey('End Timeout', '0:43', ['JAM 13'], d.TIMEOUT_RED, false)]
    ]
  ],
  [
    'connection-colors',
    [
      ['Connected', d.connectionKey('connected')],
      ['Connecting', d.connectionKey('connecting')],
      ['Offline', d.connectionKey('disconnected')],
      ['Not allowed', d.connectionKey('unauthorized')],
      ['Disconnected', d.connectionKey('stopped')]
    ]
  ],
  [
    'clock-strip',
    [
      ['Running', d.clockKey('PERIOD 2', '12:26', true)],
      ['Stopped', d.clockKey('PERIOD 2', '12:26', false)]
    ]
  ],
  ['operator-name', [['', d.connectionKey('connected', 'StreamDeck')]]]
];

const LEGEND_MARGIN = 10;

/** A legend example: its keys in a row, each captioned when a caption is given. */
function drawExample(keys) {
  const captioned = keys.some(([caption]) => caption !== '');
  const width = LEGEND_MARGIN * 2 + keys.length * VIEWBOX + (keys.length - 1) * GAP;
  const height = LEGEND_MARGIN * 2 + VIEWBOX + (captioned ? CAPTION_DROP : 0);
  const parts = keys.flatMap(([caption, spec], index) => {
    const x = LEGEND_MARGIN + index * (VIEWBOX + GAP);
    const label =
      caption === ''
        ? []
        : [
            text(caption, x + VIEWBOX / 2, LEGEND_MARGIN + VIEWBOX + CAPTION_DROP - 6, {
              size: 11,
              color: CAPTION,
              anchor: 'middle'
            })
          ];

    return [tile(spec, x, LEGEND_MARGIN), ...label];
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" role="img" aria-label="Example buttons">` +
    `<rect width="${width}" height="${height}" rx="${RADIUS}" fill="${PAPER}"/>${parts.join('')}</svg>\n`
  );
}

const LEGEND_IMAGES = new URL('legend/', REFERENCE);

mkdirSync(fileURLToPath(LEGEND_IMAGES), { recursive: true });

for (const [name, keys] of LEGEND) {
  writeFileSync(fileURLToPath(new URL(`${name}.svg`, LEGEND_IMAGES)), drawExample(keys));
  written.push({ section: `the legend's ${name} example`, path: `images/button-reference/legend/${name}.svg` });
}

// The page that carries these images is edited by hand, so the build
// checks it still shows every one of them rather than writing it.
const PAGE = fileURLToPath(new URL('docs/button-image-reference.md', ROOT));
const page = readFileSync(PAGE, 'utf8');
const unlinked = written.filter(({ path }) => !page.includes(path));

if (unlinked.length > 0) {
  throw new Error(`docs/button-image-reference.md shows no image for: ${unlinked.map((e) => e.section).join(', ')}`);
}

console.log(
  `wrote crg-streamdeck-plugin-preview.svg (${preview.width} by ${preview.height}) ` +
    `and ${written.length - LEGEND.length} reference images, with ${LEGEND.length} legend examples`
);
