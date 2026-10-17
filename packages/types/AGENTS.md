# AGENTS.md — packages/types

Shared TypeScript contracts consumed by both `apps/api` and `apps/web`.

Repo-wide rules live in the [root AGENTS.md](../AGENTS.md). Read that first.

## Commands

```bash
npm run typecheck -w @xillow/types
npm run build -w @xillow/types
```

## This package is a public contract

Types defined here shape the API's HTTP responses **and** the web client's
runtime validation. A change here is not local — it moves both sides at once.

Before editing:

- **Say it is a breaking change** and describe the blast radius. Do not quietly
  change an exported type's shape.
- Check every consumer: `apps/api/src/types.ts`, `apps/api/src/routes/`,
  `apps/api/src/repositories/listingRepository.ts`, and
  `apps/web/src/api/client.ts`.
- The web client parses responses into these types at runtime
  (`parseSearchResult`, `parseListingDetail`). If you widen or rename a field
  the UI depends on, the runtime check and the type must stay in sync — the
  types are erased at runtime, so a mismatch surfaces as a crash rather than a
  compile error.

## Conventions

- Keep this package **types only**. No runtime code, no dependencies, no imports
  from `apps/*`. It is consumed by both the Node API and the browser bundle, so
  anything added here must be safe in both.
- No `any`. Use `unknown` at the boundary and narrow it.
- Prefer precise unions and discriminated unions over optional fields; they make
  the API's error shapes (`{ code, message, field }`) expressible.
- Document non-obvious invariants (e.g. `dup_key` semantics) with a short
  comment — this is the one file both sides read to agree on meaning.
- Additive, optional changes are safe. Renames and removals are not; prefer
  adding a new field and deprecating the old one.