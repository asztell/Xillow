---
name: postgres-kysely
description: House patterns for Xillow's Postgres and Kysely data layer — query construction, schema changes, NUMERIC casting, dup_key/dedupe semantics, upserts, and scratch-database integration tests. Use when writing or reviewing SQL, repository methods, schema.sql changes, seed scripts, or database-backed tests in apps/api.
metadata:
  tags: postgres, kysely, sql, schema, integration-testing
---

# Postgres + Kysely in Xillow

Load this when the task touches `apps/api/schema.sql`, `src/db.ts`,
`src/repositories/`, `src/lib/seeding.ts`, `src/backfill-dup-key.ts`, or an
`.integration.test.ts` file. The always-on rules stay in
`apps/api/AGENTS.md`; this adds the patterns those rules imply.

## When to use

- Adding or changing a repository query.
- Changing `schema.sql` or a column's type.
- Writing an upsert, seed, backfill, or integration test.
- Reviewing SQL for injection, correctness, or query cost.

## Shape of the data layer

- `schema.sql` is the **source of truth**. There is no migration runner and no
  migration table. `CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE ... ADD COLUMN
  IF NOT EXISTS` is how an existing database is brought forward. Do not
  introduce Kysely migrations or a migration framework for a one-off change.
- `createPool(connectionString?)` and `createDb(pool)` are **factories**, not
  singletons. Scripts and tests build their own pool; a module-level pool makes
  tests share connections and leak.
- `apps/api/src/lib/` stays pure. Query fragments that build SQL belong in
  `lib/search.ts` / `lib/sorting.ts`; methods that execute belong in
  `repositories/listingRepository.ts`.
- The repository interface is the service boundary. Route tests use an
  in-memory fake, so a change to SQL semantics needs an integration test — a
  green route test does not prove the query works.

## Query construction

Kysely parameterizes the query builder. The risk is bypassing it:

- Prefer `.where("price", ">=", value)`, `.where("city", "ilike", pattern)`.
- Use a `sql` tagged template for fragments; Kysely binds its interpolations.
- `sql.raw(...)` does **not** bind. Only use it with a compile-time constant.
- Never pass a constructed string to `executeQuery`.
- Sort columns and directions come from an allowlist in `lib/sorting.ts`, never
  straight from the request.
- Escape `%`, `_`, and `\` before a user value goes into `ilike` — see
  `escapeLike` in `listingRepository.ts`. Without it, `%` is a wildcard and a
  filter can force a scan.
- Keep new filters sargable. `price` and the
  `(dup_key, listed_date DESC, id, source)` index support the existing paths.
  `city` has a btree index, but the current `ilike '%…%'` cannot use it — treat
  that as a known scale limit, not something to "fix" incidentally. A function
  wrapped around an indexed column usually does not use the index either.

## Types that lie at runtime

`pg` returns `NUMERIC` as a **string**. `ListingsTable` declares `price` and
`bathrooms` as `number` only because every select casts them:

```ts
sql<number>`price::float8`.as("price")
sql<number | null>`bathrooms::float8`.as("bathrooms")
```

Any new query path that returns these columns must apply the same cast, or the
TypeScript type is wrong and comparisons become lexical (`"450000" > "99999"`).
`listed_date` is a `TIMESTAMPTZ` and arrives as a `Date`; convert with
`toISOString()` at the repository boundary.

`photos` is a Postgres `TEXT[]` and arrives as `string[]`. Missing photos are
`[]`, never `null` — `schema.sql` sets the default.

## Dedupe semantics — do not re-derive these

`dup_key` is materialized at ingest by `duplicateKey()` in `lib/dedupe.ts`.
Rows without one are unique and are expected to stay visible.

`KyselyListingRepository.find` returns **one row per property**, chosen over the
whole table **before** any filter is applied:

- newest `listed_date` wins;
- ties break on lowest `id`, then lowest `source`;
- the correlated `NOT EXISTS` in `PRIMARY_OF_GROUP` is deliberate — it keeps
  filters as ordinary `WHERE` clauses and avoids `DISTINCT ON`'s NULL grouping.

Consequences to preserve:

- A price filter applies to the representative's price. If the newest sibling
  is out of range, the property is hidden; do not "fall back" to an older,
  cheaper sibling.
- `total` counts deduplicated properties, and pagination/ranking happen in
  application code (`lib/search.ts`), not SQL.
- `findDetail` returns the requested row plus every sibling, ordered newest
  first with deterministic `id`/`source` tie-breaks. Index 0 is the row the grid
  shows; it is marked `isCurrent`.
- A sibling that is not the representative still resolves to the full group.

If you change the representative rule, change `PRIMARY_OF_GROUP`, the sibling
ordering in `findDetail`, the in-memory fake, and the integration expectations
together. Changing only one produces green tests and wrong results.

## Writes

`upsertListings(db, listings)` in `lib/seeding.ts` is the write path:

- computes `dup_key` from the incoming record;
- collapses repeated `(id, source)` keys first, keeping the last value;
- upserts in one transaction with chunks of 500 rows.

Collapsing first is required: a single multi-row `INSERT ... ON CONFLICT DO
UPDATE` cannot touch the same conflict target twice. Do not bypass this helper
with ad-hoc inserts — `source` and `dup_key` are invariants, not optional
fields.

For a batch that intentionally repeats a key, `findDuplicateKeys` reports
conflicts. Use it in scripts when silence would hide data loss.

## Scratch-database integration tests

Both existing integration tests follow the same shape. Copy it rather than
inventing a fixture:

1. Read `schema.sql` once at module scope.
2. In `beforeAll`, set `available` only if `DATABASE_URL` is set and a
   `pg.Client` connects within ~2s.
3. In the test, call `ctx.skip()` and return when unavailable. This is what
   keeps `npm test` green without Docker.
4. Create a uniquely named database (PID + timestamp), connect a `Pool` to it,
   and `await pool.query(schemaSql)`.
5. Build `const db = createDb(pool)`; exercise the repository or upsert.
6. In `finally`, `await db.destroy()`, then open a fresh `Client` to the base
   database and `DROP DATABASE IF EXISTS "..." WITH (FORCE)`.

Notes:

- `CREATE DATABASE` is not allowed inside a transaction, and needs a role with
  `CREATEDB`/superuser. That is why CI uses a superuser Postgres service.
- `WITH (FORCE)` is required if a connection is still open; without it the drop
  fails and leaves scratch databases behind.
- Never point an integration test at the development database. The unique name
  plus drop is the isolation.
- Run with `DATABASE_URL` set and `GATE_REQUIRE_DB=1 npm run gate` to make a
  skipped integration test fail instead of passing quietly.

## Verify

```bash
npm run typecheck -w @xillow/api
npm run test -w @xillow/api
GATE_REQUIRE_DB=1 npm run gate   # with DATABASE_URL sourced
```

If a query's shape changed, also run it once against a seeded database and
check the plan (`EXPLAIN (ANALYZE, BUFFERS)`) for a sequential scan on
`listings` where an index was expected.
