import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      // The legacy application has broad transport/React-Native boundaries
      // with 195 explicit-any annotations. TypeScript still checks the full
      // project; new integrity modules below are held to the strict rule while
      // legacy boundaries are migrated when touched.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
  {
    files: [
      "src/lib/chat-client.ts",
      "src/lib/api-types.ts",
      "src/lib/amenity-view.ts",
      "src/lib/chat-history.ts",
      "src/lib/chat-messages.ts",
      "src/lib/currency.ts",
      "src/lib/mutation-cache.ts",
      "src/lib/offline-schema.ts",
      "src/lib/sync-status.ts",
      "src/lib/system-status.ts",
      "src/hooks/use-offline-status.ts",
      "src/server/services/chatService.ts",
      "src/server/services/databaseIntegrity.ts",
      "src/server/services/systemDiagnostics.ts",
      "src/components/admin/system-status-card.tsx",
      "src/components/sync-status-banner.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    ignores: ["node_modules/", "dist/", ".expo/"],
  },
];
