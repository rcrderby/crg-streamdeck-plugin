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
- [Action Reference](#action-reference "Every Action And Its Settings")
- [Troubleshooting](#troubleshooting "Troubleshooting Information")
- [Contributing](#contributing "How To Contribute")

## Overview

This repository includes a plugin that allows you to control the [CRG ScoreBoard](https://github.com/rollerderby/scoreboard "CRG ScoreBoard Git Repository") application for roller derby interactively with an [Elgato Stream Deck](https://www.elgato.com/us/en/s/welcome-to-stream-deck "Elgato Stream Deck").

Every roller derby SBO [^1] has a preferred way to interact with the CRG Scoreboard application.  Some SBOs use a mouse exclusively, some use a mouse with a standard keyboard and small handful of key mappings, some use highly-customized keyboard controllers, and some even use gaming console controllers.  A Stream Deck is just another option to operate a roller derby scoreboard.

Each Stream Deck button is a small display, and this plugin connects to a CRG instance which allows the buttons show live game information and change their function based on the state of a game. For example, some buttons display live clock and score information, some use CRG `operator` colors for team-specific controls, and some dynamically change what they do.

Each button holds its own action, and you can customize a button layout that meets your needs and fits your specific Stream Deck model [[example](/docs/images/key-gallery.svg "Stream Deck XL Layout Image")].

## Features

- **Buttons display live game information:**  Scores, jam points, trip counts, clocks, timeouts, and much more.
- **CRG team colors on buttons:**  Buttons that control team specific functions use custom colors from CRG.  The `operator` colors are the first choice, team preset colors are next, and buttons default to black for Team 1 and white for Team 2 if no custom colors are set.
- **Buttons use CRG labels:**  Stream deck buttons use the same labels that CRG displays in the operator panel and on the scoreboard itself.
- **Active and inactive indicators:**  Buttons that change game status elements, like `NI` and `Star Pass`, have an indicator bar that is green when a button is active, and gray when a button is inactive.
- **Hold functions for sensitive actions:**  Some CRG buttons have more consequences than others.  For example, pressing `Undo` by mistake can change the state of a game in a way that isn't recoverable. On the Stream Deck, these buttons require a one-second hold to take action, and they display an indicator so it's clear that a timed hold is in progress.  Releasing these buttons early takes no action, so an accidental press doesn't disrupt a game.
- **Menus for button action options:**  Some buttons open a separate page of buttons that allow you to choose from several available actions.  For example, with `Enable Replace on Undo` enabled in CRG, a held press of the `Undo` button presents a menu of options for you to choose from.
- **CRG operator profile integration:**  The plugin creates and uses an operator profile named `StreamDeck` by default, and you can create new or select existing operator profiles to store or inherit operator settings.
- **Connect locally or over a network:**  The plugin tries to connect to a local instance of CRG (`http://localhost:8000`) by default, and you can change the URL to connect to a remote CRG instance (`http://192.168.0.67`).  The plugin stores the URL so you don't have to re-enter the URL each time you use your Stream Deck.
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

The plugin buttons should with with any Stream Deck Platform, although they've only ben tested on a Stream Deck XL.  The plugin includes expandable menu profiles for the following Stream Deck platforms:

|         **Platform**        |      **Tested**    | **Number of Keys** | **Number of Dials** |
| --------------------------- |:------------------:|:------------------:|:-------------------:|
| Stream Deck XL [^2]         | :white_check_mark: |         32         |         N/A         |
| Stream Deck MK.2 [^3]       | :x:                |         15         |         N/A         |
| Stream Deck + [^4]          | :x:                |          8         |          4          |
| Stream Deck Mini [^5]       | :x:                |          6         |         N/A         |
| Stream Deck Neo [^6]        | :x:                |          8         |         N/A         |

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

  TBD

</details>

<details>
  <summary>
    <strong>Add a `CRG Connection` button and connect it to your CRG instance</strong>
  </summary>

  The `CRG Connection` button allows you to configure the plugin to connect to CRG.

  1. Open the Stream Deck software and find the `CRG Scoreboard` category in the actions list on the right side.

  2. Drag a `CRG Connection` button to an open button space on the Stream Deck.

  3. Click on the `CRG Connection` button and set the `CRG URL` to the address of your scoreboard.  If you run the Stream Deck Software from your SBO computer, the Stream Deck will automatically connect to CRG (`http://localhost:8000`).

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

  Your Stream Deck and CRG are now set up to work together.  Start a new game and confirm the Stream Deck keys control the scoreboard correctly.

</details>

## Button Action Reference

Buttons that control one team take a `Team` setting.

<details>
  <summary>
    <strong>Game Control Buttons</strong>
  </summary>

| Action | Description |
| ------ | ----------- |
| `CRG Connection` | Shows whether the plugin is connected to CRG: connected, connecting, offline, not allowed to write, or disconnected on purpose.  Pressing it opens the connection page.  This key holds the `CRG URL` and `CRG Operator` settings for every CRG button. |
| `Jam Control` | Starts a jam, stops a jam, or ends a timeout, and shows the relevant clock and jam data.  It turns orange five seconds before a jam should start, and pulses if the lineup clock goes past the prescribed time in the active CRG ruleset. |
| `Timeout` | Starts an untyped timeout.  Its activity indicator is green until timeout type is assigned. |
| `Official Timeout` | Starts an official timeout.  Its activity indicator is green while an official timeout is running. |
| `Undo` | Undoes CRG's last clock action after a one-second hold.  It is subdued when there is nothing to undo.  Its `Enable Replace on Undo` configures that setting for the specified CRG operator profile.  While the setting is on, the hold opens an `Undo` menu instead of immediately performing an undo action. |

</details>

<details>
  <summary>
    <strong>Jammer Status Buttons</strong>
  </summary>

| Action | Description |
| ------ | ----------- |
| `Lead` | Shows and sets whether a team's jammer is lead. |
| `Lost Lead` | Shows and sets whether a team's jammer has lost lead.  Requires a one-second hold |
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
| `Team Timeout` | Starts a team timeout or assigns an untyped timeout.  Displays a dot for each timeout and its status.
| `Official Review` | Starts an official review or assigns an untyped timeout.  Displays a dot for a team that has its official review available.  Displays a plus sign if a team wins their first official review of a period, and a vertical line if a team wins a second official review within the same period. |

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
| `Clock` | Displays one CRG clock: period, jam, lineup, timeout, or intermission.  Each clock display the applicable CRG clock labels. |
| `Active Clock` | Displays the clock and label that are visible on the scoreboard itself. |

</details>

<details>
  <summary>
    <strong>Menu Button Pages</strong>
  </summary>

The plugin includes two small pages of keys and switches your Stream Deck to these menus as needed.  The first time a menu page opens on a Stream Deck, the Stream Deck software prompts the user to allow the page.

| Page | Opens | Buttons |
| ---- | ----- | ---- |
| `Connection` | Holding CRG Connection | Displays `Back`, and a button that shows the connection's state and allows manual connect and disconnect operations.  A Stream Deck that is manually disconnected remains in that state until it is connected again. |
| `Undo` | Holding Undo with `Enable Replace on Undo` on | Displays buttons indicating the available CRG replace options and CRG's `No Action` button, which confirms the undo action. |

</details>

<details>
  <summary>
    <strong>Plugin Data Storage</strong>
  </summary>

CRG recognizes devices by their HTTP session, so the plugin fetches a session cookie before it connects and retains it.  Without a session cookie, CRG sees your Stream Deck as a new device on every restart.

The Stream Deck software keeps the session cookie in the plugin settings, alongside the scoreboard that issued it.  This ensures that the Plugin only offers a session cookie to the correct CRG instance.

</details>

## Troubleshooting

The plugin writes a log of its connection and anything that goes wrong to:

| Platform | Location |
| -------- | -------- |
| macOS | `~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.rcrderby.crg-streamdeck.sdPlugin/logs/` |
| Windows | `%appdata%\Elgato\StreamDeck\Plugins\com.rcrderby.crg-streamdeck.sdPlugin\logs\` |

| `Connection` button label | What it means |
| ------------ | ------------- |
| `NO CRG`, and every key is dimmed | The plugin cannot reach CRG.  Check the `CRG URL` setting on a CRG Connection key, and confirm CRG is running and reachable from this computer.  The plugin keeps retrying on its own. |
| `Not allowed` | CRG will not let this device change the scoreboard.  Authorize it in CRG's `Settings` page under `Clients`.  The keys still show the game, because CRG permits reading game data. |
| `CRG Disconnected` | Your Stream Deck was disconnected manually and remains in this state across restarts.  Press and hold this button for one second to reconnect. |

## Contributing

Please consider sharing any Stream Deck content for CRG you create to this repository.  Some examples of things you can share include:

- Key layouts, within a Stream Deck Profile, for different models of controllers.
- Key designs for actions the plugin does not cover yet.
- Reports of CRG versions and Stream Deck software versions you have tested, so the [Compatibility](#compatibility "Compatibility Tables") tables can say more.

Please open an [Issue](https://github.com/rcrderby/crg-streamdeck-plugin/issues "Repository Issues") to report a problem or request features.

[^1]: Scoreboard Operator
[^2]: [Stream Deck XL](https://www.elgato.com/us/en/p/stream-deck-xl "Stream Deck XL")
[^3]: [Stream Deck MK.2](https://www.elgato.com/us/en/p/stream-deck-mk2-black "Stream Deck MK.2")
[^4]: [Stream Deck +](https://www.elgato.com/us/en/p/stream-deck-plus-black "Stream Deck +")
[^5]: [Stream Deck Mini](https://www.elgato.com/us/en/p/stream-deck-mini "Stream Deck Mini")
[^6]: [Stream Deck Neo](https://www.elgato.com/us/en/p/stream-deck-neo "Stream Deck Neo")
