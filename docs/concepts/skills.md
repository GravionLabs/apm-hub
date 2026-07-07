# Skills

This document explains what **Skills** are in the context of **GitHub Copilot**, how they are created from skill templates (`.skill.md`), and how they differ from plain prompt files.

---

## What Is a Skill?

An **Agent Skill** is a folder of instructions, scripts, and resources that Copilot can load to improve its performance in specialized tasks. Skills are part of the open [Agent Skills specification](https://github.com/agentskills/agentskills) and work across different AI systems.

Skills answer the question:

> **"How should Copilot perform this specialized task?"**

### How Copilot Selects Skills

> **Important:** Skills are **automatically selected by Copilot** based on your prompt and the skill's `description` field. You do not need to invoke them manually.

When you ask Copilot something and a skill's description matches your intent, Copilot automatically loads the `SKILL.md` file into its context.

### Keep Skills Concise

Skills are **injected into the agent's context** when selected. This means:
- Long skills increase token usage and cost for every matching request
- Verbose instructions dilute the model's focus
- Skills should describe **what** and **when**, not exhaustive step-by-step procedures

**Recommended:** Keep `SKILL.md` files under 100 lines. For complex workflows, reference external scripts or files in the skill directory rather than inlining all instructions.

You can also **explicitly reference** a skill in your prompt:

```text
Use the /csharp-async skill to improve this code.
```

### Skill Locations

Skills can be stored in two scopes:

| Scope        | Paths                                                                                                       | Availability                     |
| :----------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------- |
| **Project**  | `.github/skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`        | Current repository only          |
| **Personal** | `~/.copilot/skills/<name>/SKILL.md`, `~/.claude/skills/<name>/SKILL.md`, `~/.agents/skills/<name>/SKILL.md` | All repositories on this machine |

> ⚠️ **Skills do NOT use `~/.github/skills/`**
>
> Unlike agents and prompts (which use `~/.github/`), skills follow the [agentskills.io open standard](https://agentskills.io/specification) and use `~/.copilot/skills/` as their personal path. This makes skills portable across GitHub Copilot, Claude, and other compatible AI systems.
>
> `~/.github/skills/` is **not loaded** by any tool — files placed there will be silently ignored.

### Skills vs. Agents & Prompts: Path Comparison

| Type             | Project path             | Personal/global path        | Standard       |
| :--------------- | :----------------------- | :-------------------------- | :------------- |
| **Agents**       | `.github/agents/`        | `~/.github/agents/`         | GitHub Copilot |
| **Prompts**      | `.github/prompts/`       | `~/.github/prompts/`        | GitHub Copilot |
| **Instructions** | `.github/instructions/`  | `~/.github/instructions/`   | GitHub Copilot |
| **Skills**       | `.github/skills/<name>/` | `~/.copilot/skills/<name>/` | agentskills.io |

> See [global-sharing.md](../sync/global-sharing.md) for the full tool-support matrix and cross-machine sync setup.

### Package Skills vs. Native Agent Skills

This repository distributes skills as **APM packages**. Package skills follow the same `SKILL.md` format but are bundled per domain and installed via the APM CLI:

| Aspect           | Native Agent Skill                                 | Package Skill (apm-hub)                             |
| :--------------- | :------------------------------------------------- | :-------------------------------------------------- |
| **Location**     | `.github/skills/` or `~/.copilot/skills/`          | `packages/<domain>/.apm/skills/<name>/SKILL.md`     |
| **Distribution** | Manual copy or sync                                | `apm install <package>@apm-hub`                     |
| **Trigger**      | Automatic (context-based) + explicit `/skill-name` | Automatic (context-based) + explicit `/skill-name`  |
| **Versioning**   | Repository-level                                   | Package version (`apm.yml`)                         |

### Skills in This Repository

Skills are authored directly as `SKILL.md` files under `packages/<domain>/.apm/skills/<name>/`, following the [skill frontmatter convention](skill-frontmatter.md). `apm install` deploys them to each platform's skills directory (`.github/skills/`, `.claude/skills/`, `.opencode/`), so one source file serves GitHub Copilot, Claude Code, and OpenCode.

---

## Skills vs. Prompts

| Aspect              | Prompt (`.prompt.md`)          | Skill (`SKILL.md`)                                   |
| :------------------ | :----------------------------- | :--------------------------------------------------- |
| **Location**        | `.github/prompts/` (per repo)  | `.github/skills/`, `~/.copilot/skills/`, or package  |
| **Scope**           | Single repository              | Project, personal, or any repo with package installed |
| **Distribution**    | Manual copy or sync script     | `apm install` (package) or manual                    |
| **Source of truth** | Template file in `templates/`  | `packages/<domain>/.apm/skills/<name>/SKILL.md`      |
| **Trigger**         | `/prompt-name` (slash command) | Automatic (context-based) or explicit `/skill-name`  |
| **Versioning**      | Repository-level               | Package version (`apm.yml`) or repository-level      |

**Key insight:** skills are the portable, cross-platform artifact; prompts remain repo-local slash commands.

---

## The SKILL.md File

Each skill is stored as a `SKILL.md` file inside a named directory:

```
plugins/
└── csharp-development/
    └── skills/
        ├── csharp-async/
        │   └── SKILL.md
        ├── create-dotnet-solution/
        │   └── SKILL.md
        └── ef-core/
            └── SKILL.md
```

### SKILL.md Structure

A `SKILL.md` file consists of:

1. **YAML front-matter** — `name` and `description` fields consumed by the Copilot CLI
2. **Prompt body** — the full prompt instruction text, identical to the source `.prompt.md`

Example (`plugins/csharp-development/skills/csharp-async/SKILL.md`):

```markdown
---
name: csharp-async
description: 'Get best practices for C# async programming'
---

# C# Async Programming Best Practices

Your goal is to help me follow best practices for asynchronous programming in C#.

...
```

> **Note:** `SKILL.md` files are **auto-generated**. Do not edit them manually — always edit the source template in `templates/<domain>/` and re-run the generator.

### `allowed-tools` — Security Consideration

The `allowed-tools` field pre-approves tools for use **without prompting the user for confirmation**. This is a convenience feature, not a tool restriction.

> ⚠️ **Security warning:** Only include `shell` or `bash` in `allowed-tools` if you fully trust the skill's source. Pre-approving these tools allows arbitrary commands to run without confirmation, which can be exploited by prompt injection attacks.

Tools NOT listed in `allowed-tools` can still be used by Copilot — the user will simply be asked for confirmation before each use.

**Difference from prompt `tools:` field:**

| Field                | Location                 | Semantics                                          |
| :------------------- | :----------------------- | :------------------------------------------------- |
| `tools: [...]`       | `.prompt.md` frontmatter | **Restricts** which tools are available in VS Code |
| `allowed-tools: ...` | `SKILL.md` frontmatter   | **Pre-approves** tools without confirmation prompt |

These are semantically opposite: `tools:` limits availability; `allowed-tools:` grants silent permission.

---

## How Skills Are Generated

Skills are defined in `plugin.config.yml` under the `skills:` key and generated by `npm run generate`.

### Step-by-step

1. **Define the skill** in `plugin.config.yml`:

   ```yaml
   skills:
     - name: csharp-async
       source: csharp/csharp-async
     - name: csharp-code-review
       source: csharp/csharp-code-review
       extend:
         - csharp/csharp-expert        # body appended after a --- separator
   ```

2. **Provide the source template** in `templates/<domain>/`:

   ```
   templates/csharp/csharp-async.skill.md
   ```

   The generator resolves `source: csharp/csharp-async` → `templates/csharp/csharp-async.skill.md` automatically.

3. **Run the generator**:

   ```bash
   npm run generate
   ```

4. **Output** — the generator writes:

   ```
   plugins/csharp-development/skills/csharp-async/SKILL.md
   ```

   The `SKILL.md` contains the front-matter from the source `.skill.md` plus the full skill body.

### The `extend` field

A skill can incorporate additional content from one or more agent files:

```yaml
skills:
  - name: csharp-code-review
    extend:
      - agents/code-review-cli.agent.md
```

The generator appends the body of each listed file to the skill content (separated by `---`), producing a richer, composite prompt.

### Source Resolution

| Config entry                           | Resolved template path                                              |
| :------------------------------------- | :------------------------------------------------------------------ |
| `source: csharp/csharp-async`          | `templates/csharp/csharp-async.skill.md` (preferred)                |
| `source: devops/code-review-publisher` | `templates/devops/code-review-publisher.agent.md` (auto-discovered) |
| `name: my-skill` (no source, legacy)   | `templates/prompts/my-skill.prompt.md` (legacy fallback)            |

---

## How to Use Skills

### In Copilot CLI

Skills become available immediately after installing the plugin or placing a `SKILL.md` in a supported location. Copilot selects them automatically based on context.

**Manage skills in the CLI:**

```bash
/skills list      # list all available skills
/skills           # toggle skills on/off interactively
/skills info      # show details including skill location and source plugin
/skills add       # add an alternative skills location
/skills reload    # reload skills added during the current session
/skills remove SKILL-DIR  # remove a directly-added skill (not package skills)
```

**Explicitly reference a skill in a prompt:**

```text
Use the /csharp-async skill to improve the async code in this file.
```

**After installing a package, use its skills:**

```bash
# Install the package (once per project)
apm install dotnet@apm-hub

# Skills are now available — the agent selects them automatically,
# or you can reference them explicitly:
Use the /dotnet-create-solution skill to scaffold the project.
```

In supported IDEs (VS Code, JetBrains), skills appear in the slash-command autocomplete list alongside regular prompts.

---

## How to Create a New Skill

1. **Write the skill template** in `templates/<domain>/`:

   ```
   templates/csharp/my-new-skill.skill.md
   ```

   Give it a YAML front-matter with at minimum a `description` field.

2. **Register the skill** in the relevant `plugin.config.yml`:

   ```yaml
   skills:
     - name: my-new-skill
       source: csharp/my-new-skill
   ```

3. **Run the generator**:

   ```bash
   npm run generate
   ```

4. **Commit** both the template and the generated `SKILL.md`.

---

## Skills in This Repository

All skills available in apm-hub are listed in **[`docs/skill-list.md`](../skill-list.md)**.

Each skill is part of a plugin. See **[`docs/plugin-list.md`](../plugin-list.md)** for the full plugin overview, or **[`docs/concepts/plugins.md`](plugins.md)** for details on the plugin system.

---

## Related

- [Prompts](prompts.md) — the source templates skills are generated from
- [Plugins](plugins.md) — the distribution unit that bundles skills
- [Subagents](subagents.md) — how skills can be used by delegated sub-agents
- [Plugin List](../plugin-list.md) — all plugins with their skills listed
- [Skill List](../skill-list.md) — all skills across all plugins

---

## Further Reading

- [skills-vs-prompts.md](skills-vs-prompts.md) — Skills vs. Prompts full comparison
- [global-sharing.md](../sync/global-sharing.md) — Full path comparison, tool-support matrix, and cross-machine sync setup
- [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) — GitHub Docs: what skills are, how they work, and how Copilot loads them
- [Creating agent skills for GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills) — GitHub Docs: step-by-step guide for creating skills
- [Copilot customization cheat sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet) — GitHub Docs: comparison of skills vs. other customization options
