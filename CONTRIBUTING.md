# Contributing

## Setup

Node >= 20 and npm. Postgres is optional for the unit suite; the integration
tests skip without it, and CI runs them against a real database.

```bash
npm install            # also installs the git hooks via core.hooksPath
cp .env.example .env   # then set DATABASE_URL
npm run seed           # optional: sample listings for the UI
npm run dev            # api + web
```

## The gate

Every change must pass:

```bash
npm run gate
```

It runs, cheapest first: ESLint (type-aware), `prettier --check`, `tsc` across
all workspaces, then the full vitest suite. It prints one `✓` line on success
and the real output on failure.

To reproduce CI exactly, run it with a database and the skip guard on:

```bash
GATE_REQUIRE_DB=1 npm run gate
```

The api integration tests (`*.integration.test.ts`) skip themselves when
`DATABASE_URL` is unset or unreachable. `GATE_REQUIRE_DB=1` turns a silent skip
into a failure, which is what CI does. Do not run `tsc` per package;
`npm run typecheck` fans out correctly.

## Pushing

`main` is protected. It accepts only pull requests whose
`lint + format + typecheck + tests` check is green and up to date with `main`;
direct pushes, force-pushes and deletions are rejected, administrators included.
Work on a branch and open a PR.

`npm install` points `core.hooksPath` at `.githooks/`, which runs the gate before
a push that would update `main`. That is a local convenience and cannot cover a
merge made in the web UI — branch protection is the real gate. A workflow,
`main guard`, opens an issue if `main` ever goes red anyway.

**Never use `git push --no-verify`.** It defeats the hook, and OpenCode denies
it for agents. If the hook fails, the push should fail.

## Commits

Conventional Commits, one logical change per commit: `feat(web): …`,
`fix(api): …`, `chore(lint): …`. Explain the why in the body when the diff does
not. Never commit a real `.env` or credentials.

## Documentation

`README.md` is the specification of record. Propose changes to it explicitly
rather than as a side effect of another change. The `AGENTS.md` files describe
the rules for automated agents; they apply to humans too.
