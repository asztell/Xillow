# Xillow API — Listing Search Service

A small REST API that searches property listings ingested from multiple MLS
feeds. It filters, ranks by relevance, and paginates results.

> **Backend only.** The assessment also requires a React UI; that is planned as
> a separate phase and is not included yet.

## Stack

- **Node.js + TypeScript** (Express 5)
- **PostgreSQL 18** via Docker Compose
- **`pg`** driver + **Kysely** as the type-safe query builder
- **Vitest** + **Supertest** for tests

## Prerequisites

- Node.js 20+
- Docker (with Compose)

## Setup

```bash
npm install
cp .env.example .env        # adjust if needed

docker compose up -d        # starts Postgres 18 on host port 5433
npm run seed                # creates the table and loads sample_listings.json
npm run dev                 # http://localhost:3000
```

The database listens on **host port 5433** (not the default 5432) so it won't
clash with an existing local Postgres. Change the mapping in `compose.yml` and
`DATABASE_URL` in `.env` if you prefer another port.

### Scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the API with watch mode (`tsx`)        |
| `npm run seed`      | Create the schema and (re)seed from the JSON |
| `npm test`          | Run the test suite                           |
| `npm run typecheck` | Type-check without emitting                  |
| `npm run build`     | Compile to `dist/`                           |
| `npm start`         | Run the compiled build                       |

## API

### `GET /listings`

| Param          | Type    | Rules                                              |
| -------------- | ------- | -------------------------------------------------- |
| `minPrice`     | number  | `>= 0`                                             |
| `maxPrice`     | number  | `>= 0`, `>= minPrice`                              |
| `minBedrooms`  | integer | `>= 0`                                             |
| `city`         | string  | Case-insensitive **contains** match                |
| `keyword`      | string  | Case-insensitive **contains** match on description |
| `targetBudget` | number  | `>= 0` — used for ranking                          |
| `page`         | integer | `>= 1` (default `1`)                               |
| `pageSize`     | integer | `1..100` (default `10`)                            |

Any parameter may be omitted. Empty values are treated as omitted.

**Response `200`**

```json
{
  "page": 1,
  "pageSize": 10,
  "total": 12,
  "totalPages": 2,
  "hasNext": true,
  "hasPrev": false,
  "results": [
    {
      "id": "A1",
      "source": "MLS_A",
      "address": "123 Main St, Apt 4B",
      "city": "Springfield",
      "state": "VA",
      "zip": "22150",
      "price": 450000,
      "bedrooms": 2,
      "bathrooms": 1.5,
      "sqft": 980,
      "latitude": 38.7893,
      "longitude": -77.1873,
      "listedDate": "2026-08-29T00:00:00.000Z",
      "status": "active",
      "description": "Bright top-floor condo near shops and transit. Pet friendly.",
      "score": 0.87
    }
  ]
}
```

**Error `400`** — invalid input is rejected deliberately with a clear message:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "minPrice must be less than or equal to maxPrice",
    "field": "minPrice"
  }
}
```

**Error `500`** — `{"error":{"code":"INTERNAL_ERROR", ...}}` if the database is
unreachable.

### Examples

```bash
# Price range
curl "http://localhost:3000/listings?minPrice=400000&maxPrice=500000"

# Full search, ranked against a target budget, second page of 3
curl "http://localhost:3000/listings?city=Springfield&keyword=pets&minBedrooms=2\
&targetBudget=475000&page=2&pageSize=3"
```

## Data model

Columns mirror `sample_listings.json`. `id` is only unique **within** a source
(MLS_A and MLS_B can both contain an `A1`), so the primary key is the composite
**`(id, source)`**. `listedDate` is stored as `TIMESTAMPTZ` (ISO date strings are
loaded as UTC midnight).

Queries are built with **Kysely** (`KyselyListingRepository`), which wraps the
`pg` pool via `PostgresDialect`. The table/column types are declared in
`src/db.ts`, and `schema.sql` remains the source of truth for the DDL. NUMERIC
columns (`price`, `bathrooms`) are cast to `float8` in the select so the API
returns numbers rather than pg's default NUMERIC-as-string.

## Relevance scoring

Results are ranked by a weighted blend of two signals (implemented in
`src/lib/scoring.ts`):

1. **Budget proximity** — how close the price is to `targetBudget`:

   ```
   budget = max(0, 1 - |price - targetBudget| / targetBudget)
   ```

   `1.0` exactly on budget, decaying linearly to `0.0` once the price is 100%+
   off (above *or* below).

2. **Recency** — exponential decay by age:

   ```
   recency = exp(-ageInDays / 30)
   ```

   A listing posted today scores ~`1.0`; 30 days old ~`0.37`; older listings
   decay smoothly toward `0`.

```
score = 0.6 * budget + 0.4 * recency      # when targetBudget is provided
score = recency                           # otherwise
```

Weights and the 30-day time constant are configurable in `scoring.ts`.

**Tie-breaking:** ties are broken by `id`, then `source`, giving a **stable,
deterministic order** so that pagination never duplicates or skips rows.

## Trade-offs

- **Ranking in application code, not SQL.** Filtering is pushed down to
  Postgres, but scoring/sorting happens in TypeScript. This keeps the ranking
  rules in one place and directly unit-testable (including tie-breaking), at the
  cost of loading all matching rows into memory. With a large dataset you would
  move the score into the query (an expression + `ORDER BY` with `LIMIT/OFFSET`,
  or a precomputed column) — a documented, deliberate trade-off given the
  dataset size.
- **`city` and `keyword` use case-insensitive "contains".** The brief notes
  cross-source inconsistencies, so substring matching is friendlier than exact
  equality. The downside is fuzzier matching (e.g. `keyword=pets` also matches
  "no pets"); a stemming/full-text index would be the next step.
- **`pageSize` capped at 100** to bound response size.
- **Kysely for the query layer, not the DDL.** Kysely gives compile-time-checked
  queries and inferred result types while keeping `schema.sql` as the readable
  source of truth — so there is no ORM migration tooling to adopt. The trade-off
  is a small amount of raw `sql` for the `::float8` casts.
- **"No matches" is a `200` with an empty `results` array**, not an error — an
  empty result is a valid outcome, whereas malformed input is a `400`.

## Tests

```bash
npm test
```

- `src/lib/validation.test.ts` — parameter parsing, invalid values, pagination
  boundaries, empty values, repeated params.
- `src/lib/scoring.test.ts` — budget/recency math, weight blending, tied scores
  and deterministic ordering.
- `src/routes/listings.test.ts` — the HTTP layer against an in-memory repository:
  filtering, pagination boundaries, empty results, `400`s and the `500` path.

## Project layout

```
src/
  index.ts                     server bootstrap
  app.ts                       Express app factory (takes a repository)
  db.ts                        Postgres pool + Kysely instance + table types
  seed.ts                      schema + seed from sample_listings.json
  types.ts                     shared domain types
  routes/listings.ts           GET /listings
  repositories/listingRepository.ts   ListingRepository interface + Kysely impl
  lib/validation.ts            query parsing/validation (pure)
  lib/scoring.ts               relevance scoring (pure)
  lib/search.ts                filter -> rank -> paginate orchestration
compose.yml                    Postgres 18 service
schema.sql                     table DDL (composite PK, timestamptz)
sample_listings.json           seed data
```
