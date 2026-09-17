// ESLint flat configuration, shared by the editor and the Super Linter
// workflow so both read the same rules
// https://eslint.org/docs/latest/use/configure/configuration-files

import { defineConfig, globalIgnores } from 'eslint/config';
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
