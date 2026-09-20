import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderKeySvg } from './key.ts';
import {
  JAM_STOP,
  TIMEOUT_RED,
  automationKey,
  automationToggleKey,
  evenly,
  clockKey,
  connectionKey,
  injuryKey,
  jamControlKey,
  jammerKey,
  lineupBackground,
  lostLeadKey,
  noInitialKey,
  officialScoreKey,
  officialReviewKey,
  reviewOptionKey,
  scoreKey,
  teamTimeoutKey,
  timeoutKey,
  tripAdjustKey,
  tripChangeKey,
  tripPointsKey,
  undoKey
} from './designs.ts';
import { type TeamTheme, contrastRatio, panelColor } from './theme.ts';

const WHEELS: TeamTheme = { background: '#38205b', foreground: '#ffffff', glow: '#000000', name: 'Wheels' };

/** A key's drawing without the shadow copies behind its shapes, so each shape is counted once. */
function unshadowed(svg: string): string {
  return svg.replace(/<g transform="translate\(0\.6 0\.6\)">.*?<\/g>/g, '');
}

describe('jammer status keys', () => {
  it('put every caption on one line at one size', () => {
    for (const kind of ['lead', 'starPass', 'noPivot'] as const) {
      const [name, caption, ...rest] = jammerKey(WHEELS, kind, false).texts ?? [];

      assert.equal(name?.text, 'Wheels', kind);
      assert.equal(rest.length, 0, kind);
      assert.equal(caption?.size, 17, kind);
    }
  });

  it('carry the top bar, active or not', () => {
    assert.deepEqual(jammerKey(WHEELS, 'lead', true).bar, { active: true });
    assert.deepEqual(jammerKey(WHEELS, 'starPass', false).bar, { active: false });
    assert.deepEqual(noInitialKey(WHEELS, true).bar, { active: true });
  });

  it('shadow their text in the team’s glow color', () => {
    assert.equal(jammerKey(WHEELS, 'noPivot', false).texts?.[0]?.shadow, '#000000');
  });

  it('draw in the team’s colors', () => {
    const spec = jammerKey(WHEELS, 'lead', false);

    assert.equal(spec.background, '#38205b');
    assert.equal(spec.foreground, '#ffffff');
  });
});

describe('the Lost Lead key', () => {
  it('asks for a hold in its top bar, leaving its caption alone', () => {
    assert.deepEqual(
      (lostLeadKey(WHEELS, false).texts ?? []).map((line) => line.text),
      ['Wheels', 'Lost Lead']
    );
    assert.equal(lostLeadKey(WHEELS, false).bar?.label, 'HOLD');
  });

  it('carries the hold along its top bar rather than a dial', () => {
    assert.deepEqual(lostLeadKey(WHEELS, false, 0.4).bar, { active: false, progress: 0.4, label: 'HOLD' });
    assert.doesNotMatch(renderKeySvg(lostLeadKey(WHEELS, false, 0.4)), /stroke-width="2"/);
  });

  it('fills toward the state the hold will leave it in', () => {
    assert.match(renderKeySvg(lostLeadKey(WHEELS, false, 0.5)), /width="50" height="12" fill="#22c55e"/);
    assert.match(renderKeySvg(lostLeadKey(WHEELS, true, 0.5)), /width="50" height="12" fill="#52525b"/);
  });

  it('fills from the left turning on, and empties from the right turning off', () => {
    assert.match(renderKeySvg(lostLeadKey(WHEELS, false, 0.25)), /<rect width="25" height="12" fill="#22c55e"\/>/);
    assert.match(
      renderKeySvg(lostLeadKey(WHEELS, true, 0.25)),
      /<rect x="75" width="25" height="12" fill="#52525b"\/>/
    );
  });

  it('draws nothing along the bar before the key is held', () => {
    assert.equal((renderKeySvg(lostLeadKey(WHEELS, false)).match(/height="12"/g) ?? []).length, 1);
  });
});

describe('team resource keys', () => {
  it('subdue the title once a team has none left', () => {
    assert.equal(teamTimeoutKey(WHEELS, 3, 0, false).texts?.[1]?.opacity, 0.38);
    assert.equal(teamTimeoutKey(WHEELS, 3, 1, false).texts?.[1]?.opacity, undefined);
  });

  it('show the top bar while their timeout or review runs', () => {
    assert.equal(teamTimeoutKey(WHEELS, 3, 2, true).bar?.active, true);
    assert.equal(officialReviewKey(WHEELS, 1, 0, undefined, true).bar?.active, true);
  });

  it('mark a review won', () => {
    const svg = unshadowed(renderKeySvg(officialReviewKey(WHEELS, 1, 1, 'retained', false)));

    assert.equal((svg.match(/<line/g) ?? []).length, 2);
  });
});

describe('the team name', () => {
  /** Every team key, with or without a top bar. */
  const TEAM_KEYS = {
    lead: jammerKey(WHEELS, 'lead', true),
    starPassUnavailable: jammerKey(WHEELS, 'starPass', false, 'NO PIVOT'),
    lostLead: lostLeadKey(WHEELS, false),
    noInitial: noInitialKey(WHEELS, false),
    teamTimeout: teamTimeoutKey(WHEELS, 3, 2, false),
    officialReview: officialReviewKey(WHEELS, 1, 1, undefined, false),
    reviewRetained: reviewOptionKey(WHEELS, 'retained', false, true),
    reviewAsTimeout: reviewOptionKey(WHEELS, 'timeout', false, true),
    tripPoints: tripPointsKey(WHEELS, 4),
    upOne: tripAdjustKey(WHEELS, true),
    addTrip: tripChangeKey(WHEELS, true),
    score: scoreKey(WHEELS, 128, 12, 4)
  };

  it('sits on one line across every team key, below the top bar where there is one', () => {
    for (const [kind, spec] of Object.entries(TEAM_KEYS)) {
      const name = (spec.texts ?? []).find((line) => line.text === 'Wheels');
      const drawnAt = (name?.y ?? 0) + (spec.bar === undefined ? 0 : 4);

      assert.equal(drawnAt, 30, kind);
      assert.equal(name?.size, 11, kind);
    }
  });

  it('is drawn at full strength, in the team’s text color and glow', () => {
    for (const [kind, spec] of Object.entries(TEAM_KEYS)) {
      const name = (spec.texts ?? []).find((line) => line.text === 'Wheels');

      assert.equal(name?.opacity, undefined, kind);
      assert.equal(name?.color, WHEELS.foreground, kind);
      assert.equal(name?.shadow, WHEELS.glow, kind);
    }
  });

  it('spaces the score panels and the trip count evenly below the name', () => {
    const svg = unshadowed(renderKeySvg(scoreKey(WHEELS, 128, 12, 4)));
    const panels = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)" rx=/g)];
    const top = Math.min(...panels.map((found) => Number(found[1])));
    const bottom = Math.max(...panels.map((found) => Number(found[1]) + Number(found[2])));
    const trip = scoreKey(WHEELS, 128, 12, 4).texts?.find((line) => line.text.startsWith('TRIP'));
    const tripTop = (trip?.y ?? 0) - 11 * 0.72;
    const gaps = [top - 30, tripTop - bottom, 100 - (trip?.y ?? 0)];

    assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.5, `gaps ${gaps.join(', ')}`);
  });
});

describe('evenly', () => {
  it('leaves the same gap above, between, and below the blocks', () => {
    const [first = 0, second = 0] = evenly(28, 100, [30, 12]);

    assert.equal(first - 28, 10);
    assert.equal(second - (first + 30), 10);
    assert.equal(100 - (second + 12), 10);
  });
});

describe('jammer key layout', () => {
  it('puts every caption on one line, so a row of them lines up', () => {
    const captions = (['lead', 'starPass', 'noPivot'] as const).map(
      (kind) => jammerKey(WHEELS, kind, false).texts?.[1]?.y
    );

    assert.equal(new Set(captions).size, 1);
  });

  it('sets Lost Lead on Lead’s lines, with its circle at Lead’s size', () => {
    const lead = renderKeySvg(jammerKey(WHEELS, 'lead', false));
    const lost = renderKeySvg(lostLeadKey(WHEELS, false));
    const center = (svg: string): string | undefined => /translate\(50 ([\d.]+)\) scale/.exec(svg)?.[1];
    const radius = (svg: string): string | undefined =>
      /<circle cx="50" cy="38" r="([\d.]+)" fill="none"/.exec(svg)?.[1];
    const [, leadCaption] = jammerKey(WHEELS, 'lead', false).texts ?? [];
    const [, lostCaption] = lostLeadKey(WHEELS, false).texts ?? [];

    assert.ok(center(lead) !== undefined && radius(lead) !== undefined, 'the patterns should find the icon');
    assert.equal(center(lost), center(lead));
    assert.equal(radius(lost), radius(lead));
    assert.equal(lostCaption?.y, leadCaption?.y);
    assert.equal(lostCaption?.size, leadCaption?.size);
  });
});

describe('reviewOptionKey', () => {
  it('names its option under the team name', () => {
    assert.deepEqual(
      (reviewOptionKey(WHEELS, 'retained', false, true).texts ?? []).map((line) => line.text),
      ['Wheels', 'Review', 'Retained']
    );
    assert.deepEqual(
      (reviewOptionKey(WHEELS, 'timeout', false, true).texts ?? []).map((line) => line.text),
      ['Wheels', 'As a Team', 'Timeout']
    );
  });

  it('reads Review Won once the team has no retains left', () => {
    assert.equal(reviewOptionKey(WHEELS, 'retained', false, true, true).texts?.[2]?.text, 'Won');
  });

  it('shows the top bar while its option is set, and is darkened with no review running', () => {
    assert.deepEqual(reviewOptionKey(WHEELS, 'timeout', true, true).bar, { active: true });
    assert.equal(reviewOptionKey(WHEELS, 'timeout', false, false).subdued, true);
    assert.equal(reviewOptionKey(WHEELS, 'timeout', false, true).subdued, false);
  });
});

describe('shape shadows', () => {
  it('draws a team shape twice, the copy behind it in the glow color', () => {
    const svg = renderKeySvg(tripAdjustKey(WHEELS, true));

    assert.match(svg, /<g transform="translate\(0\.6 0\.6\)"><polygon[^>]*fill="#000000"/);
    assert.equal((svg.match(/<polygon/g) ?? []).length, 2);
  });

  it('draws a team shape once when the team has no glow', () => {
    const svg = renderKeySvg(tripAdjustKey({ ...WHEELS, glow: undefined }, true));

    assert.doesNotMatch(svg, /translate\(0\.6 0\.6\)/);
  });

  it('shadows the reason box on a key CRG will not act on, and leaves its faded icon flat', () => {
    const svg = renderKeySvg(jammerKey(WHEELS, 'starPass', false, 'NO PIVOT'));
    const copies = svg.match(/<g transform="translate\(0\.6 0\.6\)">(.*?)<\/g>/g) ?? [];

    assert.equal(copies.length, 1);
    assert.match(copies[0] ?? '', /^<g[^>]*><rect/);
  });

  it('gives the No Pivot stripe a shadow at full strength, though the stripe is faded', () => {
    const svg = renderKeySvg(jammerKey(WHEELS, 'noPivot', false));
    const [copy] = svg.match(/<g transform="translate\(0\.6 0\.6\)">.*?<\/g>/) ?? [];

    assert.ok(copy !== undefined);
    assert.doesNotMatch(copy, /opacity=/);
    assert.match(svg, /opacity="0\.45"/);
  });

  it('keeps a spent dot’s shadow as faded as the dot', () => {
    const svg = renderKeySvg(teamTimeoutKey(WHEELS, 3, 1, false));
    const [copy] = svg.match(/<g transform="translate\(0\.6 0\.6\)">.*?<\/g>/) ?? [];

    assert.match(copy ?? '', /opacity=/);
  });

  it('shadows the score numbers, as every other line of team text', () => {
    const texts = scoreKey(WHEELS, 128, 12, 4).texts ?? [];

    assert.ok(texts.every((line) => line.shadow === WHEELS.glow));
  });
});

describe('automation keys', () => {
  it('mark the Automation key as opening a page, with no bar and no “i”', () => {
    const spec = automationKey();

    assert.equal(spec.opensPage, true);
    assert.equal(spec.bar, undefined);
    assert.notEqual(spec.informational, true);
  });

  it('light the toggle’s top bar only while its setting is on', () => {
    assert.deepEqual(automationToggleKey('endJams', true).bar, { active: true });
    assert.deepEqual(automationToggleKey('endJams', false).bar, { active: false });
  });

  it('set a three line name smaller, and keep every line clear of the bar', () => {
    const two = automationToggleKey('endJams', false).texts ?? [];
    const three = automationToggleKey('endTeamTimeouts', false).texts ?? [];

    assert.deepEqual(
      three.map((line) => line.text),
      ['Auto End', 'Team', 'Timeouts']
    );
    assert.ok((three[0]?.size ?? 0) < (two[0]?.size ?? 0));
    assert.ok(
      three.every((line) => line.y - line.size > 16),
      'the first line should sit below the bar'
    );
  });
});

describe('connectionKey', () => {
  it('marks the key as opening a page', () => {
    assert.equal(connectionKey('connected').opensPage, true);
  });

  it('raises every line when it names an operator, so the name clears the page tab', () => {
    const texts = connectionKey('connected', 'Rose_City_Rollers').texts ?? [];

    assert.deepEqual(
      texts.map((line) => line.y),
      [34, 55, 75]
    );
  });

  it('keeps its two lines where they were with no operator named', () => {
    assert.deepEqual(
      (connectionKey('stopped').texts ?? []).map((line) => line.y),
      [42, 66]
    );
  });
});

describe('injuryKey', () => {
  it('carries the same top bar as every other key, in its own colors', () => {
    const spec = injuryKey(true);

    assert.deepEqual(spec.bar, { active: true });
    assert.equal(spec.background, '#7c2d12');
  });
});

describe('scoring keys', () => {
  it('draw Trip Points with no border, no dimming, and no accent', () => {
    const spec = tripPointsKey(WHEELS, 4);

    assert.equal(spec.accent, undefined);
    assert.equal(spec.bar, undefined);
    assert.equal(spec.texts?.[1]?.text, '+4');
    assert.equal(spec.texts?.[1]?.opacity, undefined);
  });

  it('carry the team name at the top', () => {
    for (const spec of [tripPointsKey(WHEELS, 2), tripAdjustKey(WHEELS, true), tripChangeKey(WHEELS, false)]) {
      assert.equal(spec.texts?.[0]?.text, 'Wheels');
    }
  });

  it('put the arrow left of the 1, the pair centered across the key', () => {
    const one = tripAdjustKey(WHEELS, false).texts?.[1];
    const arrow = /points="([\d.]+),/.exec(renderKeySvg(tripAdjustKey(WHEELS, false)));

    assert.ok((one?.x ?? 0) > 50);
    assert.ok(Number(arrow?.[1]) < 50);
  });

  it('set Up 1 and Down 1 on the same line and size as Trip Points', () => {
    const points = tripPointsKey(WHEELS, 4).texts?.[1];
    const one = tripAdjustKey(WHEELS, true).texts?.[1];

    assert.equal(one?.y, points?.y);
    assert.equal(one?.size, points?.size);
  });

  it('label the trip keys', () => {
    assert.equal(tripChangeKey(WHEELS, true).texts?.[1]?.text, 'Add Trip');
    assert.equal(tripChangeKey(WHEELS, false).texts?.[1]?.text, 'Remove Trip');
  });
});

describe('scoreKey', () => {
  /** The y, height and x of each panel, read back out of the drawing. */
  function panels(
    total: number,
    jam: number,
    mirrored = false
  ): { x: number; y: number; width: number; height: number }[] {
    const svg = unshadowed(renderKeySvg(scoreKey(WHEELS, total, jam, 2, mirrored)));

    return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx=/g)].map(
      (found) => ({
        x: Number(found[1]),
        y: Number(found[2]),
        width: Number(found[3]),
        height: Number(found[4])
      })
    );
  }

  it('stands both panels on one line, the jam points to the right', () => {
    const [totalPanel, jamPanel] = panels(11, 7);

    assert.ok(totalPanel !== undefined && jamPanel !== undefined, 'both numbers should sit on a panel');
    assert.equal(
      (totalPanel as { y: number; height: number }).y + (totalPanel as { height: number }).height,
      (jamPanel as { y: number; height: number }).y + (jamPanel as { height: number }).height
    );
    assert.ok((jamPanel as { x: number }).x > (totalPanel as { x: number }).x);
    assert.ok((totalPanel as { height: number }).height > (jamPanel as { height: number }).height);
  });

  it('puts team 2’s jam points on the left, mirroring the scoreboard', () => {
    const [totalPanel, jamPanel] = panels(11, 7, true);
    const [plainTotal, plainJam] = panels(11, 7);

    assert.ok(totalPanel !== undefined && jamPanel !== undefined && plainTotal !== undefined && plainJam !== undefined);
    assert.ok(jamPanel.x < totalPanel.x, 'the jam points should come first');
    assert.equal(jamPanel.x, plainTotal.x, 'the pair should span the same room either way');
    assert.equal(totalPanel.x + totalPanel.width, plainJam.x + plainJam.width);
    assert.equal(totalPanel.y + totalPanel.height, jamPanel.y + jamPanel.height, 'both should stand on one line');
  });

  it('draws each number over its own panel when mirrored', () => {
    const spec = scoreKey(WHEELS, 11, 7, 2, true);
    const [, total, jam] = spec.texts ?? [];

    assert.equal(total?.text, '11');
    assert.equal(jam?.text, '7');
    assert.ok((jam?.x ?? 0) < (total?.x ?? 0));
  });

  it('holds both panels still as the score climbs', () => {
    assert.deepEqual(panels(4, 7), panels(188, 12));
  });

  it('shrinks a long number into its panel rather than widening it', () => {
    const sizeOf = (svg: string, text: string): number =>
      Number(new RegExp(`font-size="([\\d.]+)"[^>]*>${text}<`).exec(svg)?.[1] ?? 0);

    const short = renderKeySvg(scoreKey(WHEELS, 11, 7, 2));
    const long = renderKeySvg(scoreKey(WHEELS, 11, 188, 2));

    assert.ok(sizeOf(long, '188') < sizeOf(short, '7'), 'a three digit jam total should be set smaller');
  });

  it('lifts the panels from the key rather than outlining them', () => {
    const svg = renderKeySvg(scoreKey(WHEELS, 11, 7, 2));

    assert.doesNotMatch(svg, /stroke=/, 'the panels should carry no border');
    assert.ok(svg.includes(panelColor(WHEELS.background, WHEELS.foreground)), 'the panels should be lifted');
  });

  it('shows the total, jam points, and trip, marked as doing nothing when pressed', () => {
    const spec = scoreKey(WHEELS, 74, 4, 3);

    assert.deepEqual(
      spec.texts?.map((line) => line.text),
      ['Wheels', '74', '4', 'TRIP 3']
    );
    assert.equal(spec.informational, true);
  });
});

describe('timeoutKey', () => {
  it('stays red whether or not its timeout is running', () => {
    assert.equal(timeoutKey(['Timeout'], false).background, TIMEOUT_RED);
    assert.equal(timeoutKey(['Timeout'], true).background, TIMEOUT_RED);
  });

  it('shows the top bar active while its timeout is running', () => {
    assert.deepEqual(timeoutKey(['Official', 'Timeout'], true).bar, { active: true });
    assert.deepEqual(timeoutKey(['Official', 'Timeout'], false).bar, { active: false });
  });

  it('stacks two lines around the middle', () => {
    assert.deepEqual(
      timeoutKey(['Official', 'Timeout'], false).texts?.map((line) => line.y),
      [46, 66]
    );
  });
});

describe('officialScoreKey', () => {
  it('draws the wait over the veil, larger, while the rest of the key stays under it', () => {
    const waiting = officialScoreKey('waiting', '0:02');
    const note = waiting.texts?.at(-1);

    assert.equal(waiting.subdued, true);
    assert.equal(note?.aboveVeil, true);
    assert.equal(note?.opacity, undefined, 'the wait carries no fade of its own');
    assert.ok((note?.size ?? 0) > 11, 'the wait is set larger than the note it replaces');
    assert.ok(waiting.texts?.slice(0, -1).every((line) => line.aboveVeil !== true));
  });

  it('leaves the note under the veil when the key can be used', () => {
    for (const state of ['ready', 'official'] as const) {
      assert.ok(
        officialScoreKey(state).texts?.every((line) => line.aboveVeil !== true),
        state
      );
    }
  });
});

describe('undoKey', () => {
  it('stands apart in amber on hazard striping', () => {
    const svg = renderKeySvg(undoKey());

    assert.match(svg, /fill="#1c1917"/);
    assert.match(svg, /rotate\(30 50 50\)/);
    assert.match(svg, />Undo</);
  });
});

describe('clockKey', () => {
  it('shows its title over its time, with a green accent while running, marked as doing nothing', () => {
    const spec = clockKey('POST TIMEOUT', '0:05', true);

    assert.deepEqual(
      spec.texts?.map((line) => line.text),
      ['POST TIMEOUT', '0:05']
    );
    assert.equal(spec.accent, '#22c55e');
    assert.equal(spec.informational, true);
    assert.equal(clockKey('LINEUP', '0:30', false).accent, '#3f3f46');
  });

  it('shows the title alone, on two lines when it is too wide, when the clock is hidden', () => {
    assert.deepEqual(
      clockKey('UNOFFICIAL SCORE', undefined, false).texts?.map((line) => line.text),
      ['UNOFFICIAL', 'SCORE']
    );
    assert.deepEqual(
      clockKey('HALFTIME', undefined, false).texts?.map((line) => line.text),
      ['HALFTIME']
    );
    assert.equal(clockKey('COMING UP', undefined, false).informational, true);
  });
});

describe('the Jam Control key', () => {
  it('leads with what a press does, and closes with the clock it shows', () => {
    const texts = jamControlKey('Start Jam', '0:12', ['LINEUP'], '#14532d', false).texts ?? [];

    assert.deepEqual(
      texts.map((line) => line.text),
      ['START JAM', '0:12', 'LINEUP']
    );
  });

  it('fills the key with the wording alone when no clock is running', () => {
    const texts = jamControlKey('Start Jam', undefined, [], '#14532d', false).texts ?? [];

    assert.deepEqual(
      texts.map((line) => line.text),
      ['START', 'JAM']
    );
  });

  it('stacks a two line foot, and gives the clock less room so both read at one size', () => {
    const one = jamControlKey('Start Jam', '0:21', ['LINEUP'], '#14532d', false).texts ?? [];
    const two = jamControlKey('Start Jam', '0:21', ['POST TIMEOUT', 'JAM 13'], '#14532d', false).texts ?? [];

    assert.deepEqual(
      two.map((line) => line.text),
      ['START JAM', '0:21', 'POST TIMEOUT', 'JAM 13']
    );

    for (const line of two.slice(2)) {
      assert.equal(line.size, 10, 'a stacked foot line keeps the size one line has');
    }

    assert.ok((two[1]?.y ?? 0) < (one[1]?.y ?? 0), 'the clock moves up to make room');
    assert.ok((two[2]?.y ?? 0) < (two[3]?.y ?? 0), 'the clock name sits above the jam number');
  });

  it('turns amber as the lineup falls due, and moves between the two once it is over', () => {
    assert.equal(lineupBackground('none'), '#14532d');
    assert.equal(lineupBackground('due'), '#f59e0b');
    assert.equal(lineupBackground('over', 0), '#14532d');
    assert.equal(lineupBackground('over', 1), '#f59e0b');
    assert.notEqual(lineupBackground('over', 0.5), lineupBackground('over', 0));
  });

  it('stands the warning apart from the lineup by brightness, not only by hue', () => {
    assert.ok(contrastRatio(lineupBackground('none'), lineupBackground('due')) > 3);
  });

  it('stays red through a lineup with no jam left in the period', () => {
    for (const warning of ['none', 'due', 'over'] as const) {
      assert.equal(lineupBackground(warning, 0.5, 'noMoreJams'), '#dd3333');
    }
  });

  it('runs an overtime lineup from red to amber, and moves between the two once it is over', () => {
    assert.equal(lineupBackground('none', 0, 'overtime'), '#dd3333');
    assert.equal(lineupBackground('due', 0, 'overtime'), '#f59e0b');
    assert.equal(lineupBackground('over', 0, 'overtime'), '#dd3333');
    assert.equal(lineupBackground('over', 1, 'overtime'), '#f59e0b');
  });

  it('sets the key’s words in the dark on the amber, and in white on every other Jam Control color', () => {
    const wordsOn = (background: string): string | undefined =>
      jamControlKey('Start Jam', '0:27', ['LINEUP'], background, false).foreground;

    assert.equal(wordsOn(lineupBackground('due')), '#0b0b0f');
    assert.equal(wordsOn(lineupBackground('none')), '#ffffff');
    assert.equal(wordsOn(lineupBackground('none', 0, 'overtime')), '#ffffff', 'the no more jams red');
    assert.equal(wordsOn(JAM_STOP), '#ffffff');
    assert.equal(wordsOn(TIMEOUT_RED), '#ffffff');
  });
});
