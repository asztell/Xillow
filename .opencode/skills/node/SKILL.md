---
name: node
description: Node.js backend patterns for Xillow's Express API — async flow, error handling, graceful shutdown, logging, environment/secrets, performance, streams, and process diagnostics. Use when working on apps/api runtime code, server lifecycle, connection pools, or a hung Node process. Do not use for TypeScript type stripping or node:test setup — this repo runs Node >= 20 with tsx, tsc, and vitest.
metadata:
  tags: node, nodejs, backend, async, error-handling, graceful-shutdown, vitest
---

# Node.js in Xillow

`apps/api` is Node >= 20, CommonJS: `tsx` in dev, `tsc` for builds, vitest for
tests. The upstream skill targets Node 22.6+ type stripping and `node:test`;
those sections do not apply here. Always-on invariants live in
`apps/api/AGENTS.md`; this file routes to the detail.

Use this for runtime code and process lifecycle. For type-level work use
`typescript-magician`; for SQL use `postgres-kysely`.

## Hard rules

- **No type stripping.** Do not add `--experimental-strip-types`, `.ts` import
  extensions, `import type` refactors for stripping, or `ts-node`.
- **Tests are vitest.** Translate `node:test` commands and advice; do not add
  the built-in runner.
- **No new runtime dependency without asking.** `lru-cache`,
  `async-cache-dedupe`, and `opossum` are suggested upstream but not installed.
- **Lifecycle is in scope.** Signal handling, pool teardown, in-flight request
  draining, and unhandled rejections are part of backend changes.
- **Secrets stay out of logs.** Never print `.env`, a connection string, or a
  token.

## Rule index

Read only the rule that matches the task. Do not load the whole folder.

| Task | Rule |
|---|---|
| Async flow, concurrency, promise boundaries | `rules/async-patterns.md` |
| Operational vs programmer errors, typed propagation | `rules/error-handling.md` |
| SIGTERM/SIGINT, draining, closing pools | `rules/graceful-shutdown.md` |
| Structured logging, redaction, log levels | `rules/logging.md` |
| Env loading, config validation, secrets | `rules/environment.md` |
| Event-loop blocking, hot paths, batching | `rules/performance.md` |
| Backpressure, `pipeline()`, async iterators | `rules/streams.md` |
| CPU profiles, flame graphs, benchmarks | `rules/profiling.md` |
| Bounded caches and request deduplication | `rules/caching.md` |
| CommonJS/ESM boundaries, package exports | `rules/modules.md` |
| Inspecting installed packages and types | `rules/node-modules-exploration.md` |
| Vitest test structure (translate upstream) | `rules/testing.md` |
| Flaky tests, shared state, teardown order | `rules/flaky-tests.md` |
| Hung process or open handle | `rules/stuck-processes-and-tests.md` |
