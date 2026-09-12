/**
 * What the actions share.
 *
 * One CRG connection and one redraw scheduler serve every key, so a
 * full deck costs the scoreboard a single client.
 */

import { type CrgClient } from './crg/client.ts';
import { type RenderScheduler } from './render/scheduler.ts';

export type PluginContext = {
  readonly client: CrgClient;
  readonly scheduler: RenderScheduler;
};
