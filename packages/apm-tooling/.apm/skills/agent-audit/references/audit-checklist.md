## Agent Audit Checklist

Checks and severities only. The rules live in `docs/concepts/agent-frontmatter.md` at the repo root; read that first and check each item against it. Items marked *(derived)* follow from the rules but are not stated there verbatim.

Severity: 🔴 critical (invalid, fails a test or a host load) · 🟡 important (reduces reliability or context economy) · 🟢 suggestion.

### Justification

- [ ] The agent needs a model per role, a host-enforced tool set, an output contract or a primary-agent entry point; otherwise it should be a skill — 🟡

### Top level

- [ ] `name` present, kebab-case, matches the file stem (`<name>.agent.md`) — 🔴
- [ ] `description` present — 🔴; one sentence on what it returns, one on when a caller should use it, ≤ 200 characters — 🟡
- [ ] `model`, `mode`, `permission`, `color`, `steps`, `agents` as top-level keys — 🔴; recommendation: move to `metadata.claude` or `metadata.opencode`
- [ ] No keys beyond `name`, `description`, `tools`, `user-invocable`, `disable-model-invocation`, `metadata` — 🟡 for any other key
- [ ] `tools` is a YAML list of Copilot aliases (`read`, `search`, `edit`, `execute`, `agent`) — 🔴
- [ ] A subagent the user never starts directly has `user-invocable: false` — 🟡
- [ ] A primary agent is protected on every host: `disable-model-invocation: true` (Copilot), `metadata.opencode.mode: primary` (OpenCode), a never-dispatch-as-subagent rule in the body (Claude Code) — 🔴

### `metadata.claude` and `metadata.opencode`

- [ ] `metadata` present with both `claude:` and `opencode:` blocks — 🔴
- [ ] `metadata.claude.tools` uses Claude tool names; `metadata.claude.model` is `haiku`, `sonnet`, `opus` or `inherit` — 🔴
- [ ] `metadata.opencode.mode` is `subagent` or `primary` — 🔴
- [ ] `metadata.opencode.model` is an id from the "Allowed model ids" table (`src/generators/agent-model-validator.ts`), omitted for `inherit` — 🔴
- [ ] YAML comments in `metadata.opencode.permission` sit on their own line, never after a key — 🟡
- [ ] Tool sets agree across platforms: top-level `tools`, `metadata.claude.tools` and `metadata.opencode.permission` grant the same capabilities — 🟢 *(derived)*

### Body

- [ ] ≤ 40 lines — 🔴 (fails `src/generators/agent-size-validator.test.ts`)
- [ ] Return contract stated explicitly (word or line limit, JSON shape) — 🟡
- [ ] Delegates by agent or skill name; no copied skill body — 🟡
- [ ] Client mechanisms named where they differ (Claude `Agent`, OpenCode and Copilot CLI `task`, VS Code `runSubagent`), with the inline fallback — 🟢
- [ ] Not designed around a subagent that starts subagents or is resumed later — 🟡

### Enforcement

- [ ] Listed in `packages/agents/apm.yml` `agents:` (`node scripts/check-manifests.mjs`) — 🔴
- [ ] Copy in `apmw/tests/fixtures/agents/` updated when the agent changed — 🟢
