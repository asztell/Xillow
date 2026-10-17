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

- **Docker with Compose** — all that's needed for the Docker quickstart below.
- **Node.js 20+** — for running the apps locally (Option 2).

## Setup

### Option 1 — Everything in Docker (recommended)

One command builds and runs the database, API, and UI together — nothing else is
needed on the host except Docker (no `npm install`, no `.env`):

```bash
docker compose up --build          # or the alias: npm run docker:up
```

Then open **http://localhost:8080**.

| Service | URL / port               | Notes                                        |
| ------- | ------------------------ | -------------------------------------------- |
| `web`   | http://localhost:8080    | nginx serving the built UI                   |
| `api`   | http://localhost:3001    | Express API (health: `/api/health`)          |
| `db`    | localhost:5433           | PostgreSQL 18                                |

Host ports are overridable via `API_HOST_PORT`, `WEB_HOST_PORT`, and
`DB_HOST_PORT` (see `.env.example`). The API's host port is **3001**, not 3000,
so this stack and the manual `npm run dev` server can run **at the same time**:

| | Manual (`npm run dev`) | Docker (`npm run docker:up`) |
| --- | --- | --- |
| API | 3000 | 3001 |
| UI | 5173 | 8080 |
| DB | 5433 | 5433 (shared) |

Both modes point at the same Postgres on 5433, so they see identical data; the
Docker `seed` job re-runs on each `up` but is idempotent. Rows are upserted on the
composite `(id, source)` key, so re-running never duplicates them; the loader also
warns if the *input batch* repeats a key (an accidental copy, or a conflicting
repeat where the later entry wins), instead of overwriting in silence.

Compose starts in dependency order: `db` (healthy) → `seed` (one-shot; applies
the schema and loads the sample data, then exits) → `api` (healthy) → `web`. The
UI calls same-origin `/api/*`, which nginx reverse-proxies to the `api` service
(container port 3000), so there is no CORS setup in production either.

```bash
npm run docker:down    # stop the stack
npm run docker:reset   # stop and delete the DB volume (fresh seed next run)
npm run docker:logs    # follow logs
```

Images are built from multi-stage `Dockerfile`s (`apps/api`, `apps/web`) with a
root `.dockerignore`; the API runtime image runs as the non-root `node` user.

### Option 2 — Run the apps locally (development)

```bash
npm install                 # installs all workspaces from the root
cp .env.example .env        # adjust if needed

docker compose up -d db     # starts just Postgres 18 on host port 5433
npm run seed                # creates the table and loads sample_listings.json
npm run dev                 # API on http://localhost:3000 + UI on http://localhost:5173
```

Then open **http://localhost:5173**. The UI calls the API through a Vite dev
proxy (`/api/*` → `http://localhost:3000`), so there is no CORS configuration to
manage in development.

The database listens on **host port 5433** (not the default 5432) so it won't
clash with an existing local Postgres. Change the mapping in `compose.yml` and
`DATABASE_URL` in `.env` if you prefer another port.

### Scripts

Run from the repo root (they fan out to the workspaces):

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start the API and UI together (watch mode)         |
| `npm run dev:api`   | Start only the API (`tsx` watch)                    |
| `npm run dev:web`   | Start only the UI (Vite)                            |
| `npm run seed`      | Create the schema and (re)seed from the JSON        |
| `npm run seed:photos` | Regenerate curated property photos in the JSON    |
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
| `sort`         | string  | One of `recommended`, `price_desc`, `price_asc`, `newest`, `bedrooms_desc`, `bathrooms_desc`, `sqft_desc` (default `recommended`) |
| `page`         | integer | `>= 1` (default `1`)                               |
| `pageSize`     | integer | `1..100` (default `10`)                            |

Any parameter may be omitted. Empty values are treated as omitted.

`total` counts the deduplicated rows returned (one per property), not raw source
rows — see "Duplicate listings" below.

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

Listings whose source feed includes photos carry a `photos` array of image
URLs (see `sample_listings.json`). The sample photos are free Unsplash CDN
images **matched to each property's size**: a 3-bedroom listing gets family
home exteriors, a studio gets small apartment shots, etc. The first photo is
the exterior (or a bedroom interior for ~30% of the listings); the rest are
interiors. About 20% of listings intentionally have no photos. The pool and
assignment live in `apps/api/scripts/seed-photos.mjs` (`npm run seed:photos`
regenerates the JSON, deterministically, from each listing's composite key).
When `photos` is absent or empty the UI shows the
branded placeholder image (falling back to a generated, offline-safe
illustration if that image can't be fetched), so the card layout stays stable.

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

# One listing and every feed row for the same property
curl "http://localhost:3000/api/listings/MLS_C/C8"
```

### `GET /api/listings/:source/:id`

Fetches one listing plus its provenance, for the UI's detail overlay. `id` and
`source` form the composite primary key, so the pair identifies exactly one row
(`MLS_A` and `MLS_B` can both contain an `A1`).

The response is the requested row — whatever its age, so deep-linking an older
sibling still resolves — with a `sources` array holding every feed row that
describes the same property, newest first. The newest row carries
`isCurrent: true`, which is the one the search results show. A listing with no
duplicates returns a single-entry `sources`.

**Response `200`**

```json
{
  "id": "B7",
  "source": "MLS_B",
  "address": "123 Main Street",
  "city": "Springfield",
  "state": "VA",
  "zip": "22150",
  "price": 452000,
  "bedrooms": 2,
  "bathrooms": 1.5,
  "sqft": 980,
  "latitude": 38.7893,
  "longitude": -77.1873,
  "listedDate": "2026-08-27T00:00:00.000Z",
  "status": "active",
  "description": "Bright top-floor condo near shops and transit.",
  "photos": ["https://images.unsplash.com/photo-…"],
  "sources": [
    { "id": "C8", "source": "MLS_C", "address": "123 Main Street", "city": "Springfield",
      "state": "VA", "zip": "22150", "price": 448000, "listedDate": "2026-09-08T00:00:00.000Z",
      "status": "active", "isCurrent": true },
    { "id": "A1", "source": "MLS_A", "…": "…", "price": 450000, "isCurrent": false },
    { "id": "B7", "source": "MLS_B", "…": "…", "price": 452000, "isCurrent": false }
  ]
}
```

**Error `404`** — `{"error":{"code":"NOT_FOUND","message":"Listing not found."}}`
when the `(source, id)` pair does not exist; **`500`** on a database failure.

## Web app

`apps/web` is the React 19 UI. It renders a search form, the ranked results for
the current page as property cards with a sort dropdown, and pagination —
calling `GET /api/listings` for real data.

### Behaviour

- **Filters:** `minPrice`, `maxPrice`, `minBedrooms`, `city`, `keyword`,
  `targetBudget`, and `pageSize`. They live behind a collapsible **"Filters"**
  toggle (`aria-expanded`/`aria-controls`) that badges the number of active
  facets. The panel defaults to open on desktop and collapsed under 640px, and an
  explicit toggle is remembered in `localStorage` (so the viewport default keeps
  adapting until the user chooses). The toggle carries a funnel glyph on the
  left, the label, an active-facet count badge, and a chevron on the right. The
  **Apply Filters** / **Reset all filters** actions share that top row, aligned
  right, and stay visible whether the panel is open or closed. Apply validates and
  resets to page 1; Reset clears every facet and applies immediately (keeping the
  chosen "results per page"). Both are disabled only when there is nothing to
  apply or clear (no facet filled in *and* none in the URL), and stay enabled
  while the URL has filters so they can be cleared. (The feature is a *search* —
  the endpoint, results, and URL are named that way — whose inputs are
  *filters*.)
- **Ranked results:** results render as property cards (address, price,
  beds/baths/sqft, provenance) in a responsive grid. Each card leads with a
  full-width **landscape photo strip** (above the price), followed by the
  price/provenance row and a single-line address (street fused with
  "city, ST ZIP"); the strip has prev/next controls and a position counter
  when a listing has several photos. Listings without photos (or with a photo
  that fails to load) fall back to the branded placeholder image and, if even
  that can't be fetched, a generated offline-safe illustration - so the layout
  never breaks.
  Duplicate rows are collapsed server-side, so each property appears once. A
  **sort dropdown** at the
  top of the results follows the portals' convention: **Recommended** (the API's
  relevance ranking) by default, plus **Price: High to Low**, **Price: Low to
  High**, **Newest**, **Bedrooms**, **Bathrooms**, and **Square Feet**. Attribute
  sorts are high-to-low with missing values always last. The choice lives in the
  URL (`?sort=price_asc`), survives reloads/back-forward, is preserved when
  filters change, and resets to page 1. Sorting happens server-side (before
  pagination), so every page reflects the same global order.
- **Detail overlay:** clicking a card's address opens the listing in a modal
  over the grid (the results stay mounted behind it) via `GET
  /api/listings/:source/:id`. It leads with a **Zillow-style photo mosaic** —
  a hero with a 2×2 tile grid and a "See all N photos" button — that opens a
  **full-screen lightbox** with prev/next, a position counter, and
  ←/→ arrow keys; Esc closes the topmost layer only, so the lightbox stacks
  cleanly over the overlay. Below the photos sit the price, address, stats and
  description, then a **Sources** panel listing every feed row for the
  property (newest first, the current one tagged). A listing with no duplicates
  shows a single "Listed on …" note. The overlay is deep-linkable
  (`?listingSource=…&listingId=…`), survives reload, and Back closes it; deep
  link into an older sibling and it stays resolved while pointing at the newer
  listing the grid shows.
- **States:** loading, no-results, and error are all rendered distinctly. A
  `400` shows the API's message (and offending field); a `500`/network failure
  shows a retry button.
- **Validation:** the form mirrors the API's rules client-side for instant
  feedback (e.g. `minPrice ≤ maxPrice`, `pageSize` 1–100) while the API remains
  the source of truth.
- **Theme:** a light/dark toggle sits at the right of the header. It flips
  `data-theme` on `<html>`, which swaps the CSS custom properties in
  `index.css`; the choice persists to `localStorage` and otherwise follows the
  OS preference. An inline script in `index.html` applies the theme before first
  paint so there is no flash of the wrong palette.

### State, URL, and data flow

Routing is handled by **React Router 8**. The **applied search lives in the URL
query string**, so results are shareable and browser back/forward work; reads and
writes both go through `useSearchParams` in a small `useListingQuery` hook, with
`parseListingsQuery` reading it defensively so a hand-edited URL degrades to
defaults instead of crashing. The form holds a *draft* and only promotes it to
the URL on submit.

The route table lives in `apps/web/src/routes.tsx` — one route today. The
listing detail deliberately is **not** a route: it is an overlay selected by
`listingSource`/`listingId` in the query string, which keeps the grid mounted
behind it and preserves scroll and search state, while still being shareable
and back-button friendly.

Server state is managed with **TanStack Query**. The cache key is the search
params — not the whole URL — so opening or closing the detail overlay never
refetches the grid, and `keepPreviousData` keeps the current page visible while
the next one loads (no flicker on pagination). The overlay's own data is
fetched by `useListingDetail` under its `(source, id)` key.

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

## Duplicate listings

The same property is routinely carried by more than one MLS feed — in
`sample_listings.json` ten of the rows are cross-source duplicates in four
groups (`A1`/`B7`/`C8`, `A2`/`B8`, `A3`/`B9`/`C9`, `A5`/`B11`), where `C8`
and `C9` are **MLS_C siblings added to two of the original pairs**, so
**34 rows describe 28 distinct homes**. The three-row groups exercise the
primary-selection tiebreak: `C8` (2026-09-08) is newest in its group and
becomes primary over `A1`/`B7`, while `A3` stays primary over `B9`/`C9`.

Search results **return the newest row of each group** so the UI shows one card
per property rather than one per feed. The representative is chosen **before any
filter is applied**, so a property is always shown (or hidden) as its most recent
listing:

- `total` counts the deduplicated properties actually displayed — `28` for the
  unfiltered sample, not the raw `34`;
- a filter applies to that representative: a price range that excludes the newest
  sibling **hides the property entirely** rather than surfacing an older, cheaper
  one. E.g. for the `A1`/`B7`/`C8` group (450k / 452k / **448k, newest**) a
  `448000–452000` filter shows `C8`, while `450000–452000` shows nothing;
- no duplicate bookkeeping crosses the search API boundary: the response carries
  no `duplicateGroupId` / `potentialDuplicates` / `isPrimary` fields, and the
  grid renders no duplicate hint. Siblings surface **only on the detail
  overlay's Sources panel** (`GET /api/listings/:source/:id`), which lists every
  feed row for the property newest-first.

### How duplicates are found

The grouping key is computed in `apps/api/src/lib/dedupe.ts` (`duplicateKey`):

1. **Geocode (primary).** Rows at the same location are the same place.
   Coordinates are quantized to ~11 m so trivial geocoder jitter still matches;
   in the sample the duplicates share coordinates exactly.
2. **Normalized address (fallback).** When coordinates are missing we compare a
   normalized form: lowercase, punctuation stripped, street types canonicalized
   (`st`→`street`, `ave`→`avenue`, `ct`→`court`) and the unit lifted out
   (`apt`/`unit`/`#`). The `zip` is ignored — feeds disagree on it (`A2`/`B8`
   differ: 22150 vs 22151).
3. **Unit guard.** The unit is part of the key, so two condos in one building
   (`Apt 4B` vs `Apt 5C`) are **not** merged even though they share a geocode.

`A4`/`B10` share a city and zip but differ on both address and coordinates, so
they are correctly left separate — the false positive a "same city/zip" rule
would produce.

### Which row represents the property?

Within a group the **newest `listedDate`** wins (ties broken by `id`, then
`source`). This matches the app's recency-first ranking and assumes the most
recently listed price is the most current.

The choice is made in SQL, in `KyselyListingRepository.find`, as a correlated
`NOT EXISTS` over the whole table (not over the filtered set), so the picked row
is stable no matter which filters are active; rows with a `NULL` `dup_key` are
unique and always pass. That is an assumption, not a fact, and the data shows why
it matters:

| Group    | Newer (primary) | Older sibling | Primary price | Sibling price |
| -------- | --------------- | ------------- | ------------- | ------------- |
| A1 / B7  | A1 (08‑29)      | B7 (08‑27)    | 450,000       | 452,000       |
| A2 / B8  | A2 (09‑02)      | B8 (08‑30)    | 525,000       | 527,500       |
| A3 / B9  | A3 (09‑01)      | B9 (08‑25)    | 399,000       | 399,500       |
| A5 / B11 | A5 (09‑04)      | B11 (08‑15)   | **470,000**   | **465,000**   |

In three of the four groups the newer row is also the cheaper one, but **A5/B11
goes the other way** — the newest listing is $5k *more* expensive. `listedDate`
is the original list date, not a price-change timestamp, so an older, cheaper row
may well reflect a recent price reduction. Because the older row is not the
representative, its price is simply not returned — a filter around `465,000`
hides this property rather than showing the older, cheaper sibling. A real
`modifiedAt`/`priceUpdatedAt` from the feeds
would make "most accurate price" exact; the received schema has no such column,
so `listedDate` is the documented proxy.

### Trade-offs

- `dup_key` is materialized at ingest (computed once by `duplicateKey()` and
  stored on the row) and refreshed on every upsert, so the representative is
  chosen in the database, before filtering, without recomputing keys per query.
  A standalone `npm run backfill:dup-key` command backfills existing rows and can
  be run in `--audit-only` mode to surface missing or stale keys without writing.
- Grouping uses a quantized geocode key (O(n)); a Haversine ≤ 50 m union-find is
  the scale-grade version that avoids grid-boundary edge effects.

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
- **Duplicates are resolved to the newest sibling, in SQL, before filtering.**
  `total` counts distinct properties, so the grid never shows the same home twice
  (the feed rows are kept in the database, just not returned as their own
  results). Their price/date/status spread is still visible — on the detail
  overlay's Sources panel, without cluttering the grid. The filter trade-off
  stands: a filter that excludes the newest sibling hides the property entirely.
  See "Duplicate listings" above.

## Tests

```bash
npm test
```

**API**

- `apps/api/src/lib/validation.test.ts` — parameter parsing, invalid values,
  pagination boundaries, empty values, repeated params.
- `apps/api/src/lib/scoring.test.ts` — budget/recency math, weight blending,
  tied scores and deterministic ordering.
- `apps/api/src/lib/dedupe.test.ts` — address normalization, the geocode key, the
  unit guard and the address fallback.
- `apps/api/src/routes/listings.test.ts` — the HTTP layer against an in-memory
  repository that mirrors the SQL primary rule: filtering, pagination
  boundaries, empty results, "newest row per group, filters apply to that row",
  `400`s and the `500` path. Also covers the detail route: the row plus its
  siblings newest-first, an older sibling resolving to the same group, a single
  source for an unduplicated listing, and the `404`/`500`s.
- `apps/api/src/lib/seeding.test.ts` — the ingest helpers: date normalization and
  duplicate-key detection (identical vs. conflicting repeats, report ordering).
- `apps/api/src/seed.integration.test.ts` — seeds a throwaway Postgres database
  twice and asserts the row count is stable and no `(id, source)` key is
  duplicated (and that a conflicting repeat resolves to the last value). It
  self-skips when no database is reachable, so `npm test` still passes without
  Docker running.
- `apps/api/src/repositories/listingRepository.integration.test.ts` — pins the
  primary-selection SQL against Postgres: the unfiltered result keeps one row per
  group, a price range matching only an older sibling hides the property, and
  `findDetail` returns the row with every sibling ordered newest-first (plus
  `isCurrent` on the newest) or `null` for an unknown key.
  Also self-skips without a database.

**UI**

- `apps/web/src/lib/query.test.ts` — URL parsing/serialization and defensive
  handling of bad values; `filtersKey` ignores pagination; the detail selection
  (`listingSource`/`listingId`) is read, kept out of the API params, and ignored
  when deciding whether the form should reset.
- `apps/web/src/lib/form.test.ts` — form validation edges (`minPrice > maxPrice`,
  negative/non-numeric values, `pageSize` bounds) and form/query conversion.
- `apps/web/src/api/client.test.ts` — URL building and error mapping for `400`
  (with `field`), `500`, and transport failures; the detail URL is built from the
  `(source, id)` pair (escaped), never sends the detail selection as a search
  param, and maps a `404`/malformed body.
- `apps/web/src/App.test.tsx` — the rendered app against MSW: ranked result
  cards (address/price/bedrooms/locality), one card per result with no duplicate
  hint, the photo carousel (prev/next, wrap,
  placeholder + dead-image fallback), the sort dropdown (URL + page reset
  + re-ordering), the
  theme toggle, the collapsible filter panel (toggle +
  active-filter badge), the Apply/Reset actions (including resetting every
  facet), loading, no-results, error + retry, pagination boundaries, filter
  submission, and client-side validation.
- `apps/web/src/ListingDetail.test.tsx` — the detail overlay: opening it from a
  card (grid stays mounted behind), deep-linking it, closing via the close
  control and Escape, the not-found state, the provenance panel (multi-feed and
  single-source), pointing an older sibling at the newer listing and switching
  to it, and the photo mosaic + full-screen lightbox (counter, prev/next,
  arrow keys, closing only the topmost layer, the no-photos placeholder).

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
    routes/listings.ts         GET /api/listings (+ /:source/:id detail)
    repositories/listingRepository.ts   ListingRepository interface + Kysely impl (newest row per group; findDetail for provenance)
    lib/validation.ts          query parsing/validation (pure)
    lib/scoring.ts             relevance scoring (pure)
    lib/dedupe.ts              cross-source duplicate keys (pure)
    lib/search.ts              repository (dedupe+filter) -> rank -> sort -> paginate
    lib/sorting.ts             sort comparators + whitelist (pure)
    lib/seeding.ts             ingest helpers (idempotent upsert + duplicate audit)
  schema.sql                   table DDL (composite PK, timestamptz, photos)
  sample_listings.json         seed data (34 listings incl. photo URLs)
  scripts/seed-photos.mjs      regenerates curated per-type photos in the JSON
apps/web/
  src/
    main.tsx                   app bootstrap + router + QueryClientProvider
    routes.tsx                 route table (single view; detail is an overlay, not a route)
    App.tsx                    wires URL state, data fetching, results, and the detail overlay
    api/client.ts              fetch wrapper + detail fetch + structured error mapping
    hooks/useListingQuery.ts   applied search <-> URL via React Router
    hooks/useListings.ts       TanStack Query server state for the grid
    hooks/useListingDetail.ts  TanStack Query server state for one listing + sources
    lib/query.ts               ListingsQuery (+ detail selection) parse/serialize
    lib/form.ts                form values, validation, conversion
    lib/format.ts              price/date/address formatting
    lib/photoPlaceholder.ts    branded placeholder URL + generated offline fallback
    components/                SearchForm, ListingCards, ListingDetailModal, Modal,
                               SourcesPanel, PhotoGallery, PhotoLightbox, ListingPhoto,
                               PhotoCarousel, SortSelect, Results, Pagination, ThemeToggle
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
| UI inputs + ranked results (address, price, bedrooms, key stats) | `apps/web/src/components/` |
| Property detail overlay (photo mosaic + lightbox + cross-source provenance) | `apps/web/src/components/ListingDetailModal.tsx`, `GET /api/listings/:source/:id` |
| Sort dropdown (Recommended/price/sqft/…) in the URL and via the API | `apps/web/src/components/SortSelect.tsx`, `apps/api/src/lib/sorting.ts` |
| Loading / no-results / error states | `apps/web/src/components/Results.tsx` |
| Deliberate invalid-input handling | `apps/api/src/lib/validation.ts` (400s), surfaced in the UI |
| Test suite incl. edge cases | `apps/api/src/**/*.test.ts`, `apps/web/src/**/*.test.ts` |
| Scoring explanation + trade-offs | "Relevance scoring" and "Trade-offs" above |
