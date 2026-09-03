// One flat config for the whole monorepo (ESLint resolves it by walking up
// from wherever it's invoked, so `apps/api`'s and `apps/web`'s own `lint`
// scripts both pick this up without a config file of their own). Kept
// intentionally lean — syntactic TypeScript rules plus the two React Hooks
// rules that catch real bugs (stale closures, conditional hooks), not a
// type-aware or stylistic ruleset. This is a baseline for the "lint" step
// in CI (build plan §10), not a style-enforcement project on its own.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "apps/api/src/database/migrations/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Deliberately-unused parameters are common and readable in this
      // codebase (destructured error handling, interface conformance) —
      // still flag genuinely unused local variables/imports.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      // Structured logging (Nest's Logger, or the frontends' error state)
      // is the convention here (build plan §18) — a stray console.log is
      // almost always leftover debugging, not intentional. The couple of
      // deliberate exceptions (main.ts's boot message, before Nest's own
      // logger exists yet) already carry their own disable comment.
      "no-console": "warn",
    },
  },
  {
    // CLI scripts a person runs directly (`pnpm db:migrate`, `pnpm
    // db:seed`) — console output here IS the point, not a debugging
    // leftover, unlike everywhere else covered by the no-console rule
    // above.
    files: ["apps/api/src/database/migrate.ts", "apps/api/src/database/seed.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/staff/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
