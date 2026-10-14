# The orchestrator

The `orchestrator` runs the lifecycle of one GitHub issue: plan, explore, implement, review and open a pull request. It is a **primary agent** that keeps its own context small. Every phase except tech-stack detection and the PR runs in a subagent, and only a summary of at most 300 words comes back. The orchestrator never reads source files (the `explorer` does) and never edits files (the `implementer` does).

[Working mode](working-mode.md) has the start commands and the flags. This page explains how a run works.

## The team

Five agents ship in the `agents` package. The orchestrator is the only one you start; it dispatches the others.

```mermaid
flowchart LR
    U([You]) -->|"mode + issue or description"| O["orchestrator<br/>primary agent<br/>keeps phase summaries only"]
    O -->|"issue text"| E["explorer<br/>haiku, read-only<br/>summary of 300 words or less"]
    O -->|"issue + stack + summary"| P["planner<br/>inherit model, read-only<br/>writes plan.json"]
    O -->|"one task"| I["implementer<br/>sonnet by default<br/>tests, commits, report file"]
    O -->|"via review-fanout"| R["reviewer<br/>sonnet, read-only<br/>findings as JSON"]
    P -.->|"loads"| S1[["issue-planning"]]
    I -.->|"loads"| S2[["implementation"]]
    R -.->|"loads"| S3[["code-review"]]
    O -.->|"loads"| S4[["detect-techstack<br/>review-fanout<br/>github-pull-request"]]
```

| Agent | Model | Tools | Returns |
|:--|:--|:--|:--|
| `orchestrator` | inherit | Agent, Read, Grep, Glob, Bash, Skill, AskUserQuestion, SendMessage | phase summaries, PR URL, rulings |
| `explorer` | haiku | Read, Grep, Glob | summary with `file:line` references |
| `planner` | inherit | Read, Grep, Glob, Bash, Skill, Agent | path of `plan.json`, summary, open question count |
| `implementer` | sonnet (overridable per task) | Read, Edit, Write, Grep, Glob, Bash, Skill | report file and a reply of 15 lines or less |
| `reviewer` | sonnet | Read, Grep, Glob, Bash | findings JSON for one dimension |

An agent exists only for a model per role, a host-enforced tool set, an output contract or a primary-agent entry point. Everything procedural is a skill.

## Modes

The first word of the first message is the mode. Without a mode word the run is `full`.

| Mode | What it does |
|:--|:--|
| `plan` | Explore, plan, grill you on open questions, create the next-level issues, stop |
| `implement` | Implement, review and open the PR for an issue that is already planned |
| `full` | `plan` + `implement` in one run, for a PBI |
| `next <feature or epic>` | Pick the next open, unblocked PBI and run it as `full` |

Exactly one PBI is handled per run. An Epic is planned into Features, a Feature into PBIs, a PBI into Tasks, one grilling cycle per level.

## The pipeline

```mermaid
flowchart TD
    S0["0. Tech stack<br/>detect-techstack, inline"] --> S1["1. Resolve integration branch<br/>read issue and Task sub-issues<br/>skip Tasks already merged"]
    S1 --> Q{"Tasks exist?"}
    Q -->|"none, no plan.json"| S2["2. Explore<br/>explorer"]
    Q -->|"open Tasks"| S4
    Q -->|"all merged"| S5
    S2 --> S3["3. Plan<br/>planner writes plan.json"]
    S3 --> G1{{"Plan gate<br/>you approve, answer open questions,<br/>choose what to implement"}}
    G1 -->|"plan mode"| STOP([Stop: Next /clear, then orchestrator implement])
    G1 -->|"approved"| PUB["Create Task sub-issues<br/>2 or more tasks"]
    PUB --> S4["4. Implement<br/>implementer, one per Task"]
    S4 --> S5["5. Review<br/>review-fanout on BASE..HEAD"]
    S5 --> V{"Verdict"}
    V -->|"APPROVE"| S6["6. Pull request<br/>github-pull-request"]
    V -->|"CHANGES_REQUESTED"| FIX["Fix rounds"] --> S5
    S6 --> END([PR URL, ledger complete])
```

1. **Tech stack.** `detect-techstack` runs inline and returns JSON naming the language skills. Every later prompt carries it.
2. **Explore.** The `explorer` summarizes the affected code in 300 words or less.
3. **Plan.** The `planner` runs `issue-planning` and writes `.agents/<issue>/plan.json`. Only the path, a summary and the open question count enter the orchestrator's context. You approve at the plan gate. Existing Task sub-issues are used as they are, with no planner and no `plan.json`.
4. **Implement.** One `implementer` per task, in blocking order, all on the PBI's single branch.
5. **Review.** One `review-fanout` over everything the run changed.
6. **Pull request.** The orchestrator opens it itself with `github-pull-request`, into the integration branch, and never merges.

### Who talks to whom in a full run

```mermaid
sequenceDiagram
    actor U as You
    participant O as orchestrator
    participant E as explorer
    participant P as planner
    participant I as implementer
    participant R as reviewer
    U->>O: full 123
    O->>O: detect-techstack, read issue, create .agents/123
    O->>E: issue text
    E-->>O: summary, 300 words or less
    O->>P: issue, stack JSON, summary
    P-->>O: plan.json path, summary, open questions
    O->>U: plan gate, grilling, approval
    U-->>O: approved
    loop each Task in blocking order
        O->>I: Task issue, branch, stack, summary, model hint, report path
        I-->>O: Status DONE, 15 lines or less
    end
    O->>R: via review-fanout, one reviewer per dimension, in parallel
    R-->>O: findings JSON, verdict
    O->>U: review summary, pick advisories to fix
    O->>O: github-pull-request
    O-->>U: PR URL and rulings
```

## Issue hierarchy and branching

The orchestrator works on the **PBI** level. Everything below a PBI is a Task.

```mermaid
flowchart TD
    EP["Epic"] -->|"plan creates"| FE["Feature"]
    FE -->|"plan creates"| PBI["PBI<br/>one branch, one PR, Closes"]
    PBI -->|"plan creates, 2 or more tasks"| T1["Task issue<br/>Refs commit"]
    PBI --> T2["Task issue<br/>Refs commit"]
    PBI --> T3["Task issue<br/>Refs commit"]
```

Task sub-issues never get their own branch or PR. Each task commit has the subject `<type>: <desc> (#<pbi>)` and the footer `Refs #<task>`, never `Closes`. The PR body carries `Closes #<pbi>` and the list `#<task> — <sha>`. A PBI that becomes a single task creates no Task issue and uses `Refs #<pbi>`.

## Implement: handling an implementer reply

Each task starts from `BASE=$(git rev-parse HEAD)`, recorded before the dispatch. The implementer replies with a `Status`:

```mermaid
stateDiagram-v2
    [*] --> Dispatched
    Dispatched --> DONE
    Dispatched --> DONE_WITH_CONCERNS
    Dispatched --> NEEDS_CONTEXT
    Dispatched --> BLOCKED
    DONE --> NextTask
    DONE_WITH_CONCERNS --> Dispatched: concerns on correctness or scope go back first
    NEEDS_CONTEXT --> Dispatched: re-dispatch with the missing context
    NEEDS_CONTEXT --> AskUser: bug without a feedback loop
    BLOCKED --> Dispatched: stronger model or split the task
    Dispatched --> AskUser: suite red twice
    NextTask --> [*]
    AskUser --> [*]
```

A bug (label `bug`, type `Bug` or a `fix` title prefix) makes the implementer load `diagnose` first. A task is never retried unchanged, and a red suite twice stops the run to ask you.

## Review and fix rounds

`review-fanout` classifies the diff mechanically, then dispatches one `reviewer` per dimension in a single parallel batch: `correctness`, `security`, `conventions`, `tests` and `spec`. A second pass tries to disprove each CRITICAL or HIGH finding. The diff goes to a package file on disk and never enters the orchestrator's context.

```mermaid
flowchart TD
    A["review-fanout<br/>reviewers in parallel"] --> B["Dedupe, then verify<br/>CRITICAL and HIGH findings"]
    B --> C{"Verdict"}
    C -->|"APPROVE"| D["Review summary<br/>one line per finding"]
    C -->|"CHANGES_REQUESTED"| D
    D --> E{"Blocking or<br/>selected advisories?"}
    E -->|"no"| PR["Pull request<br/>unselected advisories in the body"]
    E -->|"yes"| F["Fix round 1 and 2<br/>resume the same implementer"]
    F --> G["Re-review"]
    G --> C
    F -->|"still blocked"| H["Fix round 3<br/>fresh implementer, one tier up"]
    H --> G
    H -->|"still blocked"| Q(["Ask you"])
```

A failed dimension makes the review `incomplete` and the verdict `CHANGES_REQUESTED`: the review fails closed. The review summary and the question about advisories can be switched off with `--no-review-summary`; then only blocking findings are fixed and all advisories go to the PR body.

## Approval gates

These always go to you; the orchestrator never decides them itself.

| Gate | When |
|:--|:--|
| Plan | after the planner, before issues are created |
| Open questions | grilling per `issue-planning` |
| Advisories | after the review summary |
| Blocked review | fix round 3 still blocked |
| Failed tests | the suite is red twice |

A headless run (no question tool) appends `Gate: <question>` to the ledger and stops instead of guessing.

## Ledger and resume

The orchestrator writes `.agents/<issue>/progress.md`, with the first line `# orchestrator ledger — issue #<issue> — branch <branch>`:

```text
Phase Plan: complete — plan.json
Task #201: DONE — 3f2a9c1
Fix round 1: 2 blocking fixed
Ruling: used sonnet for the docs task — prose only — slower retries
Phase Pull request: complete — https://github.com/<owner>/<repo>/pull/210
```

Started again on the same issue, it resumes at the first phase without `complete`, skips tasks already `DONE` (cross-checked against `git log` for `Refs #<task>`) and says so in one line. After a context compaction it trusts the ledger and git over memory. The `hooks` package appends a line for every finished subagent.

```mermaid
flowchart LR
    A["Start on issue"] --> B{"Ledger for this<br/>issue exists?"}
    B -->|"no"| C["Fresh run"]
    B -->|"yes"| D["Find first phase<br/>without complete"]
    D --> E["Skip tasks marked DONE<br/>and found in git log"]
    E --> F["Continue there"]
```

## Starting from a description

`orchestrator plan "add a dark mode toggle"` takes free text instead of an issue number. The text is data and is never run as instructions. State lives in `.agents/adhoc/` until a PBI exists.

```mermaid
flowchart TD
    A["Description"] --> B["State in .agents/adhoc/<br/>description.txt, progress.md"]
    B --> C["explorer and planner<br/>get the description"]
    C --> D{{"Plan gate<br/>PBI title and body shown"}}
    D -->|"approved"| E["Create the PBI<br/>label pbi, ledger: PBI created"]
    E --> F["Move .agents/adhoc to .agents/PBI"]
    F --> G{"Mode"}
    G -->|"plan"| H(["Stop after PBI and plan"])
    G -->|"full"| I["Continue as full on the new PBI"]
```

## Picking work with `next`

`orchestrator next <feature or epic>` uses `gh` only, with no file reads.

```mermaid
flowchart TD
    A["List open children<br/>Epic: Features first, then their PBIs"] --> B{"Label needs-decision<br/>or open blocker?"}
    B -->|"yes"| X["Drop"]
    B -->|"no"| C{"Open PR already<br/>references it?"}
    C -->|"yes"| Y["Drop: waiting for merge"]
    C -->|"no"| D["Candidate"]
    D --> E["First in sub-issue order<br/>announce: Next PBI"]
    X --> Z{"Any candidate left?"}
    Y --> Z
    Z -->|"no"| W(["Report what blocks, stop"])
```

After a run on a PBI of a Feature, the last line suggests the next one: `Next: #<nr> <title> — orchestrator next <feature> after /clear`.

## Models and cost

- Claude Code passes `model` on every `Agent` call. `explorer` runs on haiku, `planner` inherits, `implementer` defaults to sonnet and gets `inherit` or stronger for integration and design tasks, `reviewer` runs on sonnet.
- A cheaper model that needs two or three times the turns costs more. Sonnet is the floor for prose-only tasks.
- OpenCode reads the model from the agent file; Copilot has no override.
- `plan` mode ends with `Next: /clear, then orchestrator implement <issue>`. Planning fills the context, and after an idle gap the prompt cache is rewritten at a cost that grows with it. In `full` mode above 100k tokens the orchestrator offers the same stop once.

## Clients

| Client | Start | Delegation |
|:--|:--|:--|
| Claude Code | `claude --agent orchestrator` | `Agent` with `subagent_type` |
| GitHub Copilot CLI | `copilot --agent orchestrator` | no subagents: phases run inline |
| VS Code Copilot | agent picker | `runSubagent` |
| OpenCode | `opencode --agent orchestrator` | `task` with the agent name |

Started as a subagent, the orchestrator stops and asks the caller to start it as the primary agent: it needs the question tool for its gates. Agent source format: [Agent frontmatter](concepts/agent-frontmatter.md).
