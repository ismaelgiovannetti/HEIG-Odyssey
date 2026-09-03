import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-playwright/**",
      "coverage/**",
      "node_modules/**",
      "out/**",
      "playwright-report/**",
      "public/**",
      "test-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
