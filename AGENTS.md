# AGENTS.md — Xillow

Listing search across multiple MLS feeds: an Express + Postgres API and a React SPA.

Read this before changing anything. `README.md` is the full reference (~27KB) —
consult it for API reference, data model, and trade-off rationale rather than
duplicating it here.

## Layout

npm workspaces: `apps/api`, `apps/web`, `packages/types`. Always run npm scripts
from the repo root.

| Path | What it is | Conventions |
|---|---|---|
| `apps/api` | Express 5 + Kysely + Postgres, CommonJS, Node >= 20 | [`apps/api/AGENTS.md`](apps/api/AGENTS.md) |
| `apps/web` | Vite + React 19 SPA, react-router, react-query | [`apps/web/AGENTS.md`](apps/web/AGENTS.md) |
| `packages/types` | Shared request/response contracts | [`packages/types/AGENTS.md`](packages/types/AGENTS.md) |

## Commands

```bash
npm run typecheck                       # all workspaces
npm test                                # all workspaces
npm run build

npm run dev                             # api + web concurrently
npm run dev:api                         # tsx watch src/index.ts
npm run dev:web                         # vite

npm run seed                            # seed the database
npm run seed:photos                     # seed listing photos

npm run docker:up                       # recommended full stack
npm run docker:reset                    # down -v, destroys the volume
```

TypeScript is `^7.0.2` in every workspace. Run `npm run typecheck` from the
root rather than invoking `tsc` per package.

## Ground rules

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

## Available skills

These are vendored into the repo and load on demand. Load one with the `skill`
tool by ID, or reference it directly as `@<id>`.

- **`node`** — Node.js/TypeScript backend patterns: error handling, graceful
  shutdown, streams, caching, profiling, logging, env config. Rule files under
  `.opencode/skills/node/rules/`.
  **Read the override in `apps/api/AGENTS.md` first** — this project is Node 20
  with `tsx` and vitest, so the skill's type-stripping and `node:test` guidance
  does not apply.
- **`typescript-magician`** — advanced generics, `infer`, conditional and mapped
  types, branded types, type narrowing, and diagnosing `tsc` errors.

## Available agents

Invoke via the `subagent` tool, or select one as your primary agent.

| Agent | Mode | Use for |
|---|---|---|
| `react-expert` | all | Component work in `apps/web` (React 19, hooks, a11y, perf) |
| `api-architect` | primary | Wiring `apps/api` to a new upstream feed; REST client design |
| `security-reviewer` | subagent, read-only | OWASP/Zero Trust review before shipping `apps/api` or `apps/web` |
| `architecture-reviewer` | subagent, read-only | Structural decisions, dependencies, scaling questions |

Each vendored agent carries a **"Xillow scope override"** section at the top of
its file that takes precedence over the upstream prompt. Read it before following
the agent's generic advice — several upstream sections do not apply here (RSC in
a Vite SPA, microservices in a two-service monorepo, missing auth in an
intentionally open local API).

## Upstream sources

Vendored MIT-licensed, see `.opencode/SOURCES.md` for provenance and the list of
adaptations made. Update vendored content by re-fetching upstream rather than
editing the rule files in place.