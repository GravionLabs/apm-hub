---
name: development-implement-ticket
description: "Entry point for the generic development workflow. Provide an Azure DevOps ticket number (Bug, PBI, or Task) and optionally extra context. The development-workflow agent resolves the repository, creates a branch, auto-detects the tech stack, delegates to the correct specialist (development-dotnet-engineer for .NET), then commits, pushes, and creates a Pull Request."
model: gpt-4.1
---

## Usage

Trigger this skill when the user says:
- "implement ticket 12345"
- "implement PBI 12345"  
- "work on ticket 12345"
- "start development on 12345"
- "develop feature 12345"

## What Happens

The `development-workflow` agent will:

1. **Fetch** the ticket details from Azure DevOps
2. **Resolve** the repository (from Planning 2 clarifications or current directory)
3. **Create** a feature branch based on `origin/main`
4. **Detect** the tech stack (`.csproj` → .NET, `angular.json` → Angular)
5. **Delegate** to the language specialist for dependency hygiene and implementation
6. **Commit** all changes with the ticket number
7. **Push** the branch and **create** a linked Pull Request in Azure DevOps

## Parameters

| Parameter | Required | Description |
|---|---|---|
| Ticket number | ✅ | ADO work item ID (Bug, PBI, or Task) |
| Extra context | ❌ | Additional implementation guidance or constraints |