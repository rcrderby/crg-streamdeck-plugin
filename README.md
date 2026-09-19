# Stream Deck Plugin for CRG

## Status

[![Super Linter](https://github.com/rcrderby/crg-streamdeck-plugin/actions/workflows/super-linter.yml/badge.svg)](https://github.com/rcrderby/crg-streamdeck-plugin/actions/workflows/super-linter.yml)
[![Run Tests](https://github.com/rcrderby/crg-streamdeck-plugin/actions/workflows/tests.yml/badge.svg)](https://github.com/rcrderby/crg-streamdeck-plugin/actions/workflows/tests.yml)
[![GitHub Issues](https://img.shields.io/github/issues/rcrderby/crg-streamdeck-plugin?label=Issues)](https://github.com/rcrderby/crg-streamdeck-plugin/issues)

## Contents

- [Overview](#overview "Plugin Overview")
- [Features](#features "Plugin Features")
- [Compatibility](#compatibility "Supported Versions And Platforms")
- [Getting Started](#getting-started "Setup Instructions")
- [Button Action Reference](#button-action-reference "All Button Settings")
- [Button Image Reference](/docs/button-image-reference.md "All Buttons and States")
- [Troubleshooting](#troubleshooting "Troubleshooting Information")
- [Contributing](#contributing "How To Contribute")

## Overview

This repository includes a plugin that allows you to control the [CRG ScoreBoard](https://github.com/rollerderby/scoreboard "CRG ScoreBoard Git Repository") application for roller derby interactively with an [Elgato Stream Deck](https://www.elgato.com/us/en/s/welcome-to-stream-deck "Elgato Stream Deck").

Every roller derby SBO [^1] has a preferred way to interact with the CRG Scoreboard application.  Some SBOs use a mouse exclusively, some use a mouse with a standard keyboard and small handful of key mappings, some use highly-customized keyboard controllers, and some even use gaming console controllers.  A Stream Deck is just another option to operate a roller derby scoreboard.

Each Stream Deck button is a small display, and this plugin connects to a CRG instance which allows the buttons to show live game information and change their function based on the state of a game.  For example, some buttons display live clock and score information, some use CRG `operator` colors for team-specific controls, and some dynamically change what they do.

Each button holds its own action, and you can customize a button layout that meets your needs and fits your specific Stream Deck model [[example](/docs/images/crg-streamdeck-plugin-preview.svg "Stream Deck XL Layout Image")].  This repository includes an example two-page layout you can import and adapt [[profile](/streamdeck-profiles/crg-live-1.streamDeckProfile "CRG Live 1 Stream Deck Profile")].

## Features

- **Buttons display live game information:**  Scores, jam points, trip counts, clocks, timeouts, and much more.
- **CRG team colors on buttons:**  Buttons that control team specific functions use custom colors from CRG.  The `operator` colors are the first choice, team preset colors are next, and buttons default to black for Team 1 and white for Team 2 if no custom colors are set.
- **Buttons use CRG labels:**  Stream deck buttons use the same labels that CRG displays in the operator panel and on the scoreboard itself.
- **Active and inactive indicators:**  Buttons that change game status elements, like `NI` and `Star Pass`, have an indicator bar that is green when a button is active, and gray when a button is inactive.
- **Hold functions for sensitive actions:**  Some CRG buttons have more consequences than others.  For example, pressing `Undo` by mistake can change the state of a game in a way that isn't recoverable. On the Stream Deck, these buttons require a one-second hold to take action, and they display an indicator so it's clear that a timed hold is in progress.  Releasing these buttons early takes no action, so an accidental press doesn't disrupt a game.
- **Menus for button action options:**  Some buttons open a separate page of buttons that allow you to choose from several available actions.  For example, with `Enable Replace on Undo` enabled in CRG, a held press of the `Undo` button presents a menu of options for you to choose from.  Buttons that always open a page, such as `CRG Connection` and `Automation`, carry a blue tab with a chevron in the lower right corner.
- **CRG operator profile integration:**  The plugin creates and uses an operator profile named `StreamDeck` by default, and you can create new or select existing operator profiles to store or inherit operator settings.
- **Connect locally or over a network:**  The plugin tries to connect to a local instance of CRG (`http://localhost:8000`) by default, and you can change the URL to connect to a remote CRG instance (`http://192.168.0.67:8000`).  The plugin stores the URL so you don't have to re-enter the URL each time you use your Stream Deck.
- **Computer sleep prevention:**  Using a Stream Deck to control CRG may mean that you don't touch the keyboard or mouse for an extended period.  While connected to CRG, the plugin keeps the computer and its display awake.

## Compatibility

| CRG Version | Description        |
| ----------- | ------------------ |
| 2027.x      | :white_check_mark: |
| 2025.x      | Not Tested         |
| Other       | :x:                |

| Stream Deck Software | Description        |
| -------------------- | ------------------ |
| 7.4 or later         | :white_check_mark: |
| 7.1 to 7.3           | Not Tested         |
| Earlier              | :x:                |

| Operating System     | Description        |
| -------------------- | ------------------ |
| macOS 12 or later    | :white_check_mark: |
| Windows 10 or later  | Not Tested         |

On Windows, keeping the computer awake while connected to CRG is a beta feature.

The plugin buttons should work with any Stream Deck Platform, although they've only been tested on a Stream Deck XL.  The plugin includes expandable menu profiles for the following Stream Deck platforms:

|        **Platform**         |    **Tested**      | **Number of Buttons** | **Number of Dials** |
| --------------------------- |:------------------:|:---------------------:|:-------------------:|
| Stream Deck XL [^2]         | :white_check_mark: |          32           |         N/A         |
| Stream Deck MK.2 [^3]       | :grey_question:    |          15           |         N/A         |
| Stream Deck + [^4]          | :grey_question:    |           8           |          4          |
| Stream Deck + XL [^5]       | :grey_question:    |          36           |          6          |
| Stream Deck Mini [^6]       | :grey_question:    |           6           |         N/A         |
| Stream Deck Neo [^7]        | :grey_question:    |           8           |         N/A         |
| Stream Deck Studio [^8]     | :grey_question:    |          32           |          2          |
| Stream Deck Mobile [^9]     | :grey_question:    |        Variable       |         N/A         |
| Stream Deck Virtual [^10]   | :white_check_mark: |        Variable       |         N/A         |

## Getting Started

These steps will help you set up the plugin to control CRG from a Stream Deck.  You need to have a computer running CRG.

<details>
  <summary>
    <strong>Download and install the Stream Deck software</strong>
  </summary>

  The Stream Deck software allows your computer to recognize and interact with a [Stream Deck](#compatibility "Stream Deck Platforms").  You must install the Stream Deck software before your Stream Deck will function.

  1. Open a web browser on your computer and navigate to [Elgato Software Downloads](https://www.elgato.com/us/en/s/downloads "Elgato Software Downloads").

  2. Locate and download the `Stream Deck` software for macOS or Windows.

  3. Install the Stream Deck software.

</details>

<details>
  <summary>
    <strong>Download and install the CRG plugin</strong>
  </summary>

  The plugin is a single file that installs on both macOS and Windows.

  1. Open the [latest release](https://github.com/rcrderby/crg-streamdeck-plugin/releases/latest "Latest Plugin Release") page.

  2. Under `Assets`, download `com.rcrderby.crg-streamdeck.streamDeckPlugin`.

  3. Open the downloaded file.  The Stream Deck software opens and asks you to confirm the installation.

  4. Confirm the `CRG Scoreboard` category appears in the actions list on the right side of the Stream Deck software.

  To update the plugin, download the file from a newer release and open it.  The new version replaces the installed version.

  > [!TIP]
  > Each release also includes a `SHA256SUMS` file, which you can use to confirm the plugin file downloaded completely.

</details>

<details>
  <summary>
    <strong>Add a `CRG Connection` button and connect it to your CRG instance</strong>
  </summary>

  The `CRG Connection` button allows you to configure the plugin to connect to CRG.

  1. Open the Stream Deck software and find the `CRG Scoreboard` category in the actions list on the right side.

  2. Drag a `CRG Connection` button to an open button space on the Stream Deck.

  3. Click on the `CRG Connection` button and set the `CRG URL` to the address of your scoreboard.  If you run the Stream Deck Software from your SBO computer, the Stream Deck will automatically connect to CRG (`http://localhost:8000`).

  > [!NOTE]
  > The example profile already includes a `CRG Connection` button, on its second page.

  4. Confirm the button reads `CRG Connected`.

</details>

<details>
  <summary>
    <strong>Add more buttons to customize your Stream Deck layout</strong>
  </summary>

  There are many buttons to choose from, and these steps outline a few that will help you get started.

  1. Drag the buttons you want from the `CRG Scoreboard` category to your Stream Deck, in whatever layout suits you.

  2. Select each button that controls a team-specific function and set their `Team` setting to the team you want each button to control.

  3. Select a `Clock` button and choose which clock it displays.

  4. Select each `Trip Points` button and choose how many points it puts on a trip.

</details>

<details>
  <summary>
    <strong>Test controlling CRG with the Stream Deck</strong>
  </summary>

  Your Stream Deck and CRG are now set up to work together.  Start a new game and confirm the Stream Deck buttons control the scoreboard correctly.

</details>

## Button Action Reference

Buttons that control one team take a `Team` setting, and display that team's name at the top in its CRG colors.  The [Button Image Reference](/docs/button-image-reference.md "Button Image Reference Page") page shows every button, and every state that each displays.

<details>
  <summary>
    <strong>Game Control Buttons</strong>
  </summary>

| Action | Description |
| ------ | ----------- |
| `CRG Connection` | Shows whether the plugin is connected to CRG: connected, connecting, offline, not allowed to write, or disconnected on purpose.  Pressing it opens the connection page.  This button holds the `CRG URL` and `CRG Operator` settings for every CRG button. |
| `Jam Control` | Starts a jam, stops a jam, or ends a timeout, and shows the relevant clock and jam data.  It turns orange five seconds before a jam should start, and pulses if the lineup clock goes past the prescribed time in the active CRG ruleset.  It turns red when the period has no time for another jam.  In overtime, it is red, then gold, then pulses.  It shows a faded `Start Jam` and takes no action while CRG will not start or stop a jam, such as after the official score is set. |
| `Timeout` | Starts an untyped timeout.  Its activity indicator turns green while a timeout runs without an assigned type. |
| `Official Timeout` | Starts an official timeout.  Its activity indicator is green while an official timeout is running. |
| `Undo` | Undoes CRG's last clock action after a one-second hold.  It is subdued when there is nothing to undo.  Its `Enable Replace on Undo` toggle configures that setting for the specified CRG operator profile.  While the setting is on, the hold opens an `Undo` menu instead of immediately performing an undo action. |
| `Automation` | Opens the `Automation` page, where `Auto End Jams` and `Auto End Team Timeouts` enable or disable those CRG settings. |
| `JRDA Options` | Displays or sets a JRDA rule state, chosen with its `Function` setting.  `Continuation Upcoming` displays a continued jam's remaining time, and sets CRG's `Continuation Upcoming` after a one-second hold.  It is darkened unless the ruleset allows continuations and `INJ` is set.  `Sudden Scoring` is informational, and displays `ENABLED` or `DISABLED`.  It is darkened when the ruleset does not allow sudden scoring. |
| `End of Period Controls` | Opens the `End of Period Controls` page. |

</details>

<details>
  <summary>
    <strong>Jammer Status Buttons</strong>
  </summary>

| Action | Description |
| ------ | ----------- |
| `Lead` | Shows and sets whether a team's jammer is lead.  Disabled during overtime and sudden scoring jams, which have no lead jammer. |
| `Lost Lead` | Shows and sets whether a team's jammer has lost lead.  Requires a one-second hold.  Disabled during overtime and sudden scoring jams, which have no lead jammer. |
| `Star Pass` | Shows and sets whether the team has passed the star.  CRG disables the `Star Pass` button for a team when `No Pivot` is active. |
| `No Pivot` | Shows and sets whether the team has no pivot in the current jam. |
| `NI` | Shows and sets whether the team's jammer is still on their initial trip. |
| `Injury` | Shows and sets whether a jam ended due to an injury. |

</details>

<details>
  <summary>
    <strong>Team Timeouts and Reviews Buttons</strong>
  </summary>

| Action | Description |
| ------ | ----------- |
| `Team Timeout` | Starts a team timeout or assigns an untyped timeout.  Displays a dot for each timeout and its status. |
| `Official Review` | Starts an official review or assigns an untyped timeout.  Displays a dot for a team that has its official review available.  Displays a plus sign if a team wins their first official review of a period, and a vertical line if a team wins a second official review within the same period. |
| `Official Review Options` | Marks a team's running official review as retained, or as taken as a team timeout, depending on its `Function` setting.  Its activity indicator is green while the option is set.  It is darkened, and takes no action, unless the team's official review is running.  `Review Retained` reads `Review Won` when the team has no retains left in the period. |

</details>

<details>
  <summary>
    <strong>Scoring Buttons</strong>
  </summary>

| Action | Description |
| ------ | ----------- |
| `Trip Points` | Assigns a fixed number of points, from 0 to 4, to a team's current scoring trip. |
| `Up 1` | Adds a point to a team's current scoring trip. |
| `Down 1` | Removes a point from a team's current scoring trip. |
| `Add Trip` | Adds a scoring trip for a team. |
| `Remove Trip` | Removes a team's last scoring trip. |
| `Score` | Shows a team's total score, its points in the active jam, and the jammer's trip number. |

</details>

<details>
  <summary>
    <strong>Clocks Buttons</strong>
  </summary>

| Action | Description |
| ------ | ----------- |
| `Clock` | Displays one CRG clock: period, jam, lineup, timeout, or intermission.  Each clock displays the applicable CRG clock labels. |
| `Active Clock` | Displays the clock and label that are visible on the scoreboard itself. |

</details>

<details>
  <summary>
    <strong>Menu Button Pages</strong>
  </summary>

The plugin includes five small pages of buttons and switches your Stream Deck to these menus as needed.  The first time a menu page opens on a Stream Deck, the Stream Deck software prompts the user to allow the page.

| Page | Opens | Buttons |
| ---- | ----- | ---- |
| `Connection` | Pressing `CRG Connection` | Displays `Back`, and a button that shows the connection's state and allows manual connect and disconnect operations.  A Stream Deck that is manually disconnected remains in that state until it is connected again. |
| `Undo` | Holding `Undo` with `Enable Replace on Undo` on | Displays buttons indicating the available CRG replace options and CRG's `No Action` button, which confirms the undo action.  Displays `Back`, which leaves the menu without answering CRG.  While CRG is still waiting, a press of `Undo`, without a hold, reopens the menu. |
| `Automation` | Pressing `Automation` | Displays `Back`, `Auto End Jams`, and `Auto End Team Timeouts`.  Each button turns its CRG setting on or off with a press, and its activity indicator is green when the setting is on.  These are global CRG settings, so a change applies to every device connected to CRG. |
| `End of Period Controls` | Pressing `End of Period Controls` | Displays `Back`, `Official Score`, `Timeout Before Period End`, `Start Overtime Lineup`, and `Show Clock During Final Score`.  `Official Score` requires a one-second hold, and displays `WAIT` with an estimated time if CRG delays the official score (`EnforceTimeToOr`).  `Start Overtime Lineup` requires a one-second hold, and is darkened until CRG allows overtime.  `Show Clock During Final Score` turns that CRG setting on or off. |
| `Timeout Before Period End` | Pressing `Timeout Before Period End` on the `End of Period Controls` page | Displays `Back`, the time to leave on the period clock, `Start Timeout`, and buttons that remove or add one second.  The time starts at `0:01` each time the page opens.  A one-second hold of `Start Timeout` starts an untyped timeout, sets the period clock to the chosen time, and returns to your layout.  `Back` returns to the `End of Period Controls` page. |

</details>

<details>
  <summary>
    <strong>Plugin Data Storage</strong>
  </summary>

CRG recognizes devices by their HTTP session, so the plugin fetches a session cookie before it connects and retains it.  Without a session cookie, CRG sees your Stream Deck as a new device on every restart.

The Stream Deck software keeps the session cookie in the plugin settings, alongside the scoreboard that issued it.  This ensures that the plugin only offers a session cookie to the correct CRG instance.

> [!WARNING]
> The Stream Deck software stores plugin settings unencrypted on disk, and every settings page in a plugin can read them.  No protected store is available to a plugin, so treat the session cookie as readable by anything running as your user.  The plugin never writes the cookie to its log, and it includes its own copy of every library its settings pages use rather than loading code from the internet.

</details>

## Troubleshooting

The plugin writes a log of its connection and anything that goes wrong to:

| Platform | Location |
| -------- | -------- |
| macOS | `~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.rcrderby.crg-streamdeck.sdPlugin/logs/` |
| Windows | `%appdata%\Elgato\StreamDeck\Plugins\com.rcrderby.crg-streamdeck.sdPlugin\logs\` |

| `Connection` button label | What it means |
| ------------ | ------------- |
| `NO CRG`, and every button is dimmed | The plugin cannot reach CRG.  Check the `CRG URL` setting on a `CRG Connection` button, and confirm CRG is running and reachable from this computer.  The plugin keeps retrying on its own. |
| `Not allowed` | CRG will not let this device change the scoreboard.  Authorize it in CRG's `Settings` page under `Clients`.  The buttons still show the game, because CRG permits reading game data. |
| `CRG Disconnected` | Your Stream Deck was disconnected manually and remains in this state across restarts.  Press this button to open the connection page, then hold its connect button for one second. |

## Contributing

Please consider sharing any Stream Deck content for CRG you create to this repository.  Some examples of things you can share include:

- Button layouts, within a Stream Deck Profile, for different models of controllers.
- Button designs for actions the plugin does not cover yet.
- Reports of CRG versions and Stream Deck software versions you have tested, so the [Compatibility](#compatibility "Compatibility Tables") tables can say more.

Please open an [Issue](https://github.com/rcrderby/crg-streamdeck-plugin/issues "Repository Issues") to report a problem or request features.

[^1]: Scoreboard Operator
[^2]: [Stream Deck XL](https://www.elgato.com/us/en/p/stream-deck-xl "Stream Deck XL")
[^3]: [Stream Deck MK.2](https://www.elgato.com/us/en/p/stream-deck-mk2-black "Stream Deck MK.2")
[^4]: [Stream Deck +](https://www.elgato.com/us/en/p/stream-deck-plus-black "Stream Deck +")
[^5]: [Stream Deck + XL](https://www.elgato.com/us/en/p/stream-deck-plus-xl "Stream Deck + XL")
[^6]: [Stream Deck Mini](https://www.elgato.com/us/en/p/stream-deck-mini "Stream Deck Mini")
[^7]: [Stream Deck Neo](https://www.elgato.com/us/en/p/stream-deck-neo "Stream Deck Neo")
[^8]: [Stream Deck Studio](https://www.elgato.com/us/en/p/stream-deck-studio "Stream Deck Studio")
[^9]: [Stream Deck Mobile](https://www.elgato.com/us/en/s/stream-deck-mobile "Stream Deck Mobile")
[^10]: [Stream Deck Virtual](https://www.elgato.com/us/en/s/downloads "Stream Deck Virtual, included with the Stream Deck software")
