# Stream Deck Plugin for CRG

## Status

[![Super Linter](https://github.com/rcrderby/crg-streamdeck-plugin/actions/workflows/super-linter.yml/badge.svg)](https://github.com/rcrderby/crg-streamdeck-plugin/actions/workflows/super-linter.yml)
[![Run Tests](https://github.com/rcrderby/crg-streamdeck-plugin/actions/workflows/tests.yml/badge.svg)](https://github.com/rcrderby/crg-streamdeck-plugin/actions/workflows/tests.yml)
[![GitHub Issues](https://img.shields.io/github/issues/rcrderby/crg-streamdeck-plugin?label=Issues)](https://github.com/rcrderby/crg-streamdeck-plugin/issues)

## Contents

- [Overview](#overview "Plugin Overview")
- [Status And Scope](#status-and-scope "What Works Today")
- [How It Talks To CRG](#how-it-talks-to-crg "CRG WebSocket Integration")
- [Actions](#actions "Available Actions")
- [Compatibility](#compatibility "Supported Versions")
- [Development](#development "Development Environment")
- [Design Decisions](#design-decisions "Numbered Design Decisions")

## Overview

This repository holds a Stream Deck plugin for the [CRG Scoreboard](https://github.com/rollerderby/scoreboard "CRG ScoreBoard Git Repository").

The [`rcrderby/crg-streamdeck`](https://github.com/rcrderby/crg-streamdeck "Stream Deck Resources for CRG") repository controls CRG by sending keystrokes that match a CRG Operator profile.  That works, and it is one-way: the Stream Deck sends a keystroke and learns nothing back, so a key cannot show the clock, a score, or whether an action is even available right now.

This plugin talks to CRG's WebSocket directly.  Keys send scoreboard commands, receive live updates, and change what they show and what they do as the game state changes.

## Status And Scope

Early.  The connection, the state handling, the rendering, and three proof actions are in place and tested; the full key layout and its artwork are not.

The icons and key images in this repository are plain placeholder shapes.  A design pass replaces them, and produces the tokens the renderer draws from.

## How It Talks To CRG

CRG mirrors whichever game is loaded at `ScoreBoard.CurrentGame`, for reads and for writes, so nothing here tracks a game identifier.  Starting a new game in CRG needs no reconnection and no reconfiguration.

The plugin:

- Fetches an HTTP session from CRG, then opens one WebSocket for the whole plugin.  CRG identifies a device by its session, so it is stored and reused; a device that changes identity on every reconnect has to be authorized again each time.
- Registers for the specific leaf paths its keys draw from, rather than the whole game, which would send every skater, penalty, period, jam, and scoring trip.
- Sends a `Ping` every thirty seconds, and reconnects with a growing delay when the scoreboard goes away.
- Reports when CRG refuses a write, which happens when the device is not authorized to write in CRG's client list.

Reads and writes share one connection, so a full Stream Deck XL costs CRG a single client rather than thirty-two.

## Actions

| Action | Description |
| ------ | ----------- |
| CRG Connection | Shows whether the plugin is talking to CRG: connected, connecting, offline, or not allowed to write.  Pressing it reconnects at once. |
| Jam Control | Starts or stops a jam.  The key reads `InJam` to decide which, and takes its wording from the same `Label` paths CRG shows on its own Start and Stop buttons. |
| Clock | Displays a CRG clock: period, jam, lineup, timeout, or intermission, with its number and whether it is running. |
| Trip Score | Sets a team's trip score to a fixed number of points, drawn in that team's `operator` colors from CRG. |

## Compatibility

| Component | Version |
| --------- | ------- |
| CRG Scoreboard | 2027.x |
| Stream Deck software | 7.1 or later |
| Stream Deck hardware | Stream Deck XL is the focus; nothing in the code assumes it |

CRG's host, port, and use of TLS are settings, so the same build talks to a scoreboard on the same machine or one across the hall.

## Development

Everything runs in the development container.  Nothing is installed on the host.

1. Open the repository in Visual Studio Code and reopen it in the container.  The container carries Node.js 24, the Python that the comment checker runs on, and `pre-commit`.
2. Install the commit hooks once, from inside the container:

    ```bash
    pre-commit install
    ```

Then:

| Command | Description |
| ------- | ----------- |
| `npm run build` | Bundles the plugin into the `.sdPlugin` folder |
| `npm test` | Runs the tests on Node's own test runner |
| `npm run typecheck` | Type checks without emitting |
| `npm run lint` | Runs ESLint with the same configuration the CI workflow uses |
| `npm run format` | Checks formatting with Prettier |
| `npm run prose` | Holds comments to the house style |
| `npm run validate` | Validates the plugin against the Elgato schema |
| `npm run probe` | Reports what a live CRG instance holds, for checking paths against a new CRG release |
| `npm run install-plugin` | Copies the built bundle into the Stream Deck plugins folder, from the host |

The probe reads only, and never writes.  From inside the container, CRG running on the host is at `http://host.docker.internal:8000`:

```bash
CRG_ORIGIN=http://host.docker.internal:8000 npm run probe
```

### Testing On Hardware

The Stream Deck application runs on the host, not in the container, so the container covers install, lint, type check, test, and build, and installing to the hardware happens on the host.

1. Build in the container:

    ```bash
    npm run build
    ```

2. Install to Stream Deck, from the host:

    ```bash
    scripts/install-plugin.sh
    ```

3. Restart the Stream Deck application.

**Do not use `streamdeck link`, or any symlink, when the repository lives in a cloud storage folder.**  `~/Library/CloudStorage/...` covers iCloud Drive, Dropbox, OneDrive, and Google Drive on macOS.  Stream Deck's startup scan calls `open()` on the files it finds, the sync provider has to materialize each one first, and the application hangs on its main thread before it loads any plugin at all.  It looks like a frozen Stream Deck, with no error anywhere.

`scripts/install-plugin.sh` copies the bundle to local disk instead, which avoids the problem entirely.

## Design Decisions

Numbered decisions are recorded in [`docs/design/decisions.md`](./docs/design/decisions.md "Design Decisions").  Where a code comment and that file disagree, that file governs.
