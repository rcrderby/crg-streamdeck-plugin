#!/usr/bin/env bash
# Install the built plugin into the Stream Deck plugins folder.
#
#     scripts/install-plugin.sh
#
# Run this on the host, not in the development container, because the
# Stream Deck application runs on the host.
#
# The bundle is copied rather than symlinked. A symlink into a cloud
# storage folder such as iCloud Drive, Dropbox, or OneDrive hangs the
# Stream Deck application at startup: its plugin scan calls open() on a
# file the sync provider has to materialize first, and it waits for a
# file provider that may never answer.

set -euo pipefail

uuid='com.rcrderby.crg-streamdeck'
bundle="${uuid}.sdPlugin"

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_bundle="${repo}/${bundle}"
plugins="${HOME}/Library/Application Support/com.elgato.StreamDeck/Plugins"
target="${plugins}/${bundle}"

if [ ! -f "${source_bundle}/bin/plugin.js" ]; then
  echo "No build found. Run 'npm run build' in the development container first." >&2
  exit 1
fi

if [ ! -d "${plugins}" ]; then
  echo "No Stream Deck plugins folder at ${plugins}" >&2
  exit 1
fi

if [ -L "${target}" ]; then
  echo "Removing an existing symlink at ${target}"
  rm -f "${target}"
fi

mkdir -p "${target}"

# The plugin writes its own logs into the installed copy, so they stay.
rsync --archive --delete --exclude 'logs/' "${source_bundle}/" "${target}/"

echo "Installed ${bundle}"
echo "Restart the Stream Deck application to load it."
