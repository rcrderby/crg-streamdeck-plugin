# Design Decisions

Numbered decisions for the CRG Stream Deck plugin. Where a code comment
and this file disagree, this file governs.

## D1: The plugin reads and writes `ScoreBoard.CurrentGame`

CRG mirrors the loaded game at `ScoreBoard.CurrentGame`, for reads and
for writes. Its own jam timer page binds `sbContext="ScoreBoard.CurrentGame"`
and writes `StartJam`, `StopJam`, `Timeout`, and `Team(n).*` through it.

No part of the plugin tracks a game identifier, and a new game needs no
reconnection or reconfiguration.

## D2: Leaf paths are registered, not subtrees

Registering `ScoreBoard.CurrentGame` would send every skater, penalty,
period, jam, and scoring trip in the game. `src/crg/paths.ts` names the
leaves the keys draw from instead.

## D3: One WebSocket serves the whole plugin

A Stream Deck XL holds thirty-two keys. Every action instance shares one
`CrgClient` and one `StateStore`, so a full deck costs CRG a single
client rather than thirty-two.

## D4: The CRG session is fetched, stored, and reused

CRG identifies a device by its HTTP session. The client fetches a
session cookie before opening the socket and keeps it in the plugin's
global settings.

A device that changes identity on every reconnect has to be authorized
again in CRG each time, and fills its client list with dead entries.

The session identifier is a credential for this device. It is written to
settings and never to the log.

## D5: Keys change what they do, not which action they are

Stream Deck cannot reassign a key's action while a game runs. A key
decides on press instead: `jam-control` sends `StopJam` during a jam and
`StartJam` otherwise.

Its wording comes from CRG's `Label(Start)` and `Label(Stop)`, which is
what CRG shows on its own operator buttons, so the deck and the console
never disagree.

## D6: Redraws are paced and de-duplicated

CRG sends clock updates faster than a Stream Deck should redraw.
`RenderScheduler` collects work by key and runs it on a tick, and
`CrgKeyAction` drops a redraw whose image matches the one already on the
key.

## D7: Nothing in the code knows the hardware

No action knows a key index, a grid size, or a device model. Keys are
drawn in a square `viewBox` with relative units, so one description fits
every Stream Deck. Layout belongs to a Stream Deck profile.

Supporting a Mini, an MK.2, a Plus, or a Neo is then a profile and a
token change rather than a code change.

## D8: Everything CRG sends is escaped or validated before it is drawn

Team names and colors are typed by an operator and drawn into generated
SVG. `escapeXml` escapes text, and `safeColor` uses a color only when it
reads as a hex color. This is the plugin's one injection surface, so it
is closed in one place rather than at each call site.

## D9: Contrast is enforced, not assumed

A league chooses its own operator colors, so the pair CRG holds can be
unreadable on a key. `readableForeground` keeps the chosen color when it
clears the WCAG ratio and substitutes black or white when it does not.

## D10: Node 24, Stream Deck 7.1

The manifest schema allows Node 24 only with `Software.MinimumVersion`
7.1 and `SDKVersion` 3, which is what the Elgato plugin template now
generates.

## D11: Tests run on `node:test` with no test framework

Node 24 runs TypeScript directly and ships a test runner, so the tests
add no dependency. Imports carry a `.ts` extension because Node's type
stripping requires it, and `rewriteRelativeImportExtensions` lets the
compiler read them.

## D12: `ws` is a direct dependency

The plugin must send a `Cookie` header when it opens the socket, which
the WebSocket built into Node cannot do. `ws` already arrives with
`@elgato/streamdeck`, so declaring it adds no supply chain and removes
a reliance on another package's dependency.

## D13: The ESLint version follows Super Linter

`.github/linters/eslint.config.mjs` is read by the editor and by CI. The
installed ESLint tracks the one Super Linter bundles so both evaluate
the same rules, rather than the editor passing code that CI rejects.

## D14: The development container is the toolchain

Nothing is installed on a developer's machine. `Dockerfile.dev` starts
from the Elgato-matching Node 24 image, pinned by digest, and adds
`pre-commit` for the gitleaks scan.

Stream Deck runs on the host, so the container covers install, lint,
type check, test, and build, and `streamdeck` runs on the host.

## D15: The artwork is a placeholder

The icons and key images are plain shapes. The design pass replaces
them, and the tokens it produces are what `src/render/` draws from.
