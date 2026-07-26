/**
 * Configuración de Vitest con coverage
 * Coverage: 80% mínimo, 100% core functions
 */

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Configuración de entorno
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],

    // Configuración de coverage
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",

      // Thresholds de coverage
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Core functions 100%
        "./apps/web/hooks/purchase/validators.ts": {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        "./apps/api/src/services/price/validators.ts": {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        "./apps/api/src/services/redis/validators.ts": {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        // Infraestructura 0% (configuración, tipos, etc.)
        "./apps/web/hooks/purchase/types.ts": {
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0,
        },
        "./apps/api/src/services/price/types.ts": {
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0,
        },
        "./apps/api/src/services/redis/types.ts": {
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0,
        },
      },

      // Excluir archivos de infraestructura
      exclude: [
        "node_modules/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.{js,ts}",
        "**/dist/**",
        "**/build/**",
        "**/__tests__/**",
        "**/test/**",
        "**/tests/**",
        "**/*.test.{js,ts}",
        "**/*.spec.{js,ts}",

        // Archivos de infraestructura
        "**/types.ts",
        "**/config/**",
        "**/constants/**",
        "**/enums/**",
        "**/interfaces/**",

        // Archivos de configuración
        "**/vitest.config.{js,ts}",
        "**/jest.config.{js,ts}",
        "**/setupFiles/**",

        // Archivos generados
        "**/.next/**",
        "**/out/**",
        "**/lib/**",
      ],

      // Incluir solo archivos fuente
      include: [
        "apps/**/*.{js,ts,jsx,tsx}",
        "packages/**/*.{js,ts,jsx,tsx}",
        "!apps/**/*.d.ts",
        "!apps/**/*.config.{js,ts}",
        "!apps/**/dist/**",
        "!apps/**/build/**",
      ],

      // Watermarks para calidad
      watermarks: {
        statements: [80, 95],
        functions: [80, 95],
        branches: [80, 95],
        lines: [80, 95],
      },
    },

    // Configuración de tests
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,

    // Patrón de archivos de test
    include: [
      "**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],

    // Excluir archivos
    exclude: [
      "node_modules/",
      "dist/",
      "build/",
      ".next/",
      "coverage/",
      "**/*.config.{js,ts}",
    ],

    // Watch mode
    watchExclude: ["node_modules/", "dist/", "build/", "coverage/"],

    // Reporters
    reporters: ["verbose", "json", "html"],

    // Output directory
    outputFile: {
      html: "./coverage/html/index.html",
      json: "./coverage/json/report.json",
    },

    // Configuración de alias
    alias: {
      "@": resolve(__dirname, "./apps/web/src"),
      "@api": resolve(__dirname, "./apps/api/src"),
      "@shared": resolve(__dirname, "./packages/shared/src"),
    },
  },

  // Configuración de resolve
  resolve: {
    alias: {
      "@": resolve(__dirname, "./apps/web/src"),
      "@api": resolve(__dirname, "./apps/api/src"),
      "@shared": resolve(__dirname, "./packages/shared/src"),
    },
  },

  // Configuración de dependencias externas
  define: {
    "process.env.NODE_ENV": '"test"',
  },
});
