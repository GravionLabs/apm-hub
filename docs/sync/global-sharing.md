# Global Sharing of Agents, Prompts, Instructions & Skills

> **Cross-reference:** Official GitHub Copilot documentation on [customization options](https://docs.github.com/en/copilot/reference/customization-cheat-sheet) and [custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot).

This guide explains how to make your agents, prompts, instructions, and skills available **across all repositories** — not just the one they were created in.

---

## Why Global Sharing?

By default, all Copilot customizations live in `.github/` of a specific repository. This means:

- A `/csharp-code-review` prompt created for Project A isn't available in Project B.
- An agent persona you wrote is invisible in any new repo.
- Skills installed via a plugin are available everywhere — but hand-crafted files are not.

**Global sharing** solves this by storing files in your home directory so every project can use them.

---

## Two Different Home Directories

⚠️ **Important:** Agents, prompts, and instructions use **a different root** than skills:

| Type | Global path | Standard |
| :--- | :--- | :--- |
| Agents (`.agent.md`) | `~/.github/agents/` | GitHub Copilot |
| Prompts (`.prompt.md`) | `~/.github/prompts/` | GitHub Copilot |
| Instructions (`.instructions.md`) | `~/.github/instructions/` | GitHub Copilot |
| `copilot-instructions.md` | `~/.github/copilot-instructions.md` | GitHub Copilot |
| `AGENTS.md` | `~/.github/AGENTS.md` | OpenAI Codex / Claude |
| Skills (`SKILL.md`) | `~/.copilot/skills/<name>/SKILL.md` | agentskills.io open standard |

> **Skills deliberately use `~/.copilot/`, not `~/.github/`.**  
> The [agentskills.io specification](https://agentskills.io/specification) defines a tool-agnostic path (`~/.copilot/`, `~/.claude/`, `~/.agents/`) so skills work across different AI systems, not just GitHub Copilot.  
> See [skills.md](../concepts/skills.md) for details.

---

## Tool Support Matrix

Which tool loads global files from which path:

| File type | `~/.github/` | VS Code | CLI (`gh copilot`) | JetBrains |
| :--- | :--- | :---: | :---: | :---: |
| `.agent.md` | `agents/` | ✅ | ✅ | ⬜ |
| `.prompt.md` | `prompts/` | ✅ | ✅ | ✅ |
| `.instructions.md` | `instructions/` | ✅ | ✅ | ⬜ |
| `copilot-instructions.md` | root | ✅ | ✅ | ✅ |
| `AGENTS.md` | root | ✅ | ✅ | ⬜ |
| `SKILL.md` | `~/.copilot/skills/<name>/` | ✅ | ✅ | ✅ |

> ✅ Supported · ⬜ Not supported / not documented

---

## Plugin vs. File-Based Approach

| Aspect | File-based (manual) | Plugin (copilot-hub) |
| :--- | :--- | :--- |
| **Setup** | Copy files to `~/.github/` or `~/.copilot/` | `gh copilot plugin install <url>` |
| **Updates** | Manual or via `gh-copilot-sync` | `gh copilot plugin update` |
| **Customization** | Full control over each file | Controlled by plugin author |
| **Portability** | Manual sync across machines | Plugin installed per machine |
| **Best for** | Personal workflows, team conventions | Curated skill sets, shareable toolkits |

**When to use which:**
- Use **file-based** for personal conventions and custom prompts you maintain yourself.
- Use **plugins** for third-party or team-curated skill collections (e.g., `copilot-workspace`, `csharp-development`).
- You can use **both** simultaneously — there are no conflicts as long as slash-command names don't collide.

---

## Collision Semantics & Precedence

When the same slash command name exists in multiple scopes, Copilot resolves it in this order:

```
Project scope  (.github/)  ← highest priority
    ↓
Global scope   (~/.github/ or ~/.copilot/)
    ↓
Plugin scope   (installed plugins)  ← lowest priority
```

**Example:** If `.github/prompts/csharp-code-review.prompt.md` exists in your current repo, it takes precedence over `~/.github/prompts/csharp-code-review.prompt.md` and any plugin-installed `/csharp-code-review` skill.

**Recommendation:** Give project-specific customizations unique names to avoid unintentional overrides.

---

## Cross-Machine Sync: Dotfiles Approach

To keep your global files in sync across machines, store them in a **dotfiles repository**:

```
~/dotfiles/
├── github/           ← maps to ~/.github/
│   ├── agents/
│   ├── prompts/
│   ├── instructions/
│   └── copilot-instructions.md
└── copilot/          ← maps to ~/.copilot/
    └── skills/
```

### Symlink setup (recommended)

```bash
# Create symlinks
ln -s ~/dotfiles/github ~/.github
ln -s ~/dotfiles/copilot ~/.copilot
```

### Or use GNU stow

```bash
cd ~/dotfiles
stow --target=$HOME github
stow --target=$HOME copilot
```

This way, any change you push to your dotfiles repo is immediately available everywhere after a `git pull`.

---

## Automation with copilot-hub

The `gh-copilot-setup` and `gh-copilot-sync` skills support global installation out of the box.

### Initial setup

```text
/gh-copilot-setup
```

The setup wizard will ask whether to also install selected templates to your global `~/.github/` directory (in addition to the current project).

### Sync existing global files

```text
/gh-copilot-sync
```

Syncs all `.github/instructions`, `.github/prompts`, and `.github/agents` files **and** the configured global base directory (`~/.github/`) with the latest versions from `GravionLabs/copilot-hub`.

---

## Further Reading

- [agents.md](../concepts/agents.md) — Agent files, global path, tool-support matrix
- [prompts.md](../concepts/prompts.md) — Prompt files, global path, tool-support matrix
- [skills.md](../concepts/skills.md) — Skill files, personal path (`~/.copilot/`), plugin distribution
- [gh-copilot-setup.prompt.md](../../templates/prompts/gh-copilot-setup.prompt.md) — Setup wizard template
- [gh-copilot-sync.prompt.md](../../templates/prompts/gh-copilot-sync.prompt.md) — Sync script template
- [GitHub Copilot customization cheat sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet) — Official comparison of all customization options
