import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { REGISTERED_PATHS, clock, game, isUnavailable, label, team, teamColor } from './paths.ts';

describe('path builders', () => {
  it('addresses the current game, so no game identifier is tracked', () => {
    assert.equal(game('StartJam'), 'ScoreBoard.CurrentGame.StartJam');
    assert.equal(team(1, 'Score'), 'ScoreBoard.CurrentGame.Team(1).Score');
    assert.equal(clock('Jam', 'Time'), 'ScoreBoard.CurrentGame.Clock(Jam).Time');
    assert.equal(label('Start'), 'ScoreBoard.CurrentGame.Label(Start)');
  });

  it('reads a color slot from the set it is asked for', () => {
    assert.equal(teamColor(1, 'bg'), 'ScoreBoard.CurrentGame.Team(1).Color(operator.bg)');
    assert.equal(teamColor(2, 'fg', 'preset'), 'ScoreBoard.CurrentGame.Team(2).Color(preset.fg)');
  });

  it('registers leaves rather than the whole game', () => {
    assert.ok(!REGISTERED_PATHS.includes('ScoreBoard.CurrentGame'));
    assert.ok(REGISTERED_PATHS.includes('ScoreBoard.CurrentGame.InJam'));
  });
});

describe('isUnavailable', () => {
  it('reads the marker CRG writes into an unusable label', () => {
    assert.ok(isUnavailable('---'));
    assert.ok(isUnavailable('No Action'));
    assert.ok(isUnavailable(''));
  });

  it('treats a real label as usable', () => {
    assert.ok(!isUnavailable('Start Jam'));
    assert.ok(!isUnavailable('End Timeout'));
  });
});
