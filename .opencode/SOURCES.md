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
- **`mode` set deliberately** — `subagent` for the two reviewers, `primary` for
  `api-architect` (it is an interactive mentor that waits for "generate"), `all`
  for `react-expert`.

### Behavioural changes

- **Both reviewers are read-only.** `edit` is denied, so the upstream
  instruction to write reports to `docs/code-review/` and
  `docs/architecture/` was changed to return the report inline in the response.
  `architecture-reviewer` keeps shell access (it may consult the web);
  `security-reviewer` denies both edit and shell.
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