# Xillow — Architecture Decisions

_Created 2026-10-20. A short decision log, not a tutorial. `README.md` remains the spec of record._

## How it got here

- Started as a single Express endpoint over Postgres.
- Added Kysely for typed SQL, then split into an npm-workspaces monorepo with a React UI.
- Added Docker, duplicate collapse, a detail/provenance view, and integration tests.
- Hardened the backend, then added CI, type-aware linting, and a small agent/skill layer.

## System shape

### 1. npm-workspaces monorepo with three workspaces

- **Chosen:** `apps/api`, `apps/web`, `packages/types`; one lockfile; root scripts fan out with `-w`.
- **Why:** contract changes land atomically; one install/CI path; npm ships with Node.
- **Rejected:** separate repos (version skew, coordination); pnpm/Turborepo/Nx (extra tooling for three packages).

### 2. REST API + SPA, not a full-stack framework

- **Chosen:** Express JSON API; React client rendered in the browser; HTTP is the boundary.
- **Why:** independent build/deploy/test; the UI is client-only; the API stays reusable.
- **Rejected:** Next.js/RSC (server coupling, unused SSR); server-rendered templates (less interactive).

### 3. TypeScript everywhere; Node >= 20; CommonJS API, ESM web

- **Chosen:** shared TypeScript; API runs `tsx` in dev, `tsc` to build, plain Node in production; web is Vite ESM.
- **Why:** no runtime transpiler in production; type checking at build; straightforward Node interop.
- **Rejected:** native type stripping (version mismatch, unnecessary); `ts-node` (extra runtime); mixed module systems within one app.

### 4. Express 5

- **Chosen:** a small router/middleware stack with no framework ceremony.
- **Why:** tiny surface, familiar, sufficient for two read endpoints.
- **Rejected:** Fastify (plugin model, extra concepts); Nest (DI/modules overkill); raw `http` (manual routing/body parsing).

### 5. PostgreSQL 18 + Kysely + `schema.sql`, no ORM or migration tool

- **Chosen:** Postgres for filters/upserts/SQL dedupe; Kysely as a typed query builder; `schema.sql` is the DDL source; `NUMERIC` columns cast to `float8` in selects.
- **Why:** compile-time query checks without hiding SQL; readable DDL; dates stay `TIMESTAMPTZ` (feed ISO dates load as UTC midnight).
- **Rejected:** Prisma/Drizzle (codegen/migration/abstraction); raw `pg` (untyped SQL); an ORM (less SQL control). Trade-off: schema changes are manual.

### 6. Composite primary key `(id, source)`

- **Chosen:** feed IDs are unique only within a source; the pair identifies a row.
- **Why:** exact identity; the detail route uses the pair; upserts are idempotent.
- **Rejected:** `id` alone (MLS_A/MLS_B collisions); a surrogate UUID (extra key with no domain value).

## API and data

### 7. Repository interface + `createApp(repo)` composition root

- **Chosen:** routes depend on `ListingRepository`; the Kysely implementation is injected at startup.
- **Why:** HTTP tests use an in-memory repo; SQL stays isolated; dependency direction is route → lib → repo → db.
- **Rejected:** routes importing the database directly (hard to test); active-record models (domain coupled to DB).

### 8. Pure `lib/` domain modules

- **Chosen:** validation, scoring, dedupe, sorting, and search orchestration are dependency-free pure functions.
- **Why:** unit-testable without a database; rules live in one place; the route stays thin.
- **Rejected:** logic in SQL, routes, or components (harder to test, duplicated). Trade-off: ranking loads matching rows into memory.

### 9. Idempotent seed/upsert; sample JSON, not live feeds

- **Chosen:** apply `schema.sql` and load `sample_listings.json`; upsert on `(id, source)`; warn when the input batch repeats a key.
- **Why:** reproducible demo; the Docker seed can re-run; no credentials or network dependency; conflicting repeats are visible.
- **Rejected:** truncate/reload (destructive); insert-only (duplicates); live MLS clients (credentials/availability, out of scope); a background queue (unneeded for a one-shot seed).

### 10. Materialized `dup_key` with geo/address/unit rules

- **Chosen:** compute at ingest, store on the row, refresh on upsert; a backfill/audit command repairs existing rows.
- **Why:** the SQL representative choice is stable and cheap per query; geocode is quantized to ~11 m, with normalized address fallback and a unit guard.
- **Rejected:** query-time fuzzy matching (cost, instability); city + ZIP (false positives); Haversine union-find (scale-grade, more complex). Trade-off: keys can go stale.

### 11. Newest sibling is the representative, chosen in SQL before filters

- **Chosen:** correlated `NOT EXISTS` over the whole table; newest `listedDate` wins, ties by `id` then `source`; `total` counts deduplicated properties.
- **Why:** one card per home; filtering stays coherent; matches the recency-first product.
- **Rejected:** pick after filtering (would surface older/cheaper siblings); oldest/cheapest (not recency-first); app-side grouping (breaks pagination/total). Trade-off: a filter around an older sibling's price hides the property.

### 12. Relevance = budget proximity + recency

- **Chosen:** `0.6 * budget + 0.4 * recency` when `targetBudget` is set; recency alone otherwise; 30-day exponential decay; constants live in `scoring.ts`.
- **Why:** explainable, cheap, and matches the brief; no training data required.
- **Rejected:** pure recency (ignores budget); pure price distance (ignores freshness); ML ranking (no labels, opaque).

### 13. SQL filtering; TypeScript ranking, sorting, and pagination

- **Chosen:** filters push down to Postgres; scoring/sort/page happen in `lib/search.ts`; ties break by `id` then `source`.
- **Why:** ranking rules stay in one unit-tested place; pages are deterministic; weights are easy to change.
- **Rejected:** SQL scoring/window functions (harder to test; better at large N); database natural order (unstable pages). Trade-off: all matches are loaded into memory.

### 14. Case-insensitive “contains” and capped offset pagination

- **Chosen:** substring match for `city`/`keyword`; `page`/`pageSize` with a maximum of 100.
- **Why:** feeds disagree on spelling; the cap bounds responses; offset pages are simple and shareable.
- **Rejected:** exact equality (misses variants); full-text/stemming (a later step); cursor pagination (more complexity; offset drift is accepted here).

### 15. Validation at the API boundary; structured errors; empty search is `200`

- **Chosen:** `parseSearchParams` validates every query; errors use `{ error: { code, message, field? } }`; bad input is `400`, no matches is `200` with `results: []`. The form mirrors the rules for instant feedback, but the API stays authoritative.
- **Why:** the API is the trust boundary; the UI gets actionable errors; an empty result is a valid outcome.
- **Rejected:** trusting inline casts/`Number()` (unsafe); `404` for no matches (the endpoint exists); generic errors (poor UX); client-only validation (bypassable). SQL stays parameterized through Kysely; sort values are allowlisted.

### 16. Detail endpoint with sibling provenance

- **Chosen:** `GET /api/listings/:source/:id` returns the requested row plus `sources` newest-first, with `isCurrent` on the newest.
- **Why:** deep-linking an older sibling still resolves; provenance appears only in the overlay; the grid stays uncluttered.
- **Rejected:** duplicate hints in the grid (clutter); primary-only detail (hides the feed spread); a separate duplicates endpoint (extra round trip). Search responses deliberately carry no duplicate metadata.

### 17. Type-only shared contract + shallow client validation

- **Chosen:** `@xillow/types` contains interfaces only; the web client parses `unknown` at the boundary with `parseSearchResult`/`parseListingDetail`.
- **Why:** one contract with no build or runtime coupling; breaking responses are caught; additive fields are tolerated.
- **Rejected:** a generated OpenAPI client (tooling for a small API); a runtime schema package (bundle/coupling); full schema validation in the client (brittle); unchecked casts (runtime surprises).

## Web

### 18. React 19 + Vite SPA

- **Chosen:** client-rendered React, Vite dev/build, React Router 8, TanStack Query 5.
- **Why:** the API is separate; there is no SSR/RSC need; fast dev; static deployment behind nginx.
- **Rejected:** Next.js/Remix (server coupling, unused features); CRA (stale); server templates (less interactive).

### 19. URL is the applied-search state; detail is an overlay, not a route

- **Chosen:** applied search lives in the query string via React Router; pure `query.ts` parses/serializes it defensively; the form holds a draft and promotes it on submit; the detail overlay is selected by `listingSource`/`listingId`.
- **Why:** results are shareable and back/forward work; typing does not refetch; the grid stays mounted, preserving scroll and search; the overlay is deep-linkable.
- **Rejected:** component/global state (not shareable); a separate detail route (unmounts the grid); modal-only state (not deep-linkable); writing the URL on every keystroke (request churn).

### 20. TanStack Query for server state; no global store

- **Chosen:** hooks own server state; the key is derived from search params; the detail selection is excluded; `keepPreviousData` and `retry: false`.
- **Why:** cache/loading/error handling without boilerplate; opening the overlay never refetches the grid; pagination does not flicker.
- **Rejected:** Redux/Zustand (mixes server and client state, extra layer); manual `useEffect` fetching (races and cleanup). Components stay presentational.

### 21. Plain CSS + CSS variables; native `<dialog>` for overlays

- **Chosen:** `index.css` with `data-theme` variables; an inline head script applies the saved theme before paint; native `<dialog>` for the modal and lightbox.
- **Why:** small UI, full design control, no runtime CSS; dialog gives the top layer, focus containment, and Esc for stacked overlays.
- **Rejected:** Tailwind/MUI/component library (dependency and design lock-in); CSS-in-JS (build/runtime complexity); a custom portal focus trap (more edge cases).

### 22. External curated photos with deterministic fallback

- **Chosen:** `photos` are URLs in the feed data; assignment is deterministic per property; missing or broken images fall back to a branded placeholder, then an offline-safe generated image.
- **Why:** no binary assets in the repo; card layout stays stable; the demo looks realistic.
- **Rejected:** bundling images (repo size); uploads/object storage (no write path); random photos (non-deterministic tests/UX); no fallback (broken cards).

## Delivery and quality

### 23. Docker Compose full stack with same-origin proxies

- **Chosen:** `db` → one-shot `seed` → `api` → `web`; multi-stage images; non-root API runtime; nginx proxies `/api`; host ports 3001/8080/5433.
- **Why:** one-command reproducible stack; no host install; same-origin avoids CORS; alternate ports let dev and Docker run together.
- **Rejected:** local-only setup (reproducibility); Kubernetes (overkill); CORS middleware (unneeded with the proxy); sharing API port 3000 (cannot run both stacks).

### 24. Vitest everywhere; Supertest, RTL, MSW; self-skipping DB tests

- **Chosen:** API unit + Supertest route tests; web Testing Library + MSW; integration tests create a scratch database, apply `schema.sql`, and self-skip without a DB; CI requires the DB.
- **Why:** one runner, Vite-native; MSW exercises the real client parsing/error path; contributors can run unit tests without Docker; CI catches skipped DB tests.
- **Rejected:** Jest (separate config); mocking `api/client.ts` (misses the boundary); requiring a DB for every test (friction); Playwright/Cypress (scope; no browser E2E is an accepted gap).

### 25. Gate + CI + branch protection

- **Chosen:** `npm run gate` runs type-aware ESLint → Prettier check → typecheck → tests; build is separate; CI runs the same gate; `main` is PR-only with a required check; a pre-push hook guards `main`.
- **Why:** cheap checks first; local/CI parity; deterministic enforcement; feature branches rely on CI.
- **Rejected:** build inside the gate (slow/noise); Husky/lint-staged (extra dependency); advisory-only checks (not enforceable). The public repo makes required checks free.

### 26. TypeScript 6 pinned, not 7

- **Chosen:** stay on TypeScript 6 with type-aware ESLint.
- **Why:** `typescript-eslint` needs the JS compiler API (`createProgram`), which TypeScript 7 no longer ships; on 7 the linter cannot start.
- **Rejected:** TypeScript 7 (breaks the lint stack); dropping type-aware lint (loses real checks). This is a hard tooling constraint, not a preference.

### 27. Advisory agent/skill layer; CI is the only hard gate

- **Chosen:** `AGENTS.md`, agents, skills, and commands steer behavior; CI blocks bad merges; vendored prompts carry repo-specific overrides; skills load on demand.
- **Why:** prompts help but cannot enforce; CI is deterministic; overrides keep upstream material relevant; lazy skills avoid always-on token cost.
- **Rejected:** relying on prompts for correctness; encoding every convention in CI (not possible); unbounded vendored prompts (token cost).

### 28. Config and security posture

- **Chosen:** repo-root `.env` for local API; real environment variables in Docker; only `VITE_API_BASE` is public; no auth, rate limiting, TLS, or CORS in the app.
- **Why:** read-only public search; same-origin proxies; TLS and rate limits belong at the edge; secrets never go in `VITE_*`.
- **Rejected:** app-level auth/users (out of scope); a CORS layer (same-origin); in-app TLS (proxy concern); committing `.env` (secret leak).

## Deliberate omissions / later work

| Omission | Why not now | Trigger to add |
|---|---|---|
| Incremental migrations | `schema.sql` is enough for one table and a demo | Schema changes need history or zero-downtime rollout |
| Cursor pagination | Offset is simple and the dataset is small | Large tables or frequent inserts make offset drift visible |
| Full-text search | `contains` is friendlier across messy feeds | Matching quality or index performance matters |
| Live MLS ingestion | Sample JSON is reproducible and credential-free | Real feeds, auth, rate limits, and scheduling arrive |
| Background jobs/queue | The seed is a one-shot compose service | Continuous ingest or async enrichment |
| Structured logging/metrics/tracing | Console + Docker logs are enough locally | Operated deployment needs SLOs and debugging |
| Browser E2E tests | Component tests cover the interactions | Critical flows need cross-browser confidence |
| Auth / rate limiting / TLS | Edge concerns for a local read-only API | The API is exposed beyond a trusted proxy |
