import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['node_modules', 'dist', '.bun', 'vendor', '*.d.ts'],
  },

  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'prefer-const': 'error',
      'no-console': [
        'warn',
        { allow: ['log', 'info', 'warn', 'error', 'debug', 'time', 'timeEnd'] },
      ],

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Elysia / TypeBox 的 schema API 在类型检查规则下易产生误报
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  {
    files: ['**/*.js', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    ...eslintConfigPrettier,
    rules: {
      ...eslintConfigPrettier.rules,
      curly: ['error', 'all'],
    },
  },
]
