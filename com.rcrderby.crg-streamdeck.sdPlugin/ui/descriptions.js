// Shows the action's description at the top of its property inspector:
// the summary, then each detail on its own line.
//
// Descriptions are edited here. The build writes each one into the
// action's Tooltip in manifest.json as a single line, reading them from
// CRG_DESCRIPTIONS, the one name this script shares.

// Wrapped so its names stay its own. Every property inspector script
// shares one global scope, and a name declared twice stops the second
// script dead before it runs.

(() => {
  const DESCRIPTIONS = {
    'com.rcrderby.crg-streamdeck.connection': {
      summary: 'CRG connection status.',
      details: ['Press for options.']
    },
    'com.rcrderby.crg-streamdeck.automation': {
      summary: 'Opens a page of CRG automation settings.'
    },
    'com.rcrderby.crg-streamdeck.jrda-options': {
      summary: 'Shows or sets the JRDA-specific settings.',
      details: [
        "Choose 'Continuation Upcoming' or 'Sudden Scoring' in the button's settings.",
        "'Continuation Upcoming' shows the time a continued jam would run. Requires a 1-second hold to enable.",
        "'Sudden Scoring' is activated automatically by the ruleset, so this button is informational only."
      ]
    },
    'com.rcrderby.crg-streamdeck.jam-control': {
      summary: "Changes between 'Start Jam', 'Stop Jam', and 'End Timeout', based on the game state."
    },
    'com.rcrderby.crg-streamdeck.clock': {
      summary: "Displays the clock you select: 'Lineup', 'Period', 'Jam', 'Timeout', or 'Intermission'.",
      details: ['Informational only.', 'Add multiple buttons to display different clocks.']
    },
    'com.rcrderby.crg-streamdeck.trip-score': {
      summary: "Sets points for a jammer's current trip.",
      details: ['Select the team and trip points, from 0 to 4.']
    },
    'com.rcrderby.crg-streamdeck.timeout': {
      summary: 'Starts an untyped timeout.',
      details: ['Remains active until you select a team timeout, official review, or official timeout.']
    },
    'com.rcrderby.crg-streamdeck.official-timeout': {
      summary: 'Starts an official timeout.'
    },
    'com.rcrderby.crg-streamdeck.undo': {
      summary: "Undoes CRG's last clock action.",
      details: ['Requires a 1-second hold.']
    },
    'com.rcrderby.crg-streamdeck.active-clock': {
      summary: 'Displays the clock and label that appear on the scoreboard.',
      details: ['Informational only.']
    },
    'com.rcrderby.crg-streamdeck.lead': {
      summary: 'Assigns or removes lead jammer status.'
    },
    'com.rcrderby.crg-streamdeck.lost-lead': {
      summary: "Assigns or removes 'Lost Lead' status for a jammer.",
      details: ['Requires a 1-second hold.']
    },
    'com.rcrderby.crg-streamdeck.star-pass': {
      summary: 'Assigns or removes a star pass for a team.',
      details: ["Disabled when 'No Pivot' is active."]
    },
    'com.rcrderby.crg-streamdeck.no-pivot': {
      summary: "Assigns or removes 'No Pivot' status for a team.",
      details: ['Disables the Star Pass button when enabled.']
    },
    'com.rcrderby.crg-streamdeck.no-initial': {
      summary: "Assigns or removes 'No Initial' (trip) status for a jammer."
    },
    'com.rcrderby.crg-streamdeck.official-review-options': {
      summary: "Marks a team's official review as retained, or as taken as a team timeout.",
      details: [
        "Choose 'Review Retained' or 'As a Team Timeout' in the button's settings.",
        "Available only while the team's official review is running.",
        "'Review Retained' reads 'Review Won' when the team has no retains left in the period."
      ]
    },
    'com.rcrderby.crg-streamdeck.injury': {
      summary: "Assigns or removes 'Injury' status for both teams in a jam."
    },
    'com.rcrderby.crg-streamdeck.team-timeout': {
      summary: 'Starts a team timeout or assigns an active timeout to a team.',
      details: ['Displays total and remaining timeouts.']
    },
    'com.rcrderby.crg-streamdeck.official-review': {
      summary: 'Starts an official review or assigns an active timeout to a team.',
      details: [
        "Displays the availability of a team's official review, and whether a team retained their review one or more times."
      ]
    },
    'com.rcrderby.crg-streamdeck.trip-points-up': {
      summary: "Adds one point to the current scoring trip's total."
    },
    'com.rcrderby.crg-streamdeck.trip-points-down': {
      summary: "Removes one point from the current scoring trip's total."
    },
    'com.rcrderby.crg-streamdeck.add-trip': {
      summary: 'Adds a new scoring trip for a team.'
    },
    'com.rcrderby.crg-streamdeck.remove-trip': {
      summary: "Removes a team's last scoring trip."
    },
    'com.rcrderby.crg-streamdeck.score': {
      summary:
        "Shows a team's total score, total points in the current jam, and a jammer's current trip count, including the initial trip.",
      details: ['Informational only.']
    },
    'com.rcrderby.crg-streamdeck.back': {
      summary: 'Returns to your layout.',
      details: ['Part of each page of buttons that the plugin opens.']
    },
    'com.rcrderby.crg-streamdeck.connection-toggle': {
      summary: 'Connects to or disconnects from CRG.',
      details: ['Stays disconnected until you connect again, even after a restart.', 'Requires a 1-second hold.']
    },
    'com.rcrderby.crg-streamdeck.replace-info': {
      summary: 'Shows the clock action CRG is waiting to replace.',
      details: ['Informational only.']
    },
    'com.rcrderby.crg-streamdeck.replace-confirm': {
      summary: "Confirms the undo with CRG's 'No Action', replacing it with nothing.",
      details: ['Requires a 1-second hold.']
    },
    'com.rcrderby.crg-streamdeck.replace-choice': {
      summary: 'Replaces the undone action with one of the choices CRG allows.',
      details: ['Requires a 1-second hold.']
    },
    'com.rcrderby.crg-streamdeck.auto-end-jams': {
      summary: "Turns CRG's 'Auto End Jams' setting on or off.",
      details: [
        'Part of the page that the Automation button opens.',
        'Changes the setting for every device connected to CRG.'
      ]
    },
    'com.rcrderby.crg-streamdeck.auto-end-team-timeouts': {
      summary: "Turns CRG's 'Auto End Team Timeouts' setting on or off.",
      details: [
        'Part of the page that the Automation button opens.',
        'Changes the setting for every device connected to CRG.'
      ]
    }
  };

  globalThis.CRG_DESCRIPTIONS = DESCRIPTIONS;

  const STYLE = `
  #description .summary { color: #d4d4d4; }
  #description .detail { margin-top: 4px; color: #9a9a9a; }
`;

  /** One line of a description, as its own block. */
  function line(text, className) {
    const block = document.createElement('div');

    block.className = className;
    block.textContent = text;

    return block;
  }

  window.SDPIComponents.streamDeckClient.getConnectionInfo().then(({ actionInfo }) => {
    const element = document.getElementById('description');
    const description = DESCRIPTIONS[actionInfo.action];

    if (element === null || description === undefined) {
      return;
    }

    const style = document.createElement('style');

    style.textContent = STYLE;
    document.head.append(style);

    element.replaceChildren(
      line(description.summary, 'summary'),
      ...(description.details ?? []).map((detail) => line(detail, 'detail'))
    );
  });
})();
