# External Marketplace Sources in plugin.config.yml

> **Status:** Planned — not yet implemented.

## Problem & Approach

Currently `plugin.config.yml` only supports sources from the **local `templates/`** directory.
All `source` and `extend` fields in skills, agents, and instructions are resolved to
`path.join(templatesDir, ...)` at generation time — there is no way to reference files from
another GitHub repository or marketplace.

The solution is to extend the **generator** (`src/generators/plugin-generator.ts`) so that
it recognises a `github://` prefix and fetches the file from GitHub's raw content API at
generation time (`npm run generate`). The generated plugin remains fully self-contained — all
content is embedded locally, no network access is needed at install or runtime.

---

## Proposed Syntax

```yaml
# Local (existing behaviour, unchanged)
skills:
  - name: my-skill
    source: prompts/my-skill.prompt.md
    extend:
      - agents/code-review-cli.agent.md

instructions:
  - source: csharp

# ──────────────────────────────────────────────────────────────────────────────
# External (new) — github://owner/repo:path/to/file[@ref]
# ──────────────────────────────────────────────────────────────────────────────

skills:
  # Use a prompt from another hub as the primary source
  - name: my-skill
    source: github://other-org/other-hub:templates/prompts/some-skill.prompt.md

  # Extend a local skill with an agent from another repo, pinned to a tag
  - name: csharp-code-review
    extend:
      - agents/code-review-cli.agent.md                                       # local
      - github://other-org/other-hub:templates/agents/some-agent.agent.md@v2.0.0  # remote

instructions:
  # Pull an instruction file directly from another marketplace
  - source: github://other-org/other-hub:templates/instructions/csharp.instructions.md
```

**Format:** `github://owner/repo:path/to/file.md` with an optional `@ref` suffix on the path
for a specific branch, tag, or commit SHA.

Fetches from: `https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}`
(ref defaults to `HEAD` when omitted)

---

## Supported Locations

| Field                  | Local | External (`github://`) |
| :--------------------- | :---: | :--------------------: |
| `skills[].source`      |  ✅   |          ✅            |
| `skills[].extend[]`    |  ✅   |          ✅            |
| `instructions[].source`|  ✅   |          ✅            |
| `agents[].source`      |  ✅   |          ❌ (see note) |

> **Note on agents:** Agents are copied as-is from local templates. External agent support is
> excluded from this plan because the agent file can simply be vendored into `templates/agents/`.
> It can be added later if needed.

---

## Implementation Todos

### 1. External source interface & resolver (`src/generators/plugin-generator.ts`)

- Add `isExternalSource(s: string): boolean` — returns `true` when `s` starts with `github://`
- Add `parseExternalRef(ref: string): { owner: string; repo: string; path: string; gitRef: string }` — parses `github://owner/repo:path[@ref]`
- Add `fetchExternalContent(ref: string): string` — fetches the raw file content using Node's built-in `https` module from `raw.githubusercontent.com`; throws on non-200

### 2. Integrate into `generatePlugin()` (`src/generators/plugin-generator.ts`)

For each of the following fields, check `isExternalSource()` **before** the local path resolution:

- `skill.source`
- each entry in `skill.extend[]`
- `instruction.source`

Logging conventions (consistent with existing output):
- `✓ External skill: github://...` on success
- `⚠ External source not found (404), skipping: github://...` on HTTP 404

### 3. Update interfaces & JSDoc

Document the `github://` syntax in `PluginSkillConfig`, `PluginInstructionConfig`.

### 4. Unit tests (`src/generators/plugin-generator.test.ts`)

- `isExternalSource()` — true/false cases
- `parseExternalRef()` — with and without `@ref`
- `generatePlugin()` with mocked `https.get`:
  - external skill source → SKILL.md written with fetched content
  - external extend → content appended after `---`
  - external instruction → instruction file written, path in plugin.json
  - HTTP 404 → warns and skips, does not throw

### 5. Update `docs/concepts/plugins.md`

Add an "External Sources" section (after the Field Reference table) referencing this document
and showing the syntax examples above.

---

## Scope Notes

- External content is fetched at **generation time only** (`npm run generate`).
  The resulting plugin is self-contained.
- Only **public** GitHub repos are supported initially.
  Private repo support (via `GITHUB_TOKEN` env var) can be added in a follow-up.
- The `@ref` pin is optional but recommended for stability (avoids unexpected breakage when the
  upstream repo updates its default branch).
