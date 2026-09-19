/**
 * What the actions share.
 *
 * One CRG connection and one redraw scheduler serve every key, so a
 * full deck costs the scoreboard a single client.
 */

import { type CrgClient } from './crg/client.ts';
import { type OperatorChoice } from './operator-choice.ts';
import { type PeriodEndSeconds } from './period-end-seconds.ts';
import { type RenderScheduler } from './render/scheduler.ts';

/** Connecting and disconnecting on purpose, which the plugin remembers across restarts. */
export type ConnectionControl = {
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

export type PluginContext = {
  readonly client: CrgClient;
  readonly scheduler: RenderScheduler;
  readonly connection: ConnectionControl;
  readonly operator: OperatorChoice;
  readonly periodEndSeconds: PeriodEndSeconds;
};
