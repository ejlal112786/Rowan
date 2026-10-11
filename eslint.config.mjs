import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint configuration (flat config).
 *
 * `eslint-config-next` v16 ships native flat configs, so no eslintrc shim is
 * needed. ESLint is pinned to the v9 major because that is the major supported
 * by the React/import/jsx-a11y plugin versions that `eslint-config-next`
 * depends on (their peer ranges stop at `^9`).
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
  {
    rules: {
      // Rowan uses the App Router exclusively, so the Pages Router rule is not
      // applicable and only emits spurious "Pages directory cannot be found"
      // warnings.
      "@next/next/no-html-link-for-pages": "off",
      // Enforce `import type` so type-only imports never reach the bundle.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Server code logs through the redacting logger, never raw console calls.
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
    },
  },
  {
    // The structured logger is the single module allowed to write to stdout;
    // it applies redaction before emitting. Placed last so it wins over the
    // shared `no-console` rule above.
    files: ["src/lib/logger.ts"],
    rules: { "no-console": "off" },
  },
]);

export default eslintConfig;
