---
description: Setup a sync-config.json for a project based on its technology stack
---

# Setup Sync Configuration

Help the user set up a `.github/sync-config.json` file for their repository to synchronize shared GitHub Copilot templates from the central repository `jkaufmann/github-copilot-templates`.

## Step 1: Analyze Project Stack
Analyze the current codebase to identify:
- Primary programming languages (e.g., C#, Python, TypeScript, Shell, PowerShell).
- Frameworks and tools (e.g., ASP.NET, Angular, Blazor, NUnit, Pytest, Playwright, Docker, Terraform).
- Infrastructure/CI-CD (e.g., Azure DevOps, GitHub Actions).

## Step 2: Suggest Templates
Based on the identified stack, select relevant templates from the following categories:

### Instructions
- General: `general.instructions.md`, `security.instructions.md`, `markdown.instructions.md`
- C#: `csharp.instructions.md`, `csharp-nunit.instructions.md`, `dotnet-architecture-good-practices.instructions.md`
- Python: `python.instructions.md`, `python-pytest.instructions.md`
- Frontend: `typescript.instructions.md`, `angular.instructions.md`
- DevOps: `azure-devops-pipelines.instructions.md`, `containerization-docker-best-practices.instructions.md`, `terraform.instructions.md`

### Prompts
- Generic: `code-review.prompt.md`, `explain-code.prompt.md`, `refactor.prompt.md`, `write-tests.prompt.md`
- C#: `csharp-code-review.prompt.md`, `csharp-docs.prompt.md`, `dotnet-best-practices.prompt.md`
- Python: `python-code-review.prompt.md`, `pytest-coverage.prompt.md`
- Database: `sql-code-review.prompt.md`, `postgresql-code-review.prompt.md`

### Agents
- `devops-expert.agent.md`, `security-reviewer.agent.md`, `test-engineer.agent.md`

## Step 3: Generate sync-config.json
Generate a JSON code block for `.github/sync-config.json` using the following structure:

```json
{
  "syncSettings": {
    "type": "github",
    "org": "jkaufmann",
    "repo": "github-copilot-templates",
    "branch": "main",
    "sourceDir": "templates",
    "targetDir": ".github"
  },
  "files": [
    "instructions/security.instructions.md",
    "prompts/code-review.prompt.md",
    "..." 
  ]
}
```

**Rules:**
- Use the actual relative paths within the `templates/` directory (e.g., `instructions/csharp.instructions.md`).
- Only include files that are relevant to the detected project stack.
- Always include `instructions/security.instructions.md`.
- Ensure the user knows they should create this file at `.github/sync-config.json`.
