---
mode: agent
description: 'Set up and manage Go modules: go.mod initialisation, go.work workspaces, vendor mode, and dependency hygiene'
tools: ['editFiles', 'codebase', 'runCommands']
---
# Go Module Setup

${input:task:Describe the module task — initialise a module, add a dependency, configure a workspace, set up vendor mode, or fix a dependency issue}

## Steps

1. Check current `go.mod` and `go.sum` state
2. Apply the appropriate `go mod` or `go work` commands
3. Run `go mod tidy` to ensure consistency
4. Verify the build still passes with `go build ./...`

## Key Commands

```bash
go mod init github.com/org/repo      # new module
go mod tidy                          # sync imports
go mod vendor                        # create vendor dir
go work init && go work use ./...    # workspace setup
go list -m all                       # list all dependencies
```
