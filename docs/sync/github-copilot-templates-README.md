# GitHub Copilot Templates


Central repository for shared `.github/instructions` and `.github/prompts` files.

> **Note:** This is a template for the central `copilot-hub` repository.
> Copy this content to the root directory of your central repo.

## Purpose

This repository contains reusable configuration files for:
- **Instructions**: Claude Code / GitHub Copilot Instructions
- **Prompts**: Reusable Prompt Templates

These are automatically synchronized to project repositories.

## Structure

```
copilot-hub/
├── .github/
│   ├── instructions/
│   │   ├── python.instructions.md
│   │   ├── python-pytest.instructions.md
│   │   ├── python-mcp-server.instructions.md
│   │   ├── security.instructions.md
│   │   ├── typescript.instructions.md
│   │   ├── react.instructions.md
│   │   ├── docker.instructions.md
│   │   └── ...
│   └── prompts/
│       ├── code-review.prompt.md
│       ├── refactoring.prompt.md
│       └── ...
├── README.md
└── CHANGELOG.md
```

## Available Instructions

### Backend

| File                                | Description             | Language/Framework |
| :---------------------------------- | :---------------------- | :----------------- |
| `python.instructions.md`            | Python Coding Standards | Python             |
| `python-pytest.instructions.md`     | Testing with pytest     | Python + pytest    |
| `python-mcp-server.instructions.md` | MCP Server Guidelines   | Python MCP         |
| `node.instructions.md`              | Node.js Best Practices  | Node.js            |
| `go.instructions.md`                | Go Guidelines           | Go                 |

### Frontend

| File                         | Description          | Language/Framework |
| :--------------------------- | :------------------- | :----------------- |
| `typescript.instructions.md` | TypeScript Standards | TypeScript         |
| `react.instructions.md`      | React Best Practices | React              |
| `vue.instructions.md`        | Vue.js Guidelines    | Vue.js             |
| `nextjs.instructions.md`     | Next.js Patterns     | Next.js            |

### DevOps & Infrastructure

| File                         | Description           | Tool/Platform |
| :--------------------------- | :-------------------- | :------------ |
| `docker.instructions.md`     | Docker Best Practices | Docker        |
| `kubernetes.instructions.md` | K8s Guidelines        | Kubernetes    |
| `terraform.instructions.md`  | IaC Standards         | Terraform     |

### General

| File                            | Description             | Application      |
| :------------------------------ | :---------------------- | :--------------- |
| `security.instructions.md`      | Security Best Practices | **All Projects** |
| `git.instructions.md`           | Git Commit Standards    | All              |
| `documentation.instructions.md` | Documentation           | All              |

## Usage in Projects

### 1. Create Sync Config

Create `.github/sync-config.json` in your project repository:

```json
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "main"
  },
  "files": [
    ".github/instructions/python.instructions.md",
    ".github/instructions/security.instructions.md"
  ]
}
```

### 2. Setup Sync Workflow

See [documentation in your project](https://github.com/yourorg/trading-engine/blob/main/docs/shared-config-sync.md) for details.

## Add New Instruction

```bash
# 1. Create new file
cat > .github/instructions/rust.instructions.md <<'EOF'
---
description: 'Rust coding standards'
applyTo: '**/*.rs'
---

# Rust Guidelines

## Code Style
- Use `cargo fmt` for formatting
- Follow Rust API guidelines
- ...
EOF

# 2. Commit
git add .github/instructions/rust.instructions.md
git commit -m "Add Rust instructions"
git push

# 3. Use in projects
# Add to .github/sync-config.json:
# ".github/instructions/rust.instructions.md"
```

## Update Instruction

```bash
# 1. Edit file
vim .github/instructions/python.instructions.md

# 2. Commit with meaningful message
git add .github/instructions/python.instructions.md
git commit -m "python: add type hints requirement for public APIs"
git push

# 3. Update CHANGELOG.md
echo "- python: add type hints requirement for public APIs" >> CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs: update changelog"
git push
```

**Important:** All projects with this file in their `sync-config.json` will be updated on the next sync run!

## Instruction Format

Each instruction file should follow this format:

```markdown
---
description: 'Short description (for metadata)'
applyTo: 'File pattern (glob)'
priority: 100  # Optional: Higher = more important
---

# Title

## Section 1

Content...

## Section 2

Content...

## Examples

\```language
code example
\```
```

### Metadata Fields

- **description**: Short description of the instruction (1 line)
- **applyTo**: Glob pattern for files this instruction applies to
  - Examples: `**/*.py`, `**/test_*.py`, `**/Dockerfile`
- **priority** (optional): Priority in case of conflicts (0-999, higher = more important)

## Best Practices

### ✅ Do's

- **Specific**: Clear, actionable guidelines
- **Examples**: Show Good/Bad examples
- **Short**: Keep instructions focused (< 200 lines)
- **Versioned**: Use Semantic Commits (`feat:`, `fix:`, `breaking:`)
- **Tested**: Test changes in a project before merge
- **Documented**: Update CHANGELOG.md for breaking changes

### ❌ Don'ts

- **No Project Specifics**: Only general rules
- **No Absolutes**: Avoid "Never" and "Always" (except security)
- **No Contradictions**: Check consistency with other instructions
- **No Big Changes Without Review**: Have breaking changes reviewed

## Versioning

We use **Semantic Commits** for versioning:

```bash
# Minor Change (new rule, non-breaking)
git commit -m "feat(python): add docstring requirement for classes"

# Patch (Bugfix, clarification)
git commit -m "fix(typescript): clarify enum naming convention"

# Breaking Change (modify existing rules)
git commit -m "breaking(python): change max line length from 100 to 88"
```

### Versioning Schema

- **Major (X.0.0)**: Breaking Changes (all projects must adapt)
- **Minor (0.X.0)**: New instructions or rules (opt-in)
- **Patch (0.0.X)**: Bugfixes, clarifications (safe)

## Branches

- **main**: Production, synchronized to projects
- **staging**: Preview for testing (optional)
- **feature/\***: Feature branches for new instructions

### Workflow for Breaking Changes

```bash
# 1. Create feature branch
git checkout -b breaking/python-line-length

# 2. Make changes
vim .github/instructions/python.instructions.md

# 3. Test in test project
# Change in test project: "branch": "breaking/python-line-length"
# Test if everything works

# 4. Create PR and get review
gh pr create --title "breaking: change Python line length to 88" \
             --body "See discussion in #123"

# 5. After approval: Merge + Tag
git checkout main
git merge breaking/python-line-length
git tag v2.0.0
git push --tags
```

## Who Uses This Repository?

List of projects that synchronize this repo:

| Project        | Sync Status | Branch | Files                        |
| :------------- | :---------- | :----- | :--------------------------- |
| trading-engine | ✅ Active    | main   | python, pytest, security     |
| api-gateway    | ✅ Active    | main   | typescript, docker, security |
| ml-service     | ✅ Active    | main   | python, docker, security     |

(Automatically generated via [sync-tracker.yml](.github/workflows/sync-tracker.yml))

## Support

### Questions or Problems?

1. **Documentation**: See [Sync Documentation](https://github.com/yourorg/trading-engine/blob/main/docs/shared-config-sync.md)
2. **Issues**: Create an issue in this repository
3. **Team**: Contact #platform-team on Slack

### Pull Requests

Pull requests are welcome! Please:
1. Describe the change clearly
2. Add examples
3. Test in at least one project
4. Update CHANGELOG.md for breaking changes

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a complete history.

---

**Maintainer**: Platform Team (@platform-team)
**Created**: 2026-01-25
**License**: Internal Use Only
