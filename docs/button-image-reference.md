# Stream Deck Plugin Button Image Reference

This reference includes images of all of the plugin buttons and each of their states.

## Contents

- [Legend](#legend "Symbols, Colors, and Terms")
- [Game Control](#game-control "Game Control Buttons")
- [Jammer Status](#jammer-status "Jammer Status Buttons")
- [Team Timeouts and Reviews](#team-timeouts-and-reviews "Team Timeout And Official Review Buttons")
- [Scoring](#scoring "Scoring Buttons")
- [Clocks](#clocks "Clock Buttons")
- [Pages of Buttons](#pages-of-buttons "Menu Page Buttons")

Buttons for team-specific operations team take a `Team` setting, and appear in the images here in the colors of teams whose CRG `operator` colors are set to white text on a purple background (Team 1), and purple text on a white background (Team 2).  See the [Button Action Reference](../README.md#button-action-reference "Button Image Reference") for what each button does.

## Legend

This section describes the symbols, colors, and terms that appear on the plugin buttons.

<details>
  <summary>
    <strong>Universal symbols</strong>
  </summary>

- **Blue corner tab with an `i`.**  The button displays information only.  Pressing it takes no action.

  ![Informational Tab](./images/button-reference/legend/informational.svg "Informational Tab")

- **Blue corner tab with a chevron.**  Pressing the button opens a page of more buttons.  `Back`, in the top left corner of each page, returns to your layout.

  ![Page Tab](./images/button-reference/legend/opens-page.svg "Page Tab")

- **Top bar.**  Gray when the state a button controls is off.  Green when the state is on, or its timeout is running.

  ![Top Bar](./images/button-reference/legend/top-bar.svg "Top Bar")

- **Top bar filling during a hold.**  The top bar fills with the color the state changes to.  Releasing the button before the top bar fills cancels the action.

  ![Hold Progress](./images/button-reference/legend/hold-bar.svg "Hold Progress")

- **Red top bar filling during a hold.**  The hold disconnects the Stream Deck from CRG, or replaces an action that was undone.

  ![Red Hold Progress](./images/button-reference/legend/hold-bar-red.svg "Red Hold Progress")

- **Dial.**  Buttons without a top bar show hold progress as a dial in the upper right corner, which fills clockwise.

  ![Hold Dial](./images/button-reference/legend/hold-dial.svg "Hold Dial")

- **`HOLD`, `HOLD TO`.**  Press and hold the button for one second to commit the action.  A quick press takes no action.  On `Lost Lead`, `HOLD` sits in the top bar, and changes color as the bar fills behind it.

  ![Hold Captions](./images/button-reference/legend/hold-caption.svg "Hold Captions")

- **Darkened button.**  CRG is not connected, or the button has nothing to act on, such as `Undo` when there is nothing to undo.  Pressing it takes no action.

  ![Darkened Button](./images/button-reference/legend/darkened.svg "Darkened Button")

</details>

<details>
  <summary>
    <strong>Symbols and colors on specific buttons</strong>
  </summary>

- **Dots.**  `Team Timeout` and `Official Review` display a dot for each one remaining, and an outline for each one used.  An active timeout or review dot pulses until it ends.

  ![Dots](./images/button-reference/legend/dots.svg "Dots")

- **Plus sign, line.**  A plus sign indicates a team won its first official review of a period.  A line means the team won its second official review within the same period.

  ![Official Review Marks](./images/button-reference/legend/review-marks.svg "Official Review Marks")

- **Faded title.**  The team has no remaining reviews.

  ![Faded Title](./images/button-reference/legend/faded-title.svg "Faded Title")

- **Wording over an icon.**  CRG does not accept this button right now, and the wording describes why.  Pressing it takes no action.

  ![Reason Across the Icon](./images/button-reference/legend/reason.svg "Reason Across the Icon")

- **Score panels.**  The large panel is the team's total score, and the small panel is the team's points in the current jam.  The Team 1 and Team 2 buttons mirror each other to match the scoreboard.

  ![Score Panels](./images/button-reference/legend/score-panels.svg "Score Panels")

- **`Jam Control` colors.**  Green when a press starts a jam, orange five seconds before a jam should start, dark red when a press stops a jam, and bright red when a press ends a timeout. Red when the period has no time for another jam, and during overtime lineup. Gold five seconds before a jam should start. Pulses when the lineup runs past its time.  When there is no jam to start, such as after the score is final, the button shows a faded `Start Jam` and takes no action.

  ![Jam Control Colors](./images/button-reference/legend/jam-control-colors.svg "Jam Control Colors")

- **`CRG Connection` colors.**  Green when connected, yellow while connecting, red when offline, orange when CRG does not allow the Stream Deck to make changes, and gray when manually disconnected.

  ![CRG Connection Colors](./images/button-reference/legend/connection-colors.svg "CRG Connection Colors")

- **Clock activity top bar.**  `Clock` and `Active Clock` buttons show a green top bar while a clock runs, and a gray top bar while it is stopped.

  ![Clock Activity Top Bar](./images/button-reference/legend/clock-strip.svg "Clock Activity Top Bar")

- **Italic name.**  The CRG operator profile whose settings the Stream Deck uses.

  ![Operator Name](./images/button-reference/legend/operator-name.svg "Operator Name")

</details>

<details>
  <summary>
    <strong>Terms</strong>
  </summary>

| Term | Meaning |
| ---- | ------- |
| `NI` | No initial.  The jammer has not completed their initial trip. |
| `JAM` | The jam number from CRG.  On `Jam Control`, the active jam, or the jam that just ended. |
| `TRIP` | The jammer's current trip number, including the initial trip. |
| `LINEUP` | The lineup clock is running. |
| `POST TIMEOUT` | The post-timeout lineup clock is running. |
| `INTERMISSION` | The pre-game and between periods clock. |
| `COMING UP` | There is no pre-game clock or it has expired. |
| `NO CRG` | The plugin cannot reach CRG, or CRG does not allow the Stream Deck to make changes. |
| `NO PIVOT` | The team has no pivot in the current jam lineup, so CRG does not allow a star pass. |
| `REPLACE` ... `WITH` | On the `Undo` page, the action that was undone, and the buttons that can replace it. |

</details>

## Game Control

![Game Control Buttons](./images/button-reference/game-control.svg "Game Control Buttons")

## Jammer Status

![Jammer Status Buttons](./images/button-reference/jammer-status.svg "Jammer Status Buttons")

## Team Timeouts and Reviews

![Team Timeout and Official Review Buttons](./images/button-reference/team-timeouts-and-reviews.svg "Team Timeout And Official Review Buttons")

## Scoring

![Scoring Buttons](./images/button-reference/scoring.svg "Scoring Buttons")

## Clocks

![Clock Buttons](./images/button-reference/clocks.svg "Clock Buttons")

## Pages of Buttons

The plugin switches a Stream Deck to one of these pages when a button opens a menu, and switches back when the menu closes.

![Menu Page Buttons](./images/button-reference/pages-of-buttons.svg "Menu Page Buttons")
