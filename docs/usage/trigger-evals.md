# Skill trigger evals

Skill descriptions decide whether a model loads a skill. `evals/skill-triggers.json` holds, per model-invocable skill, prompts that should trigger it (`shouldTrigger`) and prompts that should not (`shouldNotTrigger`). `scripts/Invoke-TriggerEvals.ps1` runs them headless and scores which skill the model chose.

## Run

```powershell
pnpm install; pnpm run build                       # the scorer lives in dist/
pwsh scripts/Invoke-TriggerEvals.ps1 -DryRun       # lists prompts and the command, calls nothing (also -WhatIf)
pwsh scripts/Invoke-TriggerEvals.ps1 -Runs 3 -Out evals/results/trigger-results.json
pwsh scripts/Invoke-TriggerEvals.ps1 -Baseline evals/baseline/2026-10-14.json -Out evals/results/latest.json
pwsh scripts/Invoke-TriggerEvals.ps1 -Skill review-fanout,verify-project   # subset
```

Install the skills first (`apm install` in the directory you run from) so `claude` sees them. Each prompt goes to `claude -p <prompt> --output-format stream-json --verbose --model sonnet --max-turns 4 --disallowedTools Edit Write Bash NotebookEdit` (the tool deny list keeps the model from changing the repo); Skill `tool_use` calls in the transcript are the chosen skills (a `plugin:skill` name counts as `skill`). The exit code is 1 when a threshold or the baseline comparison fails.

## Cost caveat

Every prompt runs `-Runs` times (default 3) as a real model session: with the current set that is 228 calls. The runner uses `-Model sonnet`, `-MaxTurns 4` and runs `-ThrottleLimit 8` sessions in parallel; the model, runs and date are stored under `meta` in the result. Run it on demand, never in CI, and use `-Skill` or `-Runs 1` while iterating.

## Result schema

```json
{
  "summary": {
    "overall": { "positives": 0, "negatives": 0, "triggerRate": 0, "falseTriggerRate": 0 },
    "skills": [ { "skill": "name", "positives": 0, "negatives": 0, "triggerRate": 0, "falseTriggerRate": 0 } ]
  },
  "records": [ { "skill": "name", "kind": "positive|negative", "prompt": "...", "invoked": ["skill"] } ],
  "thresholdFailures": [],
  "regressions": []
}
```

`notInstalled` and `meta` (date, model, runs, maxTurns) are also written. Rates are percent (0-100). `triggerRate` is the share of positive runs where the expected skill was invoked; `falseTriggerRate` the share of negative runs where it was invoked anyway. A result file is also a valid `-Baseline`.

## Threshold

- Trigger rate on should-trigger prompts >= 80 %.
- False-trigger rate on should-not-trigger prompts <= 10 %.
- Regression: a re-run fails when a trigger rate drops, or a false-trigger rate rises, by more than 5 points against the baseline (overall or per skill).

The numbers live in `src/generators/skill-trigger-score.ts`.

## Baseline

[`evals/baseline/2026-10-14.json`](../../evals/baseline/2026-10-14.json): model `sonnet`, 3 runs, `--max-turns 4`, 40 prompts (120 runs) for the 10 installed skills; `notInstalled` lists the skipped ones. Overall trigger rate 75 %, false-trigger rate 0 %. Several skills are still below the 80 % threshold (see the file), so the baseline records the current state; it is not a pass. `evals/results/` is git-ignored.

Measurement notes: skills that are not installed (`.claude/skills` of the project or `~/.claude/skills`) are skipped and listed under `notInstalled`, never scored 0 %; a full baseline needs `all@apm-hub` installed. haiku rarely consults skills (about 25 % trigger on five installed skills versus 57 % for sonnet), so sonnet is the default. Prompts must be substantive tasks: one-line prompts are answered directly.

## When to re-run

After changing a skill `description`, adding or removing a model-invocable skill, or changing the 2,600-character description budget. Commit the new result as the baseline when it passes. The offline check that the eval set matches the skills on disk runs in `pnpm test`.
