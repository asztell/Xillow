# Vendored AI assets — sources and adaptations

Everything under `.opencode/` was imported from third-party MIT-licensed
repositories. This file records provenance and every local change, so upgrades
can be re-applied deliberately instead of by guesswork.

**Do not hand-edit the `rules/` directories.** They are upstream content.
Local guidance belongs in the "Xillow scope override" section at the top of each
agent file, or in an `AGENTS.md`.

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
| `.opencode/agents/react-expert.md` | `agents/expert-react-frontend-engineer.agent.md` |
| `.opencode/agents/api-architect.md` | `agents/api-architect.agent.md` |
| `.opencode/agents/security-reviewer.md` | `agents/se-security-reviewer.agent.md` |
| `.opencode/agents/architecture-reviewer.md` | `agents/se-system-architecture-reviewer.agent.md` |

These are Copilot **agent** definitions, not skills, so they became OpenCode
agents rather than skills.

`.opencode/agents/code-reviewer.md` and `.opencode/agents/qa.md` are **not**
vendored — see "Locally authored" below.

### Mechanical conversions applied

- **Frontmatter replaced.** Upstream uses `description`, `name`, `tools`, `model`.
  OpenCode uses `description`, `mode`, `model` (as `provider/model`), `permissions`.
- **`tools` dropped.** Upstream lists Copilot tool IDs (`codebase`, `search`,
  `problems`, `edit/editFiles`, `runCommands`, `githubRepo`, `usages`,
  `vscodeAPI`, `microsoft.docs.mcp`, …). None exist in OpenCode, and OpenCode
  agent definitions have no `tools` field.
- **`model: GPT-5` dropped** from the two `se-*` agents. It is not a valid
  `provider/model` value. They now inherit the session model.
- **`name` dropped** from frontmatter. OpenCode derives the agent ID from the
  path, so upstream names like `SE: Security` and `Expert React Frontend Engineer`
  would have been misleading. IDs are now `react-expert`, `api-architect`,
  `security-reviewer`, `architecture-reviewer`.
- **`mode` set deliberately** — `subagent` for the three reviewers and for `qa`,
  `all` for `react-expert` and `api-architect`. `api-architect` was originally
  `primary`; it moved to `all` so it can be both a design session and a
  delegated consultant. Its prompt gained a matching subagent entry path.

### Behavioural changes

- **All reviewers are read-only.** `edit` is denied, so the upstream
  instruction to write reports to `docs/code-review/` and
  `docs/architecture/` was changed to return the report inline in the response.
  Both vendored reviewers additionally deny shell except four non-mutating git
  verbs — `git diff`, `git status`, `git log`, `git show` — so they can read the
  change under review without being able to mutate anything. A bare `git *`
  wildcard was deliberately avoided: it would also grant `push` and `commit`.
  `architecture-reviewer` previously inherited unrestricted shell while being
  documented as read-only; that inconsistency is fixed. It loses the upstream
  "consult the web" shell path as a result, which is acceptable for a reviewer
  of local code.
- **`security-reviewer` gained read access to the diff.** It previously denied
  shell outright, so it could not run `git diff` and a caller had to paste the
  diff into the prompt. The scoped git verbs above replace that blanket deny.
  Shell is still not fully open, because an agent that reads untrusted repo
  content with shell is a prompt-injection target.
- **`Code Interpreter` instruction removed** from `api-architect`. That tool does
  not exist in OpenCode; the agent uses its normal file tools.

### Substantive adaptations

A **"Xillow scope override — READ FIRST"** section was prepended to each agent.
It takes precedence over the upstream prompt. Summary:

- **`react-expert`** — upstream assumes React Server Components and Next.js.
  `apps/web` is a Vite SPA, so RSC, Server Actions, `'use client'`, and
  `cacheSignal` are explicitly ruled out, while the React 19 client-side features
  are kept. Pinned the house stack (react-query over a new store, vitest +
  msw + `renderApp` over Jest, runtime response validation in `api/client.ts`).
- **`security-reviewer`** — upstream examples are Python/Flask. Added the real
  attack surface: Kysely query construction, `lib/validation.ts`, photo
  path handling, and `VITE_*` secrets. Listed missing auth/CORS/rate-limiting as
  known-by-design so the agent stops reporting them every run.
- **`architecture-reviewer`** — told to skip the AI/Well-Architected and OWASP LLM
  sections (there is no AI component), not to propose splitting the two-service
  monorepo or adding Redis/queues/Kubernetes, and pointed at the genuinely
  sensitive areas (`scoring.ts`, `dedupe.ts`, search/sort query cost, shared
  contracts).
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

---

## Skills — from `mcollina/skills`

Source directory: [`mcollina/skills/skills`](https://github.com/mcollina/skills/tree/main/skills)

| Local path | Upstream path |
|---|---|
| `.opencode/skills/node/` | `skills/node/` |
| `.opencode/skills/typescript-magician/` | `skills/typescript-magician/` |

Both are already in OpenCode's directory-based skill format (`SKILL.md` beside
`rules/`), so they were copied **verbatim** — `SKILL.md`, `tile.json`, and all
`rules/*.md` files, plus the `node` skill's `rules/assets/` examples.

No adaptation was needed for the skill format itself:

- The upstream `name`/`description`/`metadata.tags` frontmatter is already valid.
  OpenCode tolerates `metadata.tags` and ignores it; discovery uses `description`.
- The `rules/*.md` links are relative to `SKILL.md`, which resolves against the
  skill's base directory as intended.

### Where the overrides live instead

Both skills ship guidance that is wrong for this repo, so the corrections are
**not** in the vendored files. They are in `apps/api/AGENTS.md`:

- **`node`** — upstream leads with TypeScript type stripping (Node 22.6+). This
  repo is Node >= 20 using `tsx` and `tsc`. Upstream also targets `node:test`;
  this repo uses vitest. Upstream suggests `lru-cache` / `async-cache-dedupe`,
  which are not installed here.
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
| `.opencode/agents/qa.md` | Runs the gate, reports facts incl. skipped integration tests |
| `.opencode/commands/review.md` | `/review` — diff summary + delegates to `code-reviewer` |
| `.opencode/commands/qa.md` | `/qa` — delegates to `qa` |
| `scripts/gate.sh` | Backpressure wrapper; shared by `npm run gate`, `qa`, and CI |
| `.github/workflows/ci.yml` | The only hard gate |

Design notes:

- **The reviewers all share one scoped shell block** — deny everything, then
  allow `git diff|status|log|show`. Uniform on purpose: the three review agents
  differ in what they look *for*, not in what they are *allowed to touch*.
- **`qa` is a pure verifier.** `edit` is denied outright. A verifier that can
  edit is tempted to make a failing test pass; the main agent owns test
  authorship.
- **`qa` must report skipped tests.** `apps/api` integration tests self-skip via
  `ctx.skip()` without `DATABASE_URL`, so "green" can mean "never ran". The
  agent is required to say which claim it is making, and CI sets
  `GATE_REQUIRE_DB=1` so the gate fails instead of skipping silently.

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

After upgrading, re-check that upstream has not started covering RSC-free SPAs,
Node 20, or vitest — if it has, the corresponding override here can be dropped.