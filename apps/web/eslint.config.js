import { nextJsConfig } from "../../packages/eslint-config/next.js";

export default [
  ...nextJsConfig,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      ".turbo/**",
      "coverage/**",
    ],
  },
];
