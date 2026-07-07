## Skill Audit Checklist

Use this checklist when auditing a skill. Apply all checks and report findings by severity.

### Severity levels

- 🔴 **Critical** — Invalid skill; will fail validation or behave incorrectly
- 🟡 **Important** — Significant quality issue; reduces reliability or activates incorrectly
- 🟢 **Suggestion** — Improvement that increases quality without being strictly necessary

---

### Location check

**Skill placement (🟢 if misplaced):**

- [ ] The skill is located in `packages/<domain>/.apm/skills/<skill-name>/` **or** in `packages/apm-tooling/.apm/skills/<skill-name>/` (meta/tooling skills only — i.e. skills that manage other skills, such as skill-create, skill-audit, skill-update)
- [ ] If placed under `.github/skills/`: confirm the skill's purpose is repo-level tooling, not a domain-specific workflow — 🟢 if it belongs in a domain package instead

---

### Frontmatter checks

**`name` field (🔴 if absent, 🟡 if malformed):**

- [ ] Field is present
- [ ] Matches the parent directory name exactly
- [ ] 1–64 characters
- [ ] Only `a-z`, `0-9`, `-` (no uppercase, no underscores, no spaces)
- [ ] Does not start or end with a hyphen
- [ ] No consecutive hyphens (`--`)

**`description` field (🔴 if absent, 🟡/🟢 for quality):**

- [ ] Field is present
- [ ] 1–1,024 characters
- [ ] Uses `>` folded scalar (YAML multiline) for multi-sentence descriptions — 🟢 if single-quoted and multi-sentence
- [ ] Follows the three-part formula: [What it does] + [When to use it] + [Key capabilities] — 🟡 if any part is missing
- [ ] Uses imperative phrasing ("Use this skill when…"), not "This skill does…" — 🟡 if missing
- [ ] Describes specific scenarios and keywords, not just the domain name — 🟡 if too vague
- [ ] Not so broad it would trigger for unrelated tasks — 🟡 if overly broad
- [ ] Indirect trigger phrasing included where relevant ("even if the user does not mention X") — 🟢

**Forbidden top-level fields (🔴 per `docs/concepts/skill-frontmatter.md`):**

- [ ] No `allowed-tools` — tool policy belongs to the host platform, not the skill
- [ ] No `model` — platform-specific, goes stale
- [ ] No `compatibility` — spec-compliant skills run on all agentskills.io hosts
- [ ] No other non-standard top-level keys — custom annotations (e.g. `chronicle-hints`) belong under `metadata:`

**`license` / `metadata` (🟢):**

- [ ] `license` is a valid SPDX identifier if present
- [ ] `metadata` values are free-form strings; no nested platform configuration
- [ ] 1–500 characters if provided

**`model` (🟢 if omitted, 🟡 if misleading):**

- [ ] Treat `model` as a repo-local convention, not an officially documented GitHub skill field
- [ ] If present, value matches a model listed in `docs/model-overview.md`
- [ ] If present, recommendation fits the task complexity (mechanical vs complex, short vs long instructions) — 🟡 if unjustified
- [ ] If a body-level "Model hint" exists, it is consistent with frontmatter `model` — 🟡 if they conflict
- [ ] Do not require `model`; omission is valid under the official skill docs — 🟢 if absent

---

### Body checks

**Length:**

- [ ] < 500 lines — 🟡 if exceeded; move content to `references/`
- [ ] Token count estimated < 5,000 — 🟡 if likely exceeded

**Content placement:**

- [ ] Reference material (specs, error codes, long tables) is in `references/`, not inline — 🟡
- [ ] Output templates longer than ~20 lines are in `assets/`, not inline — 🟢
- [ ] Complex multi-step commands are in `scripts/`, not copy-pasted — 🟢
- [ ] Shell command code fences use ` ```powershell ` (not ` ```bash ` or ` ```sh `) — PowerShell is the required shell — 🟢

**Structure:**

- [ ] Contains an overview or goal section — 🟢
- [ ] Step-by-step workflow is numbered and prescriptive where fragility demands it — 🟢
- [ ] Gotchas section present for non-obvious environment facts — 🟢
- [ ] Output format is specified (template or description) — 🟢 if applicable
- [ ] Decision Flows used for conditional paths (`"If X → Y; otherwise Z"`) — 🟢 if the skill has conditional behaviour but uses only prose descriptions instead

**Content quality:**

- [ ] No content explaining things the agent already knows (HTTP basics, common tools) — 🟡
- [ ] No generic, vague advice ("handle errors appropriately") — 🟡
- [ ] No equal alternatives listed without a default — 🟡 (provide one default with brief fallback)
- [ ] If a body-level "Model hint" exists, it explains why the suggested model fits the task and avoids vague wording such as "better model" — 🟡

---

### `scripts/` checks (if present)

For each script in `scripts/`:

- [ ] `--help` flag implemented — 🟡 if missing
- [ ] No interactive prompts (blocking reads from stdin without flags) — 🔴 if present
- [ ] Structured output (JSON, CSV, TSV) on stdout — 🟢
- [ ] Diagnostics and progress on stderr, not stdout — 🟢
- [ ] Non-zero exit code on error — 🟡 if missing
- [ ] Helpful error messages (what failed, what was expected, what to try next) — 🟡
- [ ] Dependencies declared inline (PEP 723 for Python, import maps for Deno/Bun) — 🟢
- [ ] Versions pinned for reproducibility — 🟢

---

### `references/` checks (if present)

- [ ] Each reference file has a conditional load instruction in `SKILL.md` ("If X, read references/Y.md") — 🟡
- [ ] No "see references/ for details" without specificity — 🟡
- [ ] File paths in `SKILL.md` are relative from the skill root — 🔴 if absolute
- [ ] No reference chains deeper than one level (A → B → C) — 🟡

---

### `assets/` checks (if present)

- [ ] Assets are referenced from `SKILL.md` with conditional load instructions — 🟡
- [ ] Assets contain templates/data, not prose documentation (use `references/` for prose) — 🟢

---

### Anti-pattern checks

| Anti-pattern                                                | Severity | Detection                                        |
|-------------------------------------------------------------|----------|--------------------------------------------------|
| Generic vague content with no project context               | 🟡       | Applies to any project without changes           |
| Scope is overly broad (activates for unrelated tasks)       | 🟡       | Description mentions many unrelated domains      |
| Scope is overly narrow (multiple skills must load together) | 🟢       | Workflow is incomplete without another skill     |
| Reference chain > 1 level deep                              | 🟡       | File A references file B which references file C |
| Interactive prompts in scripts                              | 🔴       | `input()`, `read -p`, or blocking stdin reads    |
| Listing equal alternatives                                  | 🟡       | "You can use X, Y, or Z…" without choosing one   |
| Instructions tied to one concrete task                      | 🟢       | Hardcoded names, URLs, or identifiers            |

---

### Quick-reference summary

```
[ ] location: in packages/<domain>/.apm/skills/ OR .github/skills/ (meta/tooling only)
[ ] name: present, lowercase kebab-case, 1-64 chars, matches directory, no leading/trailing/consecutive hyphens
[ ] description: present, 1-1024 chars, imperative phrasing, specific trigger keywords
[ ] model: optional; if present, treat as repo-local, align with docs/model-overview.md, and keep consistent with any body-level Model hint
[ ] body: < 500 lines, < 5,000 tokens
[ ] body: only content the agent wouldn't know on its own
[ ] body: shell code fences use ```powershell (not ```bash or ```sh)
[ ] gotchas section present for non-obvious environment facts
[ ] decision flows: "If X → Y; otherwise Z" blocks used where skill has conditional behaviour
[ ] scripts: no interactive prompts, --help, structured stdout, helpful errors
[ ] references: conditional load instructions, relative paths, one level deep
[ ] assets: referenced conditionally, not loaded automatically
[ ] frontmatter: only name/description/license/metadata at top level (no allowed-tools, model, compatibility)
```
