# Xillow — Listing Search

A monorepo for a small listing-search product over property listings ingested
from multiple MLS feeds. It filters, ranks by relevance, and paginates results.

- **`apps/api`** — Express + TypeScript REST API backed by PostgreSQL (Kysely).
- **`apps/web`** — React 19 + TypeScript UI (Vite) that calls the API.
- **`packages/types`** — shared domain/API-contract types used by both apps.

## Stack

- **Monorepo:** npm workspaces (`apps/*`, `packages/*`)
- **API:** Node.js + TypeScript, Express 5
- **Database:** PostgreSQL 18 (Docker Compose)
- **Query layer:** `pg` driver + Kysely (type-safe query builder)
- **UI:** React 19, React Router 8, Vite 8, TanStack Query 5 (server state)
- **Types:** `@xillow/types` — one shared source of truth for the API contract
- **Tests:** Vitest + Supertest (API), Vitest + Testing Library + MSW (UI)

## Prerequisites

- Node.js 20+
- Docker (with Compose)

## Setup

```bash
npm install                 # installs all workspaces from the root
cp .env.example .env        # adjust if needed

docker compose up -d        # starts Postgres 18 on host port 5433
npm run seed                # creates the table and loads sample_listings.json
npm run dev                 # API on http://localhost:3000 + UI on http://localhost:5173
```

Then open **http://localhost:5173**. The UI calls the API through a Vite dev
proxy (`/api/*` → `http://localhost:3000`), so there is no CORS configuration to
manage in development.

The database listens on **host port 5433** (not the default 5432) so it won't
clash with an existing local Postgres. Change the mapping in `compose.yml` and
`DATABASE_URL` in `.env` if you prefer another port.

### Run everything in Docker

One command builds and runs the database, API, and UI together — nothing else
needed on the host except Docker:

```bash
npm run docker:up      # docker compose up --build (foreground; logs streamed)
```

Then open **http://localhost:8080**.

| Service | URL / port               | Notes                                        |
| ------- | ------------------------ | -------------------------------------------- |
| `web`   | http://localhost:8080    | nginx serving the built UI                   |
| `api`   | http://localhost:3000    | Express API (health: `/api/health`)          |
| `db`    | localhost:5433           | PostgreSQL 18                                |

Compose starts in dependency order: `db` (healthy) → `seed` (one-shot; applies
the schema and loads the sample data, then exits) → `api` (healthy) → `web`. The
UI calls same-origin `/api/*`, which nginx reverse-proxies to the `api` service,
so there is no CORS setup in production either.

```bash
npm run docker:down    # stop the stack
npm run docker:reset   # stop and delete the DB volume (fresh seed next run)
npm run docker:logs    # follow logs
```

Images are built from multi-stage `Dockerfile`s (`apps/api`, `apps/web`) with a
root `.dockerignore`; the API runtime image runs as the non-root `node` user.

### Scripts

Run from the repo root (they fan out to the workspaces):

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start the API and UI together (watch mode)         |
| `npm run dev:api`   | Start only the API (`tsx` watch)                    |
| `npm run dev:web`   | Start only the UI (Vite)                            |
| `npm run seed`      | Create the schema and (re)seed from the JSON        |
| `npm test`          | Run all workspace test suites                       |
| `npm run typecheck` | Type-check all workspaces                           |
| `npm run build`     | Build all workspaces                                |
| `npm run docker:up` | Build + run db, api, and web in Docker              |
| `npm run docker:down` | Stop the Docker stack                             |
| `npm run docker:reset` | Stop the stack and delete the DB volume          |

The same scripts exist inside `apps/api` and `apps/web`, e.g.
`npm run build -w @xillow/web`.

## API

### `GET /api/listings`

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
curl "http://localhost:3000/api/listings?minPrice=400000&maxPrice=500000"

# Full search, ranked against a target budget, second page of 3
curl "http://localhost:3000/api/listings?city=Springfield&keyword=pets&minBedrooms=2\
&targetBudget=475000&page=2&pageSize=3"
```

## Web app

`apps/web` is the React 19 UI. It renders a search form, the ranked results for
the current page, and pagination — calling `GET /api/listings` for real data.

### Behaviour

- **Filters:** `minPrice`, `maxPrice`, `minBedrooms`, `city`, `keyword`,
  `targetBudget`, and `pageSize`. Submitting a search always resets to page 1.
- **Ranked results:** address, city, price, bedrooms, baths, sqft, and the
  relevance score returned by the API; results are shown in the order the API
  ranked them.
- **States:** loading, no-results, and error are all rendered distinctly. A
  `400` shows the API's message (and offending field); a `500`/network failure
  shows a retry button.
- **Validation:** the form mirrors the API's rules client-side for instant
  feedback (e.g. `minPrice ≤ maxPrice`, `pageSize` 1–100) while the API remains
  the source of truth.

### State, URL, and data flow

Routing is handled by **React Router 8**. The **applied search lives in the URL
query string**, so results are shareable and browser back/forward work; reads and
writes both go through `useSearchParams` in a small `useListingQuery` hook, with
`parseListingsQuery` reading it defensively so a hand-edited URL degrades to
defaults instead of crashing. The form holds a *draft* and only promotes it to
the URL on submit.

The route table lives in `apps/web/src/routes.tsx` — one route today, but it
means a listing detail route (e.g. `/listings/:id`) can be added without
restructuring the app.

Server state is managed with **TanStack Query**: the whole query object is the
cache key, and `keepPreviousData` keeps the current page visible while the next
one loads (no flicker on pagination).

### Talking to the API

In development the browser makes same-origin `/api/*` requests that Vite
proxies to `http://localhost:3000` (see `apps/web/vite.config.ts`), avoiding
CORS. For a production build, set `VITE_API_BASE` to the API's origin; requests
then go to `${VITE_API_BASE}/api/listings`.

## Data model

Columns mirror `sample_listings.json`. `id` is only unique **within** a source
(MLS_A and MLS_B can both contain an `A1`), so the primary key is the composite
**`(id, source)`**. `listedDate` is stored as `TIMESTAMPTZ` (ISO date strings are
loaded as UTC midnight).

Queries are built with **Kysely** (`KyselyListingRepository`), which wraps the
`pg` pool via `PostgresDialect`. The table/column types are declared in
`apps/api/src/db.ts`, and `schema.sql` remains the source of truth for the DDL.
NUMERIC columns (`price`, `bathrooms`) are cast to `float8` in the select so the
API returns numbers rather than pg's default NUMERIC-as-string.

## Relevance scoring

Results are ranked by a weighted blend of two signals (implemented in
`apps/api/src/lib/scoring.ts`):

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
- **The applied search lives in the URL via React Router, not component state.**
  Results are shareable and back/forward work. The parsing/serialization lives
  in a pure, unit-tested module (`apps/web/src/lib/query.ts`); the router is the
  single source of truth for the current search, and its route table makes a
  future detail view a small addition rather than a restructure.
- **Shared types via `packages/types`.** The API contract has one definition
  consumed by both apps, so a field can't drift between server and client. It is
  type-only (no runtime values, no build step) to keep the coupling minimal.
- **Client validation mirrors the API, but doesn't replace it.** The form
  catches obvious mistakes for instant feedback; the API still validates
  everything (defence in depth), and server `400`s are surfaced in the UI.

## Tests

```bash
npm test
```

**API**

- `apps/api/src/lib/validation.test.ts` — parameter parsing, invalid values,
  pagination boundaries, empty values, repeated params.
- `apps/api/src/lib/scoring.test.ts` — budget/recency math, weight blending,
  tied scores and deterministic ordering.
- `apps/api/src/routes/listings.test.ts` — the HTTP layer against an in-memory
  repository: filtering, pagination boundaries, empty results, `400`s and the
  `500` path.

**UI**

- `apps/web/src/lib/query.test.ts` — URL parsing/serialization and defensive
  handling of bad values; `filtersKey` ignores pagination.
- `apps/web/src/lib/form.test.ts` — form validation edges (`minPrice > maxPrice`,
  negative/non-numeric values, `pageSize` bounds) and form/query conversion.
- `apps/web/src/api/client.test.ts` — URL building and error mapping for `400`
  (with `field`), `500`, and transport failures.
- `apps/web/src/App.test.tsx` — the rendered app against MSW: ranked results
  (address/price/bedrooms/score), loading, no-results, error + retry, pagination
  boundaries, filter submission, and client-side validation.

## Project layout

```
apps/api/
  src/
    index.ts                   server bootstrap
    env.ts                     loads the repo-root .env for local dev
    app.ts                     Express app factory (takes a repository)
    db.ts                      Postgres pool + Kysely instance + table types
    seed.ts                    schema + seed from sample_listings.json
    types.ts                   re-exports the shared types from @xillow/types
    routes/listings.ts         GET /api/listings
    repositories/listingRepository.ts   ListingRepository interface + Kysely impl
    lib/validation.ts          query parsing/validation (pure)
    lib/scoring.ts             relevance scoring (pure)
    lib/search.ts              filter -> rank -> paginate orchestration
  schema.sql                   table DDL (composite PK, timestamptz)
  sample_listings.json         seed data
apps/web/
  src/
    main.tsx                   app bootstrap + router + QueryClientProvider
    routes.tsx                 route table (single view today)
    App.tsx                    wires URL state, data fetching, and results
    api/client.ts              fetch wrapper + structured error mapping
    hooks/useListingQuery.ts   applied search <-> URL via React Router
    hooks/useListings.ts       TanStack Query server state
    lib/query.ts               ListingsQuery parse/serialize
    lib/form.ts                form values, validation, conversion
    lib/format.ts              price/score formatting
    components/                SearchForm, Results, ResultsTable, Pagination
  vite.config.ts               React plugin + /api dev proxy + Vitest config
packages/types/
  src/index.ts                 shared domain + API contract types
compose.yml                    Postgres 18 service
```

## Deliverables checklist

| Deliverable | Where |
| ----------- | ----- |
| Runnable app, wired end to end | `npm run dev` (API + UI); UI calls `GET /api/listings` |
| Filtering, ranking, pagination | `apps/api/src/lib/` + `GET /api/listings` |
| UI inputs + ranked results (address, price, bedrooms, score) | `apps/web/src/components/` |
| Loading / no-results / error states | `apps/web/src/components/Results.tsx` |
| Deliberate invalid-input handling | `apps/api/src/lib/validation.ts` (400s), surfaced in the UI |
| Test suite incl. edge cases | `apps/api/src/**/*.test.ts`, `apps/web/src/**/*.test.ts` |
| Scoring explanation + trade-offs | "Relevance scoring" and "Trade-offs" above |
