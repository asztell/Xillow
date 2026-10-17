# AGENTS.md — apps/api

Express 5 + Kysely + Postgres. CommonJS, Node >= 20, run with `tsx`.

Repo-wide rules live in the [root AGENTS.md](../AGENTS.md). Read that first.

## Commands

```bash
npm run dev -w @xillow/api        # tsx watch src/index.ts
npm run typecheck -w @xillow/api  # tsc -p tsconfig.test.json
npm run test -w @xillow/api       # vitest run
npm run build -w @xillow/api      # tsc
```

`typecheck` deliberately uses `tsconfig.test.json` so test files are included.

## Structure

```text
src/
├── index.ts            # entrypoint: loads .env, builds pool/db/app, listens
├── app.ts              # createApp(repo) — Express wiring, takes repo by DI
├── db.ts               # Kysely Database types + createPool / createDb factories
├── env.ts              # dotenv, repo-root .env (three levels up from src|dist)
├── types.ts
├── routes/listings.ts  # router factory: createListingsRouter(repo)
├── repositories/       # listingRepository.ts — all SQL lives here
├── lib/                # pure logic: search, scoring, dedupe, sorting, validation
└── seed.ts, backfill-dup-key.ts
scripts/seed-photos.mjs
schema.sql
```

Three rules hold the shape together:

1. **`createApp(repo)` takes the repository as a dependency.** Tests build the
   app with a fake repo. Preserve that signature.
2. **`lib/` is pure and dependency-free.** No pool, no Express, no `Date.now()`
   pulled from outside. It is what makes the unit tests trivial. New query
   fragments belong in `lib/search.ts` / `lib/sorting.ts`; new repository
   *methods* belong in `repositories/listingRepository.ts`.
3. **`createPool` / `createDb` are factories, not singletons.** Scripts and tests
   construct pools with different configuration.

## Database

- Kysely is the query builder; `pg` is the driver via `PostgresDialect`.
- **Never build SQL with string interpolation.** Use the query builder. Avoid
  `sql.raw` with unvalidated input, and never pass a constructed string to
  `executeQuery`.
- `ListingsTable` in `db.ts` declares columns snake_case to match the database.
  `price` and `bathrooms` are typed `number` because the repository casts the
  NUMERIC columns to `float8` on select — `pg` returns NUMERIC as a string.
- `schema.sql` is the source of truth for the schema. If you change a query's
  expectations, check `schema.sql` still matches.
- `photos` is a Postgres array. `dup_key` identifies the same property across
  feeds; see `lib/dedupe.ts` for how canonical rows are chosen.

## SQL injection review points

`lib/search.ts` and `lib/sorting.ts` translate user-supplied query params into
query fragments. When touching them, confirm that:

- values are bound as parameters, not concatenated
- `orderBy`/sort columns are matched against an allowlist, never taken raw
- filter combinations stay index-friendly and cannot produce unbounded scans

## Tests

Vitest + `supertest`. Unit tests live beside their source in `lib/*.test.ts` and
need no database. Tests needing a live Postgres use the `.integration.test.ts`
suffix.

`vitest.config.mts` includes `src/**/*.test.ts`, so those files *do* run as part
of `npm test` — they are not filtered out by name. Each one guards itself with
`ctx.skip()` when `DATABASE_URL` is unset or unreachable, which keeps the suite
green without a database. Do not assume "integration" means "excluded"; if you
add one, give it the same guard.

## `node` skill override

Load the `node` skill for backend patterns, but these upstream sections
**do not apply** to this package:

- **Ignore all type-stripping guidance.** It targets Node 22.6+ running `.ts`
  directly. This is Node >= 20 with `tsx` for dev and `tsc` for builds. Do not
  add `--experimental-strip-types`, `import type` refactors, or `.ts` import
  extensions to enable stripping.
- **Ignore `node:test` guidance.** Tests run on **vitest**. Translate flaky-test
  and stuck-process advice to vitest (`--reporter`, `pool: 'forks'`, teardown
  hooks) rather than introducing the built-in runner.
- **Do not add dependencies without asking.** `lru-cache`, `async-cache-dedupe`,
  and `opossum` are suggested by the skill but are not installed. Propose them,
  then wait.
- Graceful shutdown, structured error handling, logging, env/secrets, profiling,
  and streams guidance all apply as written.

## Environment

- `env.ts` loads the repo-root `.env`; in Docker the config arrives as real
  environment variables and the missing file is harmless.
- `DATABASE_URL` is required. `createPool` throws a clear error if it is unset.
- Never read `.env` contents into logs, responses, or test fixtures.