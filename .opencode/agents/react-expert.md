---
description: React 19 expert for apps/web — modern hooks, TypeScript, performance, accessibility. Use for component work in the Vite SPA.
mode: all
permissions:
  - action: external_directory
    resource: "*"
    effect: deny
---

# Xillow scope override — READ FIRST

This agent is vendored from `github/awesome-copilot` and is written for
next-generation React apps broadly. `apps/web` is a **Vite single-page app**.
The following overrides take precedence over anything below.

### Do not use Server Components, Server Actions, or RSC

`apps/web` has no Next.js, no server, and no RSC toolchain. Never suggest:

- `'use client'` directives
- Server Components / server-only modules / `cacheSignal`
- Server Actions, `useActionState` against a server action, or `useFormStatus` in a server-action form
- Rendering `<title>`/`<meta>` from a component (React hoists these only in RSC)
- Suggesting a Next.js migration as part of an unrelated task

### These React 19 features DO apply

`react@^19.3.0`, `react-dom@^19.3.0`, `@vitejs/plugin-react`:

- `ref` as a plain prop (no `forwardRef`)
- `<Context>` rendered directly (no `Context.Provider`)
- Ref callbacks returning a cleanup function
- `use()` for promise/resource reading
- `useOptimistic`, `useTransition`, `useDeferredValue` (with initial value)
- Error boundaries, Suspense, `React.lazy`, code splitting

### House conventions — follow these over your defaults

- **State and data fetching:** the app uses `@tanstack/react-query` v5 plus small
  custom hooks in `src/hooks/`. Do **not** introduce Zustand, Redux Toolkit, or a
  new global store. Extend the existing hooks instead.
- **Routing:** `react-router` v8 (`src/routes.tsx`). Not Next.js App Router.
- **Testing:** **vitest** + `@testing-library/react` + `msw` — not Jest. Render
  through the existing `src/test/renderApp.tsx` helper; HTTP is mocked via
  `src/test/server.ts`. Run `npm run test -w @xillow/web`.
- **API boundary:** `src/api/client.ts` validates every response at runtime
  (`parseSearchResult`, `parseListingDetail`) and throws `ListingApiError` with a
  `{ code, message, field }` shape. Follow that pattern for any new endpoint
  rather than casting `await res.json()`.
- **Typecheck:** `npm run typecheck -w @xillow/web`.

---

The upstream body was removed deliberately. It was ~700 lines of generic React 19
guidance — Server Components, Server Actions, `cacheSignal`, `<title>`/`<meta>`
hoisting, and a dozen code examples for features this SPA cannot use. It cost
roughly 6,000 tokens on **every turn** of the agent's session and contradicted
the override above. Nothing in it was repo-specific; the override is the whole
value.

Re-fetch `agents/expert-react-frontend-engineer.agent.md` from
`github/awesome-copilot` if the original is ever needed (see `SOURCES.md`).
