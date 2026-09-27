#!/usr/bin/env bash
# Installs the Node.js runtime Stream Deck needs from this kit
# to the Stream Deck folder for its runtime environments.
#
#     Double-click install.command, or: bash install.command
#
# Checks the runtime's sha256 against CHECKSUMS.txt and its code
# signature before copying anything, and needs no administrator rights.

set -euo pipefail

# The Apple developer team that signs Node.js: the Node.js Foundation
team='HX7739G8FX'

stop() {
  printf '\nNot installed: %s\n' "$1" >&2
  exit 1
}

kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(tr -d '[:space:]' <"${kit}/VERSION")"

if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  stop "the kit's VERSION file does not hold a release number."
fi

if pgrep -x 'Stream Deck' >/dev/null; then
  stop 'Stream Deck is running. Quit it from its icon in the menu bar, then run this again.'
fi

stream_deck="${HOME}/Library/Application Support/com.elgato.StreamDeck"

if [ ! -d "${stream_deck}" ]; then
  stop "no Stream Deck folder at ${stream_deck}. Install Stream Deck and start it once first."
fi

# The hardware, not this shell: under Rosetta, uname reports an Intel Mac
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = '1' ]; then
  arch='arm64'
else
  arch='x64'
fi

entry="macos/${arch}/node"
runtime="${kit}/${entry}"

if [ ! -f "${runtime}" ]; then
  stop "the kit is missing ${entry}."
fi

expected="$(awk -v entry="${entry}" '$2 == entry { print $1 }' "${kit}/CHECKSUMS.txt")"

if [ -z "${expected}" ]; then
  stop "CHECKSUMS.txt has no line for ${entry}."
fi

actual="$(shasum -a 256 "${runtime}" | awk '{ print $1 }')"

if [ "${actual}" != "${expected}" ]; then
  stop "${entry} does not match CHECKSUMS.txt. Expected ${expected}, found ${actual}."
fi

echo "Checked the sha256 of ${entry}"

if ! codesign --verify --strict "${runtime}" 2>/dev/null; then
  stop "macOS could not confirm the runtime's signature."
fi

# Read whole before matching: grep -q stops early, and the pipe that
# breaks would fail the check at random under pipefail
signing="$(codesign --display --verbose=2 "${runtime}" 2>&1 || true)"

if ! grep -qx "TeamIdentifier=${team}" <<<"${signing}"; then
  stop "the runtime is not signed by the Node.js Foundation (team ${team})."
fi

echo "Checked the signature: Node.js Foundation (${team})"

node_folder="${stream_deck}/NodeJS"
target="${node_folder}/${version}"
manifest="${node_folder}/manifest.json"

# Read before anything is written, so a manifest this cannot read stops the install untouched
read_json='JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))'

if [ -f "${manifest}" ] && ! "${runtime}" -e "${read_json}" "${manifest}" 2>/dev/null; then
  stop "Stream Deck's ${manifest} could not be read as JSON. Move it aside and run this again."
fi

mkdir -p "${target}"
cp "${runtime}" "${target}/node"
chmod 755 "${target}/node"
xattr -d com.apple.quarantine "${target}/node" 2>/dev/null || true

copied="$(shasum -a 256 "${target}/node" | awk '{ print $1 }')"

if [ "${copied}" != "${expected}" ]; then
  stop "the copy in ${target} does not match the kit. The drive may be failing."
fi

# The runtime just checked writes the manifest, keeping any other entry
# Stream Deck holds, such as Node.js 20
if ! "${target}/node" - "${manifest}" "${version}" <<'SCRIPT'; then
const fs = require('node:fs');
const [file, version] = process.argv.slice(2);
const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const others = (Array.isArray(current.nodejs) ? current.nodejs : []).filter((entry) => entry?.version !== version);
fs.writeFileSync(file, JSON.stringify({ ...current, nodejs: [...others, { path: `${version}/node`, version }] }));
SCRIPT
  stop "Stream Deck's ${manifest} could not be written."
fi

printf '\nInstalled Node.js %s for Stream Deck in %s\n' "${version}" "${target}"
echo 'Start Stream Deck. The plugin runs without the internet from now on.'
