import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { StateStore } from '../crg/state.ts';
import {
  PANEL_CONTRAST,
  READABLE_RATIO,
  blend,
  contrastRatio,
  escapeXml,
  luminance,
  panelColor,
  readableForeground,
  readableOpacity,
  safeColor,
  teamTheme
} from './theme.ts';

describe('escapeXml', () => {
  it('escapes every character that can change markup', () => {
    assert.equal(escapeXml(`&<>"'`), '&amp;&lt;&gt;&quot;&apos;');
  });

  it('neutralizes a team name that carries markup', () => {
    const escaped = escapeXml('</text><script>alert(1)</script>');

    assert.ok(!escaped.includes('<'));
    assert.ok(!escaped.includes('>'));
  });

  it('leaves ordinary text alone', () => {
    assert.equal(escapeXml('Wheels of Justice'), 'Wheels of Justice');
  });
});

describe('safeColor', () => {
  it('accepts the hex forms CRG writes', () => {
    assert.equal(safeColor('#b3122e', '#000000'), '#b3122e');
    assert.equal(safeColor('#B3122E', '#000000'), '#B3122E');
  });

  it('normalizes a short form and drops alpha, so the renderer only ever sees six digits', () => {
    assert.equal(safeColor('#fff', '#000000'), '#ffffff');
    assert.equal(safeColor('#f00c', '#000000'), '#ff0000');
    assert.equal(safeColor('#b3122e80', '#000000'), '#b3122e');
  });

  it('trims surrounding space', () => {
    assert.equal(safeColor('  #b3122e  ', '#000000'), '#b3122e');
  });

  it('refuses anything that is not a hex color', () => {
    assert.equal(safeColor('red', '#000000'), '#000000');
    assert.equal(safeColor('', '#000000'), '#000000');
    assert.equal(safeColor(undefined, '#000000'), '#000000');
    assert.equal(safeColor('#b3122e" onload="x', '#000000'), '#000000');
    assert.equal(safeColor('url(#x)', '#000000'), '#000000');
  });
});

describe('luminance and contrastRatio', () => {
  it('places black and white at the ends', () => {
    assert.equal(luminance('#000000'), 0);
    assert.equal(luminance('#ffffff'), 1);
  });

  it('reads a short hex color the same as its long form', () => {
    assert.equal(luminance('#fff'), luminance('#ffffff'));
  });

  it('rates black against white at the maximum', () => {
    assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  });

  it('rates a color against itself at the minimum', () => {
    assert.equal(contrastRatio('#b3122e', '#b3122e'), 1);
  });
});

describe('readableForeground', () => {
  it('keeps a foreground that already reads', () => {
    assert.equal(readableForeground('#000000', '#ffffff'), '#ffffff');
  });

  it('replaces a foreground that does not read', () => {
    assert.equal(readableForeground('#ffffff', '#fefefe'), '#000000');
    assert.equal(readableForeground('#000000', '#010101'), '#ffffff');
  });
});

describe('readableOpacity', () => {
  const held = (background: string, foreground: string, wanted: number, ratio = READABLE_RATIO): number =>
    contrastRatio(blend(foreground, background, readableOpacity(background, foreground, wanted, ratio)), background);

  it('leaves a fade alone when the text still reads at it', () => {
    assert.equal(readableOpacity('#000000', '#ffffff', 0.8), 0.8);
  });

  it('gives back only as much of the fade as the ratio needs', () => {
    // A pair that only just clears the ratio at full strength.
    const marginal = readableForeground('#ffffff', '#767676');
    const opacity = readableOpacity('#ffffff', marginal, 0.7);

    assert.ok(opacity > 0.7, 'a marginal pair should be faded less');
    assert.ok(opacity < 1, 'it should still be faded');
    assert.ok(held('#ffffff', marginal, 0.7) >= READABLE_RATIO);
  });

  it('holds the ratio at every fade the designs ask for, on backgrounds a league might pick', () => {
    for (const background of ['#000000', '#ffffff', '#6b7280', '#38205b', '#eab308', '#7dd3fc']) {
      const foreground = readableForeground(background, '#ffffff');

      for (const wanted of [0.7, 0.75, 0.8, 0.85]) {
        assert.ok(
          held(background, foreground, wanted) >= READABLE_RATIO - 0.01,
          `${background} at ${wanted}: ${held(background, foreground, wanted)}`
        );
      }
    }
  });

  it('keeps a lower bar where the fade is the point, so spent text still reads as spent', () => {
    const spent = readableOpacity('#000000', '#ffffff', 0.38, 3);

    assert.equal(spent, 0.38);
  });

  it('fades nothing at all when the pair cannot reach the ratio even at full strength', () => {
    assert.equal(readableOpacity('#767676', '#6b7280', 0.8), 1);
  });
});

describe('teamTheme', () => {
  const path = (number: number, field: string) => `ScoreBoard.CurrentGame.Team(${number}).${field}`;

  it('reads the operator colors and the operator name', () => {
    const state = new StateStore();

    state.apply({
      [path(1, 'Color(operator.bg)')]: '#000000',
      [path(1, 'Color(operator.fg)')]: '#ffffff',
      [path(1, 'Color(operator.glow)')]: '#ff0000',
      [path(1, 'AlternateName(operator)')]: 'WOJ',
      [path(1, 'Name')]: 'Wheels of Justice'
    });

    const theme = teamTheme(state, 1);

    assert.equal(theme.background, '#000000');
    assert.equal(theme.foreground, '#ffffff');
    assert.equal(theme.glow, '#ff0000');
    assert.equal(theme.name, 'WOJ');
  });

  it('defaults the teams to opposites when CRG holds no operator colors', () => {
    const empty = new StateStore();

    assert.equal(teamTheme(empty, 1).background, '#000000');
    assert.equal(teamTheme(empty, 1).foreground, '#ffffff');
    assert.equal(teamTheme(empty, 2).background, '#ffffff');
    assert.equal(teamTheme(empty, 2).foreground, '#000000');
  });

  it('falls back to the preset set before the defaults', () => {
    const state = new StateStore();

    state.apply({ [path(2, 'Color(preset.bg)')]: '#38205b' });

    assert.equal(teamTheme(state, 2).background, '#38205b');
  });

  it('prefers the operator set over the preset set', () => {
    const state = new StateStore();

    state.apply({
      [path(1, 'Color(operator.bg)')]: '#b3122e',
      [path(1, 'Color(preset.bg)')]: '#38205b'
    });

    assert.equal(teamTheme(state, 1).background, '#b3122e');
  });

  it('ignores a set that is neither operator nor preset', () => {
    const state = new StateStore();

    state.apply({ [path(2, 'Color(whiteboard.bg)')]: '#38205b' });

    assert.equal(teamTheme(state, 2).background, '#ffffff');
  });

  it('uses the operator colors once they are set', () => {
    const state = new StateStore();

    state.apply({
      [path(1, 'Color(operator.bg)')]: '#b3122e',
      [path(1, 'Color(operator.fg)')]: '#ffffff'
    });

    assert.equal(teamTheme(state, 1).background, '#b3122e');
    assert.equal(teamTheme(state, 1).foreground, '#ffffff');
  });

  it('falls back through the names CRG may not have set', () => {
    const state = new StateStore();

    state.apply({ [path(1, 'Name')]: 'Wheels of Justice' });
    assert.equal(teamTheme(state, 1).name, 'Wheels of Justice');

    assert.equal(teamTheme(new StateStore(), 2).name, 'Team 2');
  });

  it('replaces a foreground the operator chose that cannot be read', () => {
    const state = new StateStore();

    state.apply({
      [path(1, 'Color(operator.bg)')]: '#000000',
      [path(1, 'Color(operator.fg)')]: '#0a0a0a'
    });

    assert.equal(teamTheme(state, 1).foreground, '#ffffff');
  });

  it('drops a glow color that is not a hex color', () => {
    const state = new StateStore();

    state.apply({ [path(1, 'Color(operator.glow)')]: 'rgb(1,2,3)' });

    assert.equal(teamTheme(state, 1).glow, undefined);
  });
});

describe('panelColor', () => {
  it('stands the same step from every key a league might pick', () => {
    const keys = ['#000000', '#ffffff', '#6b7280', '#38205b', '#eab308', '#84cc16', '#7dd3fc', '#78350f'];

    for (const background of keys) {
      const foreground = readableForeground(background, '#ffffff');
      const panel = panelColor(background, foreground);

      assert.ok(
        Math.abs(contrastRatio(panel, background) - PANEL_CONTRAST) < 0.02,
        `${background} should carry a panel at ${PANEL_CONTRAST} to 1, not ${contrastRatio(panel, background)}`
      );
    }
  });

  it('lifts a dark key toward its foreground, and drops a light one', () => {
    assert.ok(luminance(panelColor('#000000', '#ffffff')) > luminance('#000000'));
    assert.ok(luminance(panelColor('#ffffff', '#000000')) < luminance('#ffffff'));
  });
});
