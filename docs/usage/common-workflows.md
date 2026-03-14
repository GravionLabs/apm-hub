# Common Workflows

This guide walks through concrete, end-to-end scenarios that combine plugins, agents, skills, and
instructions to solve real development tasks. Each workflow starts from a fresh repository.

---

## Workflow 1: Setting Up C# Development

**Goal:** Equip a .NET repository with expert agents, C# scaffolding commands, and coding standards.

### Step 1 — Install the plugin

```bash
gh copilot plugin install csharp-development@copilot-hub
```

This single command copies the following into your repository:

| What                            | Where it lands                                      | What it does                                             |
| :------------------------------ | :-------------------------------------------------- | :------------------------------------------------------- |
| `@csharp-expert` agent          | `.github/agents/csharp-expert.agent.md`             | Expert C# persona for all Copilot chats                  |
| `/create-dotnet-solution` skill | Registered as slash command                         | Scaffolds a new .NET solution with `src/`+`test/` layout |
| `/csharp-code-review` skill     | Registered as slash command                         | Priority-tagged (🔴/🟡/🟢) code review                   |
| `csharp.instructions.md`        | `.github/instructions/csharp.instructions.md`       | C# coding standards, auto-applied to `**/*.cs`           |
| `csharp-nunit.instructions.md`  | `.github/instructions/csharp-nunit.instructions.md` | NUnit 4 test conventions, scoped to `test/**/*.cs`       |

### Step 2 — Scaffold a new solution

In Copilot Chat:

```
/create-dotnet-solution
```

Copilot asks for the solution name, then generates:

```
Gravion.Payments.sln
src/Gravion.Payments/
test/Gravion.Payments.Tests/
Directory.Build.props
.editorconfig
```

### Step 3 — Work with expert guidance

Ask questions or give tasks to `@csharp-expert` directly:

```
@csharp-expert Implement a repository pattern for the Order entity using EF Core.
```

The agent applies the installed instructions automatically — no need to restate conventions.

---

## Workflow 2: Adding CI/CD to a .NET Project

**Goal:** Add a GitHub Actions NuGet packaging workflow to an existing C# project.

### Step 1 — Install the devops plugin

```bash
gh copilot plugin install devops@copilot-hub
```

This registers the `/create-nuget-workflow` skill and copies DevOps-related instruction files
(`shell.instructions.md`, `docker.instructions.md`, etc.) into `.github/instructions/`.

### Step 2 — Generate the workflow

In Copilot Chat:

```
/create-nuget-workflow
```

Copilot generates a GitHub Actions workflow file that calls the `GravionLabs/ci` reusable NuGet
Package CI/CD workflow. The generated YAML is ready to commit at
`.github/workflows/nuget-package.yml`.

### Step 3 — Create a PR

After reviewing and committing the workflow file:

```
/create-pr
```

The `/create-pr` skill analyses your `git log` and staged diff, writes a structured PR description,
and opens the pull request — or hands you the `gh pr create` command with a pre-filled body.

---

## Workflow 3: Security Review

**Goal:** Perform a STRIDE-aligned security and resilience review of a feature before merging.

### Step 1 — Install the security plugin

```bash
gh copilot plugin install security@copilot-hub
```

This registers two agents — `@security-reviewer` (general security and STRIDE threat modelling) and
`@se-security-reviewer` (software engineering security review) — and copies
`security.instructions.md` into `.github/instructions/`.

### Step 2 — Review a feature branch

Switch to Copilot Chat and mention the agent:

```
@security-reviewer Review the changes in src/Gravion.Payments/PaymentProcessor.cs for security
issues. Focus on input validation, secrets handling, and injection risks.
```

The agent has `@workspace` access and will traverse the file, cross-reference related code, and
return a structured finding list with severity ratings.

### Step 3 — Threat model a new component

```
@security-reviewer Perform a STRIDE threat model for the new Webhook receiver in
src/Gravion.Payments/Webhooks/.
```

The agent walks through Spoofing, Tampering, Repudiation, Information Disclosure, Denial of
Service, and Elevation of Privilege for your specific component.

---

## Workflow 4: Copying Templates Manually (Without Plugins)

**Goal:** Adopt individual templates without installing a plugin — useful when you only need one or
two files.

### Step 1 — Browse the template list

Open [`docs/template-list.md`](../template-list.md) to find the template you need. Templates are
organised by category (instructions, agents, prompts).

### Step 2 — Copy the file

Copy the desired file from `templates/` to the correct location in your repository:

| Template type | Source path                                          | Destination                                        |
| :------------ | :--------------------------------------------------- | :------------------------------------------------- |
| Instruction   | `templates/instructions/csharp.instructions.md`      | `.github/instructions/csharp.instructions.md`      |
| Prompt        | `templates/prompts/create-dotnet-solution.prompt.md` | `.github/prompts/create-dotnet-solution.prompt.md` |
| Agent         | `templates/agents/security-reviewer.agent.md`        | `.github/agents/security-reviewer.agent.md`        |

You can also use `curl` or copy-paste directly from GitHub:

```bash
# Example: copy the C# instructions template
curl -o .github/instructions/csharp.instructions.md   https://raw.githubusercontent.com/GravionLabs/copilot-hub/main/templates/instructions/csharp.instructions.md
```

### Step 3 — Customise

Edit the copied file to match your project's specific standards. The templates are intentionally
general — localise them to your tech stack and team preferences.

---

## Cross-References

- [Quick Start](../../README.md#-quick-start)
- [What are Plugins?](../concepts/plugins.md)
- [Plugin List](../plugin-list.md)
- [Template List](../template-list.md)
