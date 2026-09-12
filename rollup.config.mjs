// Rollup bundles src/plugin.ts into the .sdPlugin folder that Stream
// Deck loads. The shape follows the Elgato plugin template.
// https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/

import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import path from 'node:path';
import url from 'node:url';

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = 'com.rcrderby.crg-streamdeck.sdPlugin';

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: 'src/plugin.ts',
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    sourcemap: isWatching,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) =>
      url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href
  },
  plugins: [
    {
      // A manifest edit changes what Stream Deck loads, so a watch run
      // rebuilds on it
      name: 'watch-externals',
      buildStart() {
        this.addWatchFile(`${sdPlugin}/manifest.json`);
      }
    },
    typescript({
      mapRoot: isWatching ? './' : undefined,
      // The test files run under node --test and are not bundled
      exclude: ['src/**/*.test.ts']
    }),
    nodeResolve({
      browser: false,
      exportConditions: ['node'],
      preferBuiltins: true
    }),
    commonjs(),
    !isWatching && terser(),
    {
      // Stream Deck reads the bundle as an ES module
      name: 'emit-module-package-file',
      generateBundle() {
        this.emitFile({ fileName: 'package.json', source: '{ "type": "module" }', type: 'asset' });
      }
    }
  ]
};

export default config;
