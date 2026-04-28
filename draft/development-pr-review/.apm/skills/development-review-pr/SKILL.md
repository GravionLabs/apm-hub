---
name: development-review-pr
description: "Entry point for the generic PR review workflow. Provide an Azure DevOps Pull Request ID and the development-pr-reviewer agent will fetch the PR, detect the tech stack from changed files, delegate code analysis to the correct language specialist (development-dotnet-pr-review-code-reviewer for .NET), post inline comments, and set the reviewer vote."
model: gpt-4.1
---

## Usage

Extract the PR ID from the user's message and hand off to the `development-pr-reviewer` agent.

## Steps

1. Extract the PR number from the user input (e.g. `19367` from "review PR 19367" or just "19367").
2. Optionally note any extra context (e.g. specific repo or project name if provided).
3. Invoke the `development-pr-reviewer` agent:

> Invoke `@development-pr-reviewer`: Review PR `<PR_ID>`. `<If repo/project provided: "Repository: <name>, Project: <project>">`. Execute the full review workflow immediately — fetch PR, prepare repo, get diff, analyse code, post inline comments, auto-close resolved threads, and set vote. Do not ask for confirmation.
