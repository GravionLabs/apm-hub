<!-- apm-hub:parked-gate -->
**Parked: PBI #{{pbi}} waits for a decision.**

> {{question}}

Options:

{{options}}

Checkout kept: {{checkout}}

Answer with a new comment `/ruling <option or free text>` on this issue (it must be the newest comment after this one and come from a collaborator with push access), or run `orchestrator implement {{pbi}}` interactively. The next loop or `next` run records the ruling, removes the `needs-decision` label and resumes the PBI at the parked phase.
