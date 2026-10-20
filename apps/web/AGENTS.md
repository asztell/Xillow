# AGENTS.md — apps/web

Vite SPA: React 19, react-router v8, `@tanstack/react-query` v5, TypeScript 6.

Repo-wide rules live in the [root AGENTS.md](../AGENTS.md). Read that first.

## Commands

```bash
npm run dev -w @xillow/web        # vite
npm run typecheck -w @xillow/web  # tsc --noEmit
npm run test -w @xillow/web       # vitest run
npm run build -w @xillow/web      # tsc --noEmit && vite build
```

## Structure

Placement rules that are not obvious from listing the directories:

- `src/lib/` is pure: URL↔state conversion (`query.ts`), form dirty-tracking
  (`form.ts`), formatting (`format.ts`), storage (`storage.ts`). Keep it free of
  React and network calls.
- Server state belongs in `src/hooks/`; `src/components/` is presentational.
- `src/test/` holds the `renderApp` helper and the msw server.

## Conventions

### This is a Vite SPA, not a Next.js app

There is no server, no RSC, and no server actions. Do not introduce
`'use client'`, Server Components, `cacheSignal`, or App Router. If a task seems
to require a server, it does not — solve it in the browser.

React 19 features that **do** apply: `ref` as a plain prop (no `forwardRef`),
rendering `<Context>` directly instead of `<Context.Provider>`, ref callbacks
returning a cleanup function, and `use()`.

### Data fetching

- Server state goes through **react-query** and a hook in `src/hooks/`.
- Components in `src/components/` are presentational and receive data as props.
  They do not call `useQuery` directly.
- **Do not add Zustand, Redux Toolkit, or another global store.** Existing hooks
  are the state layer; extend them.
- Follow the existing cache-key discipline. The query key is derived from the
  search params (`["listings", toSearchParams(query).toString()]`), and the
  web-only detail selection is deliberately excluded so opening the modal never
  refetches the grid. Preserve that when adding filters.
- `retry: false` is intentional: errors surface immediately and the UI offers a
  manual retry. `keepPreviousData` prevents pagination flicker.

### API boundary

`api/client.ts` is the only place that talks to the network. It validates every
response at runtime — `parseSearchResult` and `parseListingDetail` check the
discriminants the UI depends on, then throw `ListingApiError`
(`{ code, message, field }`).

- For a new endpoint, add a `parse*` function that validates `unknown` and
  throws `ListingApiError`. Never cast `await res.json()` to a domain type.
- Validation is intentionally shallow — only the discriminants the UI needs.
  Do not tighten it into full schema validation; that would reject additive
  server changes for no benefit.
- URL-encode path segments. Detail is keyed by a `(source, id)` pair and both
  are `encodeURIComponent`-escaped.
- Pass the `AbortSignal` from react-query's `queryFn` through to `fetch`.
- `API_BASE` is empty in dev because the browser calls same-origin `/api` via the
  Vite proxy. `VITE_API_BASE` overrides it.

### Styling

Plain CSS in `src/index.css` — no CSS-in-JS, no utility framework, no component
library. Follow the existing class naming and match the light/dark theme
variables; `ThemeToggle.tsx` sets the theme.

## Testing

**vitest** + `@testing-library/react` + **msw**. Not Jest, not Playwright.

- Render through the `renderApp` helper in `src/test/renderApp.tsx` — it wires a
  fresh `QueryClient` and a memory router around the real route tree. Use
  `initialEntries` to test a specific URL.
- `src/test/setup.ts` registers jest-dom matchers and the msw server from
  `src/test/server.ts`.
- Mock HTTP with msw, not by mocking `api/client.ts`. Component tests should
  exercise the real parsing and error path.
- `userEvent` over `fireEvent`.
- Run the suite before saying a change is done.

## Accessibility

The UI has a lightbox, carousel, gallery, and modal. Keep them keyboard
navigable and correctly labelled. When adding an overlay, preserve focus
handling and `Escape` to close as `Modal.tsx` does.