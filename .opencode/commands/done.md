---
description: Close the author → verify → review loop — gate, review, fix, re-gate, max 2 rounds
---

# /done — close the loop

You own this loop. Drive it to a stop condition; do not hand a round back to the
developer mid-cycle. The only reason to stop early is one of the escalations
below.

## 1. Gate first — deterministic before advisory

Run `npm run gate`. If `DATABASE_URL` is set, also export `GATE_REQUIRE_DB=1`
so skipped integration tests fail instead of passing quietly.

Never spend a review round on a tree that does not typecheck or test green. If
it is red: fix the cause, re-run, and only then continue.

State which claim you are making, as `/qa` does:

| Claim | Meaning |
|---|---|
| gate green, database present | lint, format, types, tests, and integration paths really ran |
| gate green, no database | unit/route coverage only; **integration unverified** |
| failing | paste the real assertion |

## 2. Review — route, do not fan out

**Always** delegate to `code-reviewer`.

**Add `security-reviewer`** only if the diff touches:

- `apps/api/src/lib/search.ts`, `sorting.ts`, `validation.ts`, `db.ts`
- `apps/api/src/repositories/`, `apps/api/scripts/`
- `apps/web/src/api/client.ts`, `src/lib/storage.ts`
- any `dangerouslySetInnerHTML`, env/secret handling, or a new route

**Add `web-reviewer`** if the diff touches `apps/web/src/components/`,
`src/hooks/`, `src/index.css`, or `src/routes.tsx`. It covers what jsdom cannot:
overlay focus, keyboard paths, query-key discipline, effect cleanup, and
layout/CSS regressions. Do not ask it to re-check logic `code-reviewer` already
owns.

**There is no architecture reviewer.** If the diff adds a dependency, changes
`apps/api/schema.sql`, or changes `packages/types`, stop and ask the human
before proceeding. `code-reviewer` checks the blast radius; the decision is not
an agent's.

Give each reviewer: the diff (`git diff HEAD`), the contract path if one exists
(`.opencode/contracts/<slug>.md`), and — in round 2 — the findings file from
round 1.

## 3. Persist findings — round 2 is a diff, not an opinion

Subagents are stateless. Write every review result to
`.opencode/findings/<slug>.md` (create the directory) before acting on it:

```
| # | file:line | severity | blocking | finding | fix |
|---|---|---|---|---|---|
```

`severity` is bug / likely bug / missing coverage / nit. `blocking` is the only
column that gates the loop; mark a finding blocking only if it is a correctness,
security, or contract defect — not a preference.

If round 2 re-litigates a finding that was not in round 1's file, stop and say
so rather than expanding scope.

## 4. Fix, then re-gate

Fix every `blocking` finding. Take `nit`s only when they are one-liners.

After the last fix, run `npm run gate` again. A finding is not fixed until the
gate is green *after* the change.

## 5. Stop conditions

Stop and report when **any** of these is true:

- **Done** — gate green and no blocking findings. Summarise the change and the
  findings that were fixed, and name anything left as a `nit`.
- **Round 2 ends with blocking findings open** — escalate. Hand over the
  findings file and say what you tried and why it did not land.
- **Gate still red after one fix attempt** — escalate. Do not keep guessing at
  the failure.
- **A reviewer disagrees with the gate** — escalate. The gate wins; that
  disagreement usually means a test is wrong, and a human should decide.

Hard cap: **two review rounds.** Do not start a third. Do not review the review.

## Definition of done

Check these mechanically, do not merely assert them:

- [ ] `npm run gate` green, and you said whether the integration tests ran
- [ ] every `blocking` finding has a fix and a green gate after it
- [ ] new behaviour has a test that fails without it
- [ ] no new dependency without explicit approval
- [ ] if a contract exists, the implementation still matches it — or the
      contract was amended deliberately
