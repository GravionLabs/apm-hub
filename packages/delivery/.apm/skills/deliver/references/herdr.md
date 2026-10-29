# herdr progress display

Only when `printenv HERDR_ENV` prints `1` (the session runs in a herdr pane). Without herdr nothing here runs.

## Start

`printenv HERDR_PANE_ID` once and keep the pane id. Every later call carries the id as a literal: Claude Code denies any command with `$HERDR_PANE_ID` in it, quoted or not (checked headless with `--permission-mode default`, 2026-10-29).

## Per step

After the progress line of a step, show its short form:

```powershell
herdr pane report-metadata <pane> --source deliver --display-agent "#12 review ✗1"
```

The text replaces the agent name in the herdr Agent sidebar, so keep it short: `#<nr> <step>`, then `✗<n>` for blocking findings or `fix <n>/2` for a fix round, nothing else (no `deliver` prefix, no transient states such as `opening`). herdr 0.9.5 stores `--title` but renders it nowhere, so `--display-agent` is used instead.

## End

After the report:

```powershell
herdr pane report-metadata <pane> --source deliver --clear-display-agent
```

The allowlist entries (`printenv HERDR_ENV`, `printenv HERDR_PANE_ID`, `herdr pane report-metadata`) are in `references/permissions.md`.
