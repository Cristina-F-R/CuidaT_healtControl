import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

export default defineConfig(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'client/public/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'vue/no-v-html': 'error',
    },
  },
  {
    files: ['shared/src/**/*.ts', 'server/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
    },
  },
  {
    files: ['server/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "ThrowStatement > NewExpression[callee.name='Error']",
        message: 'Use an AppError subclass (ValidationError, NotFoundError, UnauthorizedError).',
      }],
    },
  },
  {
    files: ['client/src/**/*.vue'],
    rules: {
      'max-lines': ['error', { max: 180, skipBlankLines: true, skipComments: true }],
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
    },
  },
);
