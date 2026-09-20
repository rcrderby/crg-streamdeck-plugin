import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

/**
 * The property inspector library the plugin ships, kept byte for byte as
 * its author published it.
 *
 * It is a built file rather than a package, so nothing watches it for
 * updates. Raising the version means downloading the new file from
 * sdpi-components.dev and writing its version and checksum here, which
 * is the review the dependency manifest gives every other library.
 */
const VENDORED = {
  path: new URL('../com.rcrderby.crg-streamdeck.sdPlugin/ui/sdpi-components.js', import.meta.url),
  version: '4.0.1',
  sha256: 'f6c0dfd2ed68e18084b9952842b86e3850cf837d674704700c2a0718e0a24f6b'
};

describe('the vendored property inspector library', () => {
  const contents = readFileSync(VENDORED.path);

  it('is the version this plugin was built against', () => {
    assert.match(contents.toString('utf8').slice(0, 400), new RegExp(`sdpi-components v${VENDORED.version}`));
  });

  it('is the file that version publishes, unchanged', () => {
    assert.equal(createHash('sha256').update(contents).digest('hex'), VENDORED.sha256);
  });
});
