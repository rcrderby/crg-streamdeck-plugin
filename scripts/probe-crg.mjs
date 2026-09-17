// Reports what a live CRG instance holds, for checking the paths the
// keys read against a new CRG release.
//
//     node scripts/probe-crg.mjs
//     CRG_ORIGIN=http://scoreboard.local:8000 node scripts/probe-crg.mjs
//
// Reads only. From inside the development container, CRG on the host
// is at http://host.docker.internal:8000.

import { CrgClient } from '../src/crg/client.ts';
import { formatClock } from '../src/render/time.ts';
import { isUnavailable, label, team } from '../src/crg/paths.ts';
import { resolveConnection } from '../src/crg/settings.ts';
import { teamTheme } from '../src/render/theme.ts';

const origin = process.env.CRG_ORIGIN ?? 'http://localhost:8000';

const client = new CrgClient();

client.on('error', (cause) => console.error('error:', cause.message));
client.on('unauthorized', (message) => console.error('unauthorized:', message));

client.connect(resolveConnection({ url: origin }));

await new Promise((resolve) => setTimeout(resolve, 3000));

console.log(`status: ${client.status}`);
console.log(`device CRG lists: ${client.deviceName ?? '(unknown)'}`);
console.log(`paths held: ${client.state.size}`);

const startText = client.state.getString(label('Start'));
const stopText = client.state.getString(label('Stop'));

console.log('');
console.log(`Label(Start): ${JSON.stringify(startText)} available=${!isUnavailable(startText)}`);
console.log(`Label(Stop):  ${JSON.stringify(stopText)} available=${!isUnavailable(stopText)}`);
console.log(`Jam clock:    ${formatClock(client.state.getNumber('ScoreBoard.CurrentGame.Clock(Jam).Time'))}`);
console.log(`Period clock: ${formatClock(client.state.getNumber('ScoreBoard.CurrentGame.Clock(Period).Time'))}`);

for (const number of [1, 2]) {
  const theme = teamTheme(client.state, number);

  console.log(
    `Team ${number}: ${JSON.stringify(theme.name)} bg=${theme.background} fg=${theme.foreground} ` +
      `score=${client.state.getNumber(team(number, 'Score'))} ` +
      `trip=${client.state.getNumber(team(number, 'TripScore'))} ` +
      `noInitial=${client.state.getBoolean(team(number, 'NoInitial'))}`
  );
}

await client.disconnect();
process.exit(0);
