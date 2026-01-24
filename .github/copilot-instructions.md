# GitHub Copilot â€“ Repository Instructions

## General
- Prefer readable, maintainable solutions over clever tricks.
- Write or update unit tests when adding features or fixing bugs.

## Security
- No secrets in code; use environment variables / secret stores.
- Validate all external input.

## Build & Test
- JS/TS: \
pm ci && npm test\
- Python: \pip install -r requirements.txt && pytest -q\
