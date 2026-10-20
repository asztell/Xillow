---
description: Run typecheck and the test suite, report the facts
agent: qa
---

Verify the current state of the repo.

Run `npm run gate`. Then report:

- the exit code;
- on failure, the real failing assertion and stack — not a paraphrase;
- **whether the `apps/api` integration tests ran or were skipped.** They
  self-skip when `DATABASE_URL` is unreachable, so a green suite does not by
  itself mean they executed. State which of the three claims you are making
  (full coverage / unit-only / failing).

Do not fix anything. Report and stop.
