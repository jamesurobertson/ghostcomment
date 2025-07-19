module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: [],
  extends: [
    'eslint:recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  globals: {
    NodeJS: 'readonly',
  },
  ignorePatterns: ['.eslintrc.js', 'jest.config.js', 'dist/**/*'],
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off', // CLI tools need console output
    'no-unused-vars': 'off', // Let TypeScript handle this
    'no-useless-escape': 'off', // Required escapes for regex patterns
  },
};