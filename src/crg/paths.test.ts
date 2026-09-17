import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  INTERMISSION_LABELS,
  REGISTERED_PATHS,
  SCORING_TRIP_IDS,
  SETTINGS_ROOT,
  TIMEOUTS,
  clock,
  game,
  isUnavailable,
  label,
  readTeam,
  rule,
  setting,
  team,
  teamColor
} from './paths.ts';

describe('path builders', () => {
  it('addresses the current game, so no game identifier is tracked', () => {
    assert.equal(game('StartJam'), 'ScoreBoard.CurrentGame.StartJam');
    assert.equal(team(1, 'Score'), 'ScoreBoard.CurrentGame.Team(1).Score');
    assert.equal(clock('Jam', 'Time'), 'ScoreBoard.CurrentGame.Clock(Jam).Time');
    assert.equal(label('Start'), 'ScoreBoard.CurrentGame.Label(Start)');
  });

  it('reads a color slot from the operator set', () => {
    assert.equal(teamColor(1, 'bg'), 'ScoreBoard.CurrentGame.Team(1).Color(operator.bg)');
    assert.equal(teamColor(2, 'fg'), 'ScoreBoard.CurrentGame.Team(2).Color(operator.fg)');
  });

  it('reads rules from the current game and settings from the scoreboard', () => {
    assert.equal(rule('Team.Timeouts'), 'ScoreBoard.CurrentGame.Rule(Team.Timeouts)');
    assert.equal(
      setting('ScoreBoard.Intermission.PreGame'),
      'ScoreBoard.Settings.Setting(ScoreBoard.Intermission.PreGame)'
    );
  });

  it('registers leaves rather than the whole game', () => {
    assert.ok(!REGISTERED_PATHS.includes('ScoreBoard.CurrentGame'));
    assert.ok(REGISTERED_PATHS.includes('ScoreBoard.CurrentGame.InJam'));
  });

  it('registers what the timeout, trip, and clock keys read', () => {
    for (const path of [...Object.values(TIMEOUTS), SCORING_TRIP_IDS]) {
      assert.ok(REGISTERED_PATHS.includes(path), path);
    }

    assert.ok(REGISTERED_PATHS.includes('ScoreBoard.CurrentGame.Clock(*).Name'));
    assert.ok(REGISTERED_PATHS.includes('ScoreBoard.CurrentGame.Team(*).InOfficialReview'));
  });

  it('registers the settings whole, which is the only way to reach a name inside parentheses', () => {
    assert.ok(REGISTERED_PATHS.includes(SETTINGS_ROOT));

    for (const path of Object.values(INTERMISSION_LABELS)) {
      assert.ok(path.startsWith(SETTINGS_ROOT), path);
      assert.ok(!REGISTERED_PATHS.includes(path), `${path} is already covered by ${SETTINGS_ROOT}`);
    }
  });

  it('registers no path twice', () => {
    assert.equal(new Set(REGISTERED_PATHS).size, REGISTERED_PATHS.length);
  });
});

describe('readTeam', () => {
  it('reads the second team from text or a number', () => {
    assert.equal(readTeam('2'), 2);
    assert.equal(readTeam(2), 2);
  });

  it('defaults to the first team', () => {
    assert.equal(readTeam('1'), 1);
    assert.equal(readTeam(undefined), 1);
    assert.equal(readTeam('three'), 1);
  });
});

describe('isUnavailable', () => {
  it('reads the marker CRG writes into an unusable label', () => {
    assert.ok(isUnavailable('---'));
    assert.ok(isUnavailable(''));
  });

  it('treats a real label as usable', () => {
    assert.ok(!isUnavailable('Start Jam'));
    assert.ok(!isUnavailable('End Timeout'));
  });

  it('treats CRG’s No Action as a real action, since a replacement can replace it', () => {
    assert.ok(!isUnavailable('No Action'));
  });
});
