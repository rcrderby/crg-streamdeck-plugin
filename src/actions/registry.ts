/**
 * Every action the plugin registers, under the identifier its manifest entry carries.
 *
 * They are listed in the order the manifest lists them, which is the
 * order Stream Deck shows in its actions list: the game, then a jammer's
 * status, a team's timeouts and reviews, scoring, the displays, and the
 * keys that open a page. The keys within those pages follow.
 *
 * The identifiers sit together here rather than beside each class, so the
 * set the plugin registers can be read at a glance and checked against
 * the manifest. Stream Deck stores an identifier against every key a
 * person has already placed, so changing one empties those keys rather
 * than renaming them.
 */

import { type SingletonAction } from '@elgato/streamdeck';

import { ActiveClock } from './active-clock.ts';
import { AutoEndJams, AutoEndTeamTimeouts, Automation } from './automation.ts';
import { AddTrip, RemoveTrip, Score, TripPointsDown, TripPointsUp } from './scoring.ts';
import { Back, ConnectionToggle } from './connection-page.ts';
import { Clock } from './clock.ts';
import {
  ClockDuringFinalScore,
  EndOfPeriod,
  OfficialScore,
  OvertimeLineup,
  PeriodEndTimeout
} from './end-of-period.ts';
import { SecondsAtTimeout, SecondsDown, SecondsUp, StartPeriodEndTimeout } from './period-end-timeout.ts';
import { Connection } from './connection.ts';
import { Injury, Lead, LostLead, NoInitial, NoPivot, StarPass } from './team-flags.ts';
import { JamControl } from './jam-control.ts';
import { JrdaOptions } from './jrda-options.ts';
import { OfficialReview, TeamTimeout } from './team-resources.ts';
import { ReviewOptions } from './review-options.ts';
import { OfficialTimeout, Timeout, Undo } from './game-controls.ts';
import { ReplaceChoice, ReplaceConfirm, ReplaceInfo } from './replace-page.ts';
import { TripPoints } from './trip-points.ts';
import { named } from './key-action.ts';
import { type PluginContext } from '../context.ts';

/** How every one of this plugin's identifiers starts. */
const UUID = 'com.rcrderby.crg-streamdeck';

/** Builds every action, named as the manifest names it. */
export function keyActions(context: PluginContext): SingletonAction<never>[] {
  return [
    named(`${UUID}.connection`, new Connection(context)),
    named(`${UUID}.jam-control`, new JamControl(context)),
    named(`${UUID}.timeout`, new Timeout(context)),
    named(`${UUID}.official-timeout`, new OfficialTimeout(context)),
    named(`${UUID}.undo`, new Undo(context)),
    named(`${UUID}.lead`, new Lead(context)),
    named(`${UUID}.lost-lead`, new LostLead(context)),
    named(`${UUID}.star-pass`, new StarPass(context)),
    named(`${UUID}.no-pivot`, new NoPivot(context)),
    named(`${UUID}.no-initial`, new NoInitial(context)),
    named(`${UUID}.injury`, new Injury(context)),
    named(`${UUID}.team-timeout`, new TeamTimeout(context)),
    named(`${UUID}.official-review`, new OfficialReview(context)),
    named(`${UUID}.official-review-options`, new ReviewOptions(context)),
    named(`${UUID}.trip-score`, new TripPoints(context)),
    named(`${UUID}.trip-points-up`, new TripPointsUp(context)),
    named(`${UUID}.trip-points-down`, new TripPointsDown(context)),
    named(`${UUID}.add-trip`, new AddTrip(context)),
    named(`${UUID}.remove-trip`, new RemoveTrip(context)),
    named(`${UUID}.score`, new Score(context)),
    named(`${UUID}.clock`, new Clock(context)),
    named(`${UUID}.active-clock`, new ActiveClock(context)),
    named(`${UUID}.automation`, new Automation(context)),
    named(`${UUID}.jrda-options`, new JrdaOptions(context)),
    named(`${UUID}.end-of-period`, new EndOfPeriod(context)),
    named(`${UUID}.back`, new Back(context)),
    named(`${UUID}.connection-toggle`, new ConnectionToggle(context)),
    named(`${UUID}.replace-info`, new ReplaceInfo(context)),
    named(`${UUID}.replace-confirm`, new ReplaceConfirm(context)),
    named(`${UUID}.replace-choice`, new ReplaceChoice(context)),
    named(`${UUID}.auto-end-jams`, new AutoEndJams(context)),
    named(`${UUID}.auto-end-team-timeouts`, new AutoEndTeamTimeouts(context)),
    named(`${UUID}.official-score`, new OfficialScore(context)),
    named(`${UUID}.period-end-timeout`, new PeriodEndTimeout(context)),
    named(`${UUID}.overtime-lineup`, new OvertimeLineup(context)),
    named(`${UUID}.clock-during-final-score`, new ClockDuringFinalScore(context)),
    named(`${UUID}.period-end-seconds`, new SecondsAtTimeout(context)),
    named(`${UUID}.period-end-seconds-down`, new SecondsDown(context)),
    named(`${UUID}.period-end-seconds-up`, new SecondsUp(context)),
    named(`${UUID}.start-period-end-timeout`, new StartPeriodEndTimeout(context))
  ];
}
