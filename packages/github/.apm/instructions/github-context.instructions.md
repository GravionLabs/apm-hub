---
applyTo: "**"
---

# GitHub Context

Always resolve the GitHub owner and repository name from the git remote — never ask the user.

## How to resolve

```bash
git remote get-url origin
```

Parse the output:
- SSH: `git@github.com:owner/repo.git` → owner = `owner`, repo = `repo`
- HTTPS: `https://github.com/owner/repo.git` → owner = `owner`, repo = `repo`

To find the default branch:
```bash
git symbolic-ref refs/remotes/origin/HEAD --short
# output: origin/main → default branch is "main"
```

## Rules
- Never ask the user for the owner, repo, or branch name — always derive them automatically.
- Strip the `.git` suffix from the repo name if present.
- If `git remote get-url origin` fails, report the error and ask the user.
