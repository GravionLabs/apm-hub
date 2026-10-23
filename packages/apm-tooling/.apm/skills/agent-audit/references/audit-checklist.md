## Agent Audit Checklist

Checks and severities only. The rules live in `docs/concepts/agent-frontmatter.md` at the repo root; read that first and check each item against it.

Severity: 🔴 critical (invalid, fails a test or a host load) · 🟡 important (reduces reliability or context economy) · 🟢 suggestion.

### Justification

- [ ] The agent needs a model per role, a host-enforced tool set, an output contract or a primary-agent entry point; otherwise it should be a skill — 🟡

### Top level

- [ ] `name` present and matches the file stem (`<name>.agent.md`) — 🔴
- [ ] `description` present, says what it returns and when to use it, ≤ 200 characters — 🔴 if missing; 🟡 otherwise
- [ ] Only allowed keys: `name`, `description`, `tools`, `user-invocable`, `disable-model-invocation`, `metadata` — 🔴 for any other key
- [ ] `model`, `mode`, `permission`, `color`, `steps`, `agents` as top-level keys — 🔴; recommendation: move to `metadata.claude` or `metadata.opencode`
- [ ] `tools` uses Copilot aliases only (`read`, `search`, `edit`, `execute`, `agent`) — 🔴
- [ ] Subagent has `user-invocable: false` — 🟡
- [ ] Primary agent has `disable-model-invocation: true` and `metadata.opencode.mode: primary` — 🔴

### `metadata.claude` and `metadata.opencode`

- [ ] `metadata` present with both `claude:` and `opencode:` blocks — 🔴
- [ ] `metadata.claude.tools` uses Claude tool names; `metadata.claude.model` is `haiku`, `sonnet`, `opus` or `inherit` — 🔴
- [ ] `metadata.opencode.mode` is `subagent` or `primary`; `metadata.opencode.model` is an id from the "Allowed model ids" table, omitted for `inherit` — 🔴
- [ ] Tool sets agree across platforms (a read-only agent denies `edit`/`bash` on OpenCode, has no `Edit`/`Write`/`Bash` on Claude) — 🟡
- [ ] YAML comments in `permission` sit on their own line — 🟡

### Body

- [ ] ≤ 40 lines — 🔴 (fails `agent-size-validator.test.ts`)
- [ ] Return contract stated (word or line limit, JSON shape) — 🟡
- [ ] Delegates procedures to skills by name; no copied skill body — 🟡
- [ ] Client mechanisms named where they differ, with an inline fallback — 🟢
- [ ] Shell fences are ` ```powershell ` — 🔴
