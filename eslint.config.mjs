// Flat config. ESLint is the linter here because `typescript@6` still ships the
// compiler API that `typescript-eslint` needs; `typescript@7` does not.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      ".opencode/**",
    ],
  },

  js.configs.recommended,

  // Type-aware linting. The rules that matter most here (floating promises,
  // misused async handlers) cannot be detected from syntax alone.
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // One project per workspace. apps/api must use tsconfig.test.json: the
        // build tsconfig excludes tests, so type-aware rules would not see them.
        project: [
          "./apps/api/tsconfig.test.json",
          "./apps/web/tsconfig.json",
          "./packages/types/tsconfig.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused args are fine when prefixed; unused values are not.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Express handlers are routinely async; an unawaited promise there is a
      // silent 500 rather than a rejected request.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // `throw` only Error objects, so stack traces survive.
      "@typescript-eslint/only-throw-error": "error",
    },
  },

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs["recommended-latest"].rules,
  },

  // Plain JS: config files and the photo seeding script. No project, no types.
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: globals.node,
      parserOptions: { project: false, projectService: false },
    },
  },

  {
    // Tests assert on untyped HTTP bodies (`response.body` is `any` in
    // supertest) and implement async interfaces with fakes, so the unsafe-*
    // family and require-await would be noise rather than signal here.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
    },
  },

  // Must stay last: turns off every rule Prettier owns.
  prettier,
);
