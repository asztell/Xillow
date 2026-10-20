---
description: Review the working diff for correctness
agent: code-reviewer
---

Review the current working diff for correctness: logic errors, unhandled
branches, missed call sites, boundary conditions, and test gaps.

The changed files are:

!`git status --short && git diff HEAD --stat`

Pull the full diff yourself with `git diff HEAD` (and read the full files for
context before judging a hunk — the diff alone rarely shows why a branch
exists).

Report findings ordered by severity with file and line references. Do not edit
anything; report only. If the diff is clean, say so in one line, and state what
you did not review.
