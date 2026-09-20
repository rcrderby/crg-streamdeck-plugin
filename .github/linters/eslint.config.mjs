// ESLint flat configuration, shared by the editor and the Super Linter
// workflow so both read the same rules
// https://eslint.org/docs/latest/use/configure/configuration-files

import { defineConfig, globalIgnores } from 'eslint/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import eslintPluginJsonc from 'eslint-plugin-jsonc';
import globals from 'globals';
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/**
 * Reads one of the jsonc plugin's flat configurations as an array.
 *
 * The plugin publishes them under a 'flat/' name, and the copy bundled
 * with Super Linter may be a release that does not, so both names are
 * tried and a single configuration is wrapped.
 */
function jsoncFlatConfig(name) {
  const config = eslintPluginJsonc.configs['flat/' + name] ?? eslintPluginJsonc.configs[name];

  return Array.isArray(config) ? config : [config];
}

/** The checkout this configuration file sits in. */
const ROOT = join(import.meta.dirname, '..', '..');

/** True where the packages the tsconfig builds on are installed, which the typed rules read. */
const typesAvailable = existsSync(join(ROOT, 'node_modules', '@tsconfig', 'node24', 'tsconfig.json'));

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    // Rollup writes the bundle Stream Deck loads
    '**/*.sdPlugin/bin/**',
    '**/*.sdPlugin/logs/**',
    // A vendored library, kept byte for byte as its author published it
    '**/ui/sdpi-components.js',
    'dist/**'
  ]),

  {
    files: ['**/*.ts'],

    extends: [js.configs.recommended],

    plugins: {
      '@typescript-eslint': tsPlugin
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },

    rules: {
      ...tsPlugin.configs.recommended.rules,
      // The compiler reports undefined and unused names, with the type
      // information ESLint does not have here
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-console': 'error'
    }
  },

  // Rules that need the compiler's types, which is what catches a promise
  // nobody waits for. They read the tsconfig, which builds on a package,
  // so they are left out where the packages are not installed: Super
  // Linter lints from a container of its own and never installs them. The
  // test workflow runs this same configuration after installing, which is
  // where these rules are enforced.
  ...(typesAvailable
    ? [
        {
          files: ['src/**/*.ts'],

          plugins: {
            '@typescript-eslint': tsPlugin
          },

          languageOptions: {
            parser: tsParser,
            parserOptions: {
              project: './tsconfig.json',
              tsconfigRootDir: ROOT
            }
          },

          rules: {
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            // The test runner's own describe and it return a promise
            // nobody is meant to wait for, which is the one exception here
            '@typescript-eslint/no-floating-promises': [
              'error',
              {
                allowForKnownSafeCalls: [
                  {
                    from: 'package',
                    package: 'node:test',
                    name: ['after', 'afterEach', 'before', 'beforeEach', 'describe', 'it']
                  }
                ]
              }
            ]
          }
        }
      ]
    : []),

  {
    files: ['**/*.mjs'],

    extends: [js.configs.recommended],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    }
  },

  // The plugin manifest and the tsconfig carry comments
  ...jsoncFlatConfig('recommended-with-json').map((config) => ({
    ...config,
    files: ['**/*.json']
  })),
  {
    files: ['**/*.json'],

    languageOptions: {
      parserOptions: {
        jsonSyntax: 'JSONC'
      }
    },

    rules: {
      'jsonc/no-comments': 'off'
    }
  }
]);
