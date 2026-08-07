// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const queryPlugin = require('@tanstack/eslint-plugin-query');

module.exports = defineConfig([
  expoConfig,
  ...queryPlugin.configs['flat/recommended'],
  {
    ignores: ['dist/*'],
  },
]);
