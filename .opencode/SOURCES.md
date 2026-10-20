# Vendored AI assets — sources and adaptations

Agents and skills under `.opencode/` are a mix of third-party imports and
locally authored files. This file records provenance and every local change, so
upgrades can be re-applied deliberately instead of by guesswork.

**Do not hand-edit the `rules/` directories.** They are upstream content.
Local guidance belongs in the "Xillow scope override" section at the top of each
agent file, in an `AGENTS.md`, or in a locally authored skill.

## Licenses

| Source | License | License file |
|---|---|---|
| `github/awesome-copilot` | MIT (GitHub, Inc.) | Upstream repo root |
| `mcollina/skills` | MIT (Mattia Collina, 2026) | `.opencode/skills/LICENSE-mcollina-skills` |

Both require that the copyright notice and permission notice be retained in
substantial copies of the Software. The upstream projects themselves are not
copied here; the license files and these provenance notes are the attribution.

---

## Agents — from `github/awesome-copilot`

Source directory: [`github/awesome-copilot/agents`](https://github.com/github/awesome-copilot/tree/main/agents)

| Local file | Upstream file |
|---|---|
| `.opencode/agents/api-architect.md` | `agents/api-architect.agent.md` |
| `.opencode/agents/security-reviewer.md` | `agents/se-security-reviewer.agent.md` |

These are Copilot **agent** definitions, not skills, so they became OpenCode
agents rather than skills.

`.opencode/agents/code-reviewer.md`, `.opencode/agents/qa.md`, and
`.opencode/agents/web-reviewer.md` are **not** vendored — see "Locally authored"
below.

**Upstream bodies are not kept verbatim any more.** `api-architect` keeps only
its override section plus the smallest body that is not generic knowledge;
`security-reviewer` keeps only its override and a repo-specific checklist. The
vendored prose was removed. Rationale and the rule used are under "Trimming the
vendored bodies" below.

### Mechanical conversions applied

- **Frontmatter replaced.** Upstream uses `description`, `name`, `tools`, `model`.
  OpenCode uses `description`, `mode`, `model` (as `provider/model`), `permissions`.
- **`tools` dropped.** Upstream lists Copilot tool IDs (`codebase`, `search`,
  `problems`, `edit/editFiles`, `runCommands`, `githubRepo`, `usages`,
  `vscodeAPI`, `microsoft.docs.mcp`, …). None exist in OpenCode, and OpenCode
  agent definitions have no `tools` field.
- **`model: GPT-5` dropped** from `security-reviewer`. It is not a valid
  `provider/model` value. It now inherits the session model.
- **`name` dropped** from frontmatter. OpenCode derives the agent ID from the
  path, so upstream names like `SE: Security` would have been misleading. IDs are
  now `api-architect` and `security-reviewer`.
- **`mode` set deliberately** — `subagent` for the reviewers and for `qa`, `all`
  for `api-architect`. `api-architect` was originally `primary`; it moved to
  `all` so it can be both a design session and a delegated consultant. Its
  prompt gained a matching subagent entry path.

### Behavioural changes

- **All reviewers are read-only.** `edit` is denied, so the upstream
  instructions to write report files to disk were changed to return the report
  inline in the response. Every reviewer (`code-reviewer`, `security-reviewer`,
  `web-reviewer`) also denies shell except four non-mutating git verbs — `git
  diff`, `git status`, `git log`, `git show` — so it can read the change under
  review without being able to mutate anything. A bare `git *` wildcard was
  deliberately avoided: it would also grant `push` and `commit`.
- **`security-reviewer` gained read access to the diff.** It previously denied
  shell outright, so it could not run `git diff` and a caller had to paste the
  diff into the prompt. The scoped git verbs above replace that blanket deny.
  Shell is still not fully open, because an agent that reads untrusted repo
  content with shell is a prompt-injection target.
- **`Code Interpreter` instruction removed** from `api-architect`. That tool does
  not exist in OpenCode; the agent uses its normal file tools.

### Substantive adaptations

A **"Xillow scope override — READ FIRST"** section was prepended to each
vendored agent. It takes precedence over the upstream prompt. Summary:

- **`security-reviewer`** — upstream examples are Python/Flask. Added the real
  attack surface: Kysely query construction, `lib/validation.ts`, photo
  path handling, and `VITE_*` secrets. Listed missing auth/CORS/rate-limiting as
  known-by-design so the agent stops reporting them every run, and dropped the
  OWASP LLM/Zero Trust sections, which have no component to apply to.
- **`api-architect`** — stack is fixed (TypeScript, Node >= 20, `tsx`, global
  `fetch`, Express 5, vitest) rather than being asked each time; told to place
  feed clients in `apps/api/src/lib/` and route writes through the repository;
  told to propose new dependencies rather than assume them; and permitted to skip
  the three-layer split when the upstream is not genuinely flaky.
- **`api-architect` — contract-first lifecycle (structural change).** The
  upstream prompt jumps from a list of API aspects straight to "write working
  code for ALL layers, NO TEMPLATES". That skips the contract and the plan,
  which is where adherence to the specification is actually decided, and it
  maximises the amount of unreviewed generated code in one shot. The override
  now imposes five phases — **contract → plan → review gate → implement →
  validate** — and redefines the upstream word "generate" as the entry to phase
  4 (implement against the *approved* contract). The contract must state the
  per-field policy for missing, renamed, and wrongly-typed upstream fields,
  which is the highest-risk part of an MLS feed integration. Phase 5 requires
  fixture-driven conformance tests asserting the normalized output satisfies
  `packages/types` and the `ListingsTable` interface, including `source`.
  A subagent entry path was added: a subagent cannot answer "say generate", so
  without it a delegated call would stall or invent the contract silently.

### Trimming the vendored bodies

An agent body is a **system prompt sent on every turn of that agent's session**,
so it is paid repeatedly, not once.

`api-architect` keeps only the input checklist from upstream (endpoint, sample
payloads, required methods, resilience justification) because those are real
questions; it dropped the "write ALL layers, NO TEMPLATES" directives, which
directly contradicted the phase 3 review gate.

`security-reviewer` upstream carried a full OWASP walkthrough, an OWASP LLM Top
10 section, Zero Trust, reliability patterns, and Python/Flask examples — while
its own override said there is no auth layer and no LLM component. That body was
removed wholesale. What remains is the repo-specific attack surface (Kysely,
validation, feed paths, secrets, untrusted rendering) and the findings-table
output.

The rule applied: **keep the repo-specific mapping, cut the generic knowledge a
frontier model already has.** A Well-Architected pillar walkthrough and Python
examples do not change behaviour; naming `lib/search.ts`, `VITE_API_BASE`, and
the findings table does.

Re-fetching upstream on upgrade will reintroduce the removed text — re-apply the
trim rather than restoring it wholesale.

---

## Skills — from `mcollina/skills`

Source directory: [`mcollina/skills/skills`](https://github.com/mcollina/skills/tree/main/skills)

| Local path | Upstream path |
|---|---|
| `.opencode/skills/node/` | `skills/node/` |
| `.opencode/skills/typescript-magician/` | `skills/typescript-magician/` |

`typescript-magician` was copied **verbatim** — `SKILL.md`, `tile.json`, and
all `rules/*.md`.

`node` was copied and then **trimmed locally**:

- `SKILL.md` and its description now target Node >= 20 with `tsx`, `tsc`, and
  vitest. The upstream type-stripping primer and its trigger words were
  removed; the body is now a short router to the rule files.
- `tile.json`'s summary matches the new description.
- `rules/typescript.md` was deleted; it was entirely type-stripping guidance
  this repo does not use.
- The remaining `rules/*.md` and `rules/assets/` are verbatim and are loaded on
  demand, not with the skill.

No adaptation was needed for the skill format itself:

- The upstream `name`/`description`/`metadata.tags` frontmatter is already valid.
  OpenCode tolerates `metadata.tags` and ignores it; discovery uses `description`.
- The `rules/*.md` links are relative to `SKILL.md`, which resolves against the
  skill's base directory as intended.

### Where the overrides live instead

`typescript-magician` ships one step that is wrong for this repo, so the
correction is **not** in the vendored file. It is in `apps/api/AGENTS.md`.
`node`'s corrections now live in its trimmed `SKILL.md`, with the always-on
summary in `apps/api/AGENTS.md`:

- **`node`** — Node >= 20 with `tsx`/`tsc`, not Node 22.6+ type stripping;
  vitest, not `node:test`; `lru-cache` / `async-cache-dedupe` / `opossum` are
  not installed.
- **`typescript-magician`** — its step 1 is to run `tsc --noEmit`. Use
  `npm run typecheck` from the repo root, which dispatches to each workspace
  (`apps/api` typechecks via `tsconfig.test.json`).

---

## Locally authored — not vendored

Written for this repo. No upstream, so they must **not** be added to the
provenance table above or re-fetched on upgrade.

| Path | What it is |
|---|---|
| `.opencode/agents/code-reviewer.md` | Correctness review of the working diff |
| `.opencode/agents/web-reviewer.md` | Browser-facing review: focus, overlays, query keys, CSS |
| `.opencode/agents/qa.md` | Runs the gate, reports facts incl. skipped integration tests |
| `.opencode/skills/postgres-kysely/SKILL.md` | Postgres/Kysely patterns, dedupe semantics, integration-test scaffold |
| `.opencode/commands/review.md` | `/review` — diff summary + delegates to `code-reviewer` |
| `.opencode/commands/qa.md` | `/qa` — delegates to `qa` |
| `.opencode/commands/done.md` | `/done` — the author → verify → review loop |
| `scripts/gate.sh` | Backpressure wrapper; shared by `npm run gate`, `qa`, and CI |
| `.github/workflows/ci.yml` | The only hard gate |

Design notes:

- **The reviewers all share one scoped shell block** — deny everything, then
  allow `git diff|status|log|show`. Uniform on purpose: the three review agents
  differ in what they look *for*, not in what they are *allowed to touch*.
- **`web-reviewer` is a review pass, not a React persona.** It replaced the
  vendored `react-expert`, whose entire body duplicated `apps/web/AGENTS.md`.
  The conventions stay in `AGENTS.md` (always loaded); the agent exists only to
  check the layer tests cannot see — focus, overlays, layout, query keys.
- **There is no architecture agent.** Structural decisions are rare and belong
  to the human. `/done` escalates a new dependency, a schema change, or a
  `packages/types` change instead of running a generic Well-Architected pass.
- **`qa` is a pure verifier.** `edit` is denied outright. A verifier that can
  edit is tempted to make a failing test pass; the main agent owns test
  authorship.
- **`qa` must report skipped tests.** `apps/api` integration tests self-skip via
  `ctx.skip()` without `DATABASE_URL`, so "green" can mean "never ran". The
  agent is required to say which claim it is making, and CI sets
  `GATE_REQUIRE_DB=1` so the gate fails instead of skipping silently.
- **`/done` is the loop; `/qa` and `/review` are its parts.** Running the two
  separately leaves the developer as the loop — nothing owns the second pass.
  `/done` orders the work **gate → review → fix → re-gate**, caps it at two
  review rounds, and names the escalations (open blocking findings in round 2,
  a gate still red after one fix attempt, a reviewer disagreeing with the gate).
- **Deterministic before advisory.** `/done` never reviews a tree that is not
  gate-green. Reviewing code that does not compile burns a round on something a
  machine already settled.
- **Findings and contracts are files, not chat.** Subagents are stateless, so a
  round 2 that re-derives its own opinion is not a loop. `/done` writes findings
  to `.opencode/findings/<slug>.md` (gitignored) and `api-architect` writes the
  contract to `.opencode/contracts/<slug>.md` (committed). Reviewers stay
  read-only — the orchestrator writes the file, which keeps `edit` denied where
  it should be.
- **Reviews are routed, not fanned out.** `code-reviewer` always;
  `security-reviewer` only when the diff touches query construction, validation,
  storage, rendering of untrusted text, or env handling; `web-reviewer` only
  when the diff touches components, hooks, CSS, or routes.

These are not MIT-licensed third-party content, so the license section above
does not apply to them.

---

## Upgrading

```bash
# skills: replace the directory wholesale, then diff
curl -fsSL https://codeload.github.com/mcollina/skills/tar.gz/refs/heads/main \
  | tar -xz --strip-components=2 -C .opencode/skills \
  skills-main/skills/node skills-main/skills/typescript-magician

# agents: re-fetch, strip frontmatter, re-prepend the override section
curl -fsSL https://raw.githubusercontent.com/github/awesome-copilot/main/agents/<name>.agent.md
```

After upgrading, re-check that upstream has not started covering Node 20 or
vitest — if it has, the corresponding override here can be dropped. Re-apply the
`node` trim after any re-fetch: shorten `SKILL.md` and its description, delete
`rules/typescript.md`, and update `tile.json`. Never overwrite
`.opencode/skills/postgres-kysely/`; it has no upstream.