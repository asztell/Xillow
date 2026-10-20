# AGENTS.md — Xillow

Listing search across multiple MLS feeds: an Express + Postgres API and a React SPA.

`README.md` is the full reference (~27KB) — consult it for API reference, data
model, and trade-off rationale rather than duplicating it here.

## Commands

```bash
npm run gate                            # lint + format + typecheck + suite; one line on success
npm run typecheck                       # all workspaces
npm test                                # all workspaces
npm run lint                            # eslint, type-aware
npm run format                          # prettier --write across the repo
npm run build

npm run dev                             # api + web concurrently
npm run dev:api                         # tsx watch src/index.ts
npm run dev:web                         # vite

npm run seed                            # seed the database
npm run seed:photos                     # seed listing photos

npm run docker:up                       # recommended full stack
npm run docker:reset                    # down -v, destroys the volume
```

**Run npm scripts from the repo root.** They dispatch to the workspaces with
`-w`, and `typecheck` is meant to run across all of them at once. TypeScript is
`^6.0.3`; do not invoke `tsc` per package.

**Do not upgrade TypeScript to 7.** `typescript-eslint` needs the JS compiler
API (`createProgram`), which `typescript@7` no longer ships — it exposes only
the `tsc` binary. On 7 the linter cannot start at all. TypeScript 6 is the last
release that works with the lint stack.

`npm run gate` swallows passing output and prints only a `✓` or the real
failure. Prefer it over `npm test` — a passing suite in this repo is ~180 lines
of noise. Set `GATE_REQUIRE_DB=1` to fail when the api integration tests are
skipped, which is how CI asserts they really ran.

**`main` is protected, and the gate runs before it moves.** The repository is
public, so branch protection is free: `main` accepts only PRs whose
`lint + format + typecheck + tests` check is green and up to date, and rejects
direct pushes, force-pushes and deletions for administrators too. Locally,
`.githooks/pre-push` additionally runs the gate for any push that would update
`main`; `npm install` installs it via the root `prepare` script
(`git config core.hooksPath .githooks`). Feature branches are left to CI, which
runs on every push, and a `main guard` workflow opens an issue if `main` goes
red anyway. `git push --no-verify` bypasses the hook, so OpenCode denies that
command (`.opencode/opencode.json`); do not work around it.

Lint is **ESLint** with `typescript-eslint` type-aware rules; config is
`eslint.config.mjs` at the root. Formatting is Prettier; `.prettierignore`
excludes markdown (README.md is the spec of record) and `.opencode/` (vendored).
The gate runs them cheapest-first: lint, format, typecheck, tests.

## Ground rules

- **Never commit without explicit confirmation, every time.** Before running
  `git commit`, show:
  1. every file in the commit, grouped as added / modified / deleted;
  2. the exact commit message, in full.

  Then wait for the user to say yes. The permission layer also gates
  `git commit` and `git push` with `ask` (`.opencode/opencode.json`); choose
  **once**, not **always**, to keep the confirmation per-commit. A previous
  approval is not approval for the next commit, and never commit files the user
  did not ask to include.
- **Never edit `README.md` unless asked.** It is the spec of record for this project.
- **Never put a secret in `VITE_*`.** Vite inlines those into the public bundle.
  Only `VITE_API_BASE` is expected; it is empty in dev because the browser calls
  same-origin `/api` through the Vite proxy.
- **`.env` is gitignored.** `.env.example` is committed. Never commit real credentials.
- **`packages/types` is a public contract.** Changing a type there changes both
  the API responses and the web client's runtime validation. Treat it as a
  breaking change and say so before doing it.
- Colocate tests next to the file they cover (`foo.ts` / `foo.test.ts`). Integration
  tests carry an `.integration.test.ts` suffix because they need a live Postgres.
- Prefer small pure functions in `apps/api/src/lib/`. Existing modules there are
  unit-tested and dependency-free; keep new ones that way.

## Where the rest lives

- **Per-package rules:** `apps/api/AGENTS.md`, `apps/web/AGENTS.md`,
  `packages/types/AGENTS.md`. Read the one for the code you are touching.
- **Agents, skills, commands:** `.opencode/`. These are auto-discovered and their
  descriptions say when to use them, so they are deliberately not listed here.
  Vendored agents carry a **"Xillow scope override"** section at the top that
  outranks their upstream prompt — those upstream prompts assume RSC, microservices,
  and a missing-auth local API, none of which apply.
- **Provenance and every local adaptation:** `.opencode/SOURCES.md`.

CI (`.github/workflows/ci.yml`) is the only hard gate. Everything in this file
and in `.opencode/` is advisory steering — it cannot block a bad change the way
a failing test can.
