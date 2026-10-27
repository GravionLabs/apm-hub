# Skill trigger evals

Skill descriptions decide whether a model loads a skill. `evals/skill-triggers.json` holds, per model-invocable skill, prompts that should trigger it (`shouldTrigger`) and prompts that should not (`shouldNotTrigger`). `scripts/Invoke-TriggerEvals.ps1` runs them headless and scores which skill the model chose.

## Run

```powershell
pnpm install; pnpm run build                       # the scorer lives in dist/
pwsh scripts/Invoke-TriggerEvals.ps1 -DryRun       # lists prompts and the command, calls nothing (also -WhatIf)
pwsh scripts/Invoke-TriggerEvals.ps1 -Runs 3 -Out evals/results/trigger-results.json
pwsh scripts/Invoke-TriggerEvals.ps1 -Baseline evals/baseline/2026-10-14.json -Out evals/results/latest.json
pwsh scripts/Invoke-TriggerEvals.ps1 -Skill code-review,diagnose   # subset
```

Install the skills first (`apm install` in the directory you run from) so `claude` sees them. Each prompt goes to `claude -p <prompt> --output-format stream-json --verbose --model sonnet --max-turns 4 --tools Skill,Read,Glob,Grep --disallowedTools Edit Write MultiEdit Bash NotebookEdit Task WebFetch WebSearch` (a read-only allow-list plus a deny list keeps the model from changing the repo); Skill `tool_use` calls in the transcript are the chosen skills (a `plugin:skill` name counts as `skill`). A session without a `result` event or with an error result (auth, rate limit, crash; hitting `--max-turns` is fine) is retried once and then recorded with `failed: true`; failed runs are excluded from all rates and reported, and the scorer exits 2 when more than 10 % of the sessions failed. Exit codes: 0 ok, 1 threshold or baseline regression, 2 crash, bad input or too many failed sessions.

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
  "meta": { "date": "YYYY-MM-DD", "model": "sonnet", "runs": 3, "maxTurns": 4 },
  "notInstalled": ["skill"],
  "sampleSize": { "prompts": 0, "runs": 0, "failed": 0 },
  "failedRuns": 0,
  "warnings": [],
  "thresholdFailures": [],
  "regressions": []
}
```

Records may carry `failed: true`. Rates are percent (0-100). `triggerRate` is the share of positive runs where the expected skill was invoked; `falseTriggerRate` the share of negative runs where it was invoked anyway. A result file is a valid `-Baseline` (the committed baseline is one, in this schema); a file without a usable `summary` is rejected with exit 2. A baseline with another model, run count or `notInstalled` set, or with skills missing from the run, produces a `warnings` entry. Only skills present in both runs are compared, `overall` included.

## Threshold

- Trigger rate on should-trigger prompts >= 80 %.
- False-trigger rate on should-not-trigger prompts <= 10 %.
- Regression: a re-run fails when a trigger rate drops, or a false-trigger rate rises, by more than 5 points (after rounding to one decimal) against the baseline (overall or per skill).

The numbers live in `src/generators/skill-trigger-score.ts`.

## Baseline

[`evals/baseline/2026-10-14.json`](../../evals/baseline/2026-10-14.json) is a full result file (schema above): model `sonnet`, 3 runs, `--max-turns 4`, 40 prompts (120 runs, 0 failed) for the 10 installed skills; `notInstalled` lists the 9 skipped stack skills. Overall trigger rate 80 %, false-trigger rate 0 %. It records the current state, not a pass. Known below the 80 % threshold: `implementation` (0 %), `github-issue` (50 %) and `verify-project` (50 %); the model usually inspects the working directory first and does not consult the skill. A follow-up issue to improve these descriptions is recommended. `evals/results/` is git-ignored.

Measurement notes: skills that are not installed (only `.claude/skills` of the directory you run from and `~/.claude/skills` are checked) are skipped and listed under `notInstalled`, never scored 0 %; a full baseline needs `all@apm-hub` installed. haiku rarely consults skills (about 25 % trigger on five installed skills versus 57 % for sonnet), so sonnet is the default. Prompts must be substantive tasks: one-line prompts are answered directly.

## When to re-run

After changing a skill `description`, adding or removing a model-invocable skill, or changing the 2,600-character description budget. The baseline records the current state, not a pass: the thresholds are the gate, and a re-run is compared against the baseline for regressions. Commit a new result as the baseline after a deliberate change, and record skills below the threshold as known (see Baseline); a follow-up issue for them is recommended. The offline check that the eval set matches the skills on disk runs in `pnpm test`.
