CRG Stream Deck plugin: offline Node.js kit, Node.js {{version}}
===============================================================

Stream Deck runs the CRG plugin on Node.js. The Stream Deck software
downloads Node.js the first time the plugin starts. A computer with no
Internet cannot install Node.js, and the plugin will fail to start.

This kit installs Node.js {{version}}, the release Stream Deck 7.6 uses,
from this device, without requiring Internet access. Each installer
checks the runtime's sha256 hash and its code signature before copying
and needs no administrator rights.

Before you start: install the Stream Deck software and CRG plugin,
and start Stream Deck once, so its folder structure exist. Then, quit the
Stream Deck software and run the applicable instal script for your platform.


Windows (x64 and ARM)
---------------------

1. Quit Stream Deck from its icon in the taskbar tray.
2. Open the 'windows' folder on this drive and double-click install.cmd.
   If Windows asks whether to run it, choose Run.
3. Read the result, press a key to close the window, and start Stream
   Deck.

Node.js installs to %APPDATA%\Elgato\StreamDeck\NodeJS\{{version}}


macOS (Apple silicon and Intel)
-------------------------------

1. Quit Stream Deck from its icon in the menu bar.
2. Open the 'macos' folder on this drive and double-click install.command.
   If macOS will not open it, open Terminal, type "bash " (with the
   space), drag install.command into the window, and press Return.
3. Read the result, close the window, and start Stream Deck.

Node.js installs to ~/Library/Application Support/com.elgato.StreamDeck/NodeJS/{{version}}


Checking the kit yourself
-------------------------

CHECKSUMS.txt lists the sha256 of each runtime in this kit.

  macOS, from this folder:      shasum -a 256 -c CHECKSUMS.txt
  Windows, in PowerShell:       Get-FileHash windows\x64\node.exe

The Windows runtimes are the files nodejs.org publishes as
win-x64/node.exe and win-arm64/node.exe, so their lines in CHECKSUMS.txt
match those lines in SHASUMS256.txt. Each Mac runtime is bin/node from
the node-v{{version}}-darwin archive listed in SHASUMS256.txt.

SHASUMS256.txt.asc is the Node.js release team's signature over
SHASUMS256.txt. With GnuPG and their public keys, listed at
https://github.com/nodejs/node#release-keys, check it with:

  gpg --verify SHASUMS256.txt.asc SHASUMS256.txt

The Windows runtime is signed by the OpenJS Foundation, and the Mac
runtime by the Node.js Foundation (Apple team HX7739G8FX). The installers
refuse a runtime signed by anyone else.


When to rebuild the kit
-----------------------

A later Stream Deck release may ask for a newer Node.js. If the plugin
won't start on an offline computer after a Stream Deck update, look in
Stream Deck's log for "Fetching Node.js version", and build a new kit
with the release it requires:

  node scripts/build-node-kit.mjs <version>

Stream Deck's log is StreamDeck0.log in %APPDATA%\Elgato\StreamDeck\logs
on Windows, and in ~/Library/Logs/ElgatoStreamDeck on macOS.


Undoing it
----------

Quit Stream Deck and delete the NodeJS folder named above. The next time
Stream Deck starts with with Internet access, it will downloads Node.js.
