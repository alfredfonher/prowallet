import { config as baseConfig } from "../../packages/eslint-config/base.js";

export default [
  ...baseConfig,
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      ".turbo/**",
      "coverage/**",
      "prisma/**",
      "scripts/**",
    ],
  },
];
