import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'android/**', 'ios/**', 'coverage/**', 'expo-env.d.ts'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      // Existing screens use dynamic icon names and legacy backup payloads.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
