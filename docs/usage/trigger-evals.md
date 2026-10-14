# Skill trigger evals

Skill descriptions decide whether a model loads a skill. `evals/skill-triggers.json` holds, per model-invocable skill, prompts that should trigger it (`shouldTrigger`) and prompts that should not (`shouldNotTrigger`). `scripts/Invoke-TriggerEvals.ps1` runs them headless and scores which skill the model chose.

## Run

```powershell
pnpm install; pnpm run build                       # the scorer lives in dist/
pwsh scripts/Invoke-TriggerEvals.ps1 -DryRun       # lists prompts and the command, calls nothing (also -WhatIf)
pwsh scripts/Invoke-TriggerEvals.ps1 -Runs 3 -Out evals/results/trigger-results.json
pwsh scripts/Invoke-TriggerEvals.ps1 -Baseline evals/baseline.json -Out evals/results/latest.json
pwsh scripts/Invoke-TriggerEvals.ps1 -Skill review-fanout,verify-project   # subset
```

Install the skills first (`apm install` in the directory you run from) so `claude` sees them. Each prompt goes to `claude -p <prompt> --output-format stream-json --verbose`; Skill `tool_use` calls in the transcript are the chosen skills (a `plugin:skill` name counts as `skill`). The exit code is 1 when a threshold or the baseline comparison fails.

## Cost caveat

Every prompt runs `-Runs` times (default 3) as a real model session: with the current set that is hundreds of calls. Run it on demand, never in CI, and use `-Skill` or `-Runs 1` while iterating.

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

Rates are percent (0-100). `triggerRate` is the share of positive runs where the expected skill was invoked; `falseTriggerRate` the share of negative runs where it was invoked anyway. A result file is also a valid `-Baseline`.

## Threshold

- Trigger rate on should-trigger prompts >= 80 %.
- False-trigger rate on should-not-trigger prompts <= 10 %.
- Regression: a re-run fails when a trigger rate drops, or a false-trigger rate rises, by more than 5 points against the baseline (overall or per skill).

The numbers live in `src/generators/skill-trigger-score.ts`.

## When to re-run

After changing a skill `description`, adding or removing a model-invocable skill, or changing the 2,600-character description budget. Commit the new result as the baseline when it passes. The offline check that the eval set matches the skills on disk runs in `pnpm test`.
