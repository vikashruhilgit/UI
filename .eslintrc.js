module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['@open-wc/eslint-config', 'eslint-config-prettier'],
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
    'import/no-unresolved': 'off',
    'import/extensions': 0,
  },
};
