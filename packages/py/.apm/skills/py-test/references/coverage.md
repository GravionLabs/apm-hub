# Coverage with pytest-cov

## Stack
- **uv run pytest** — run tests inside uv-managed environment
- **pytest-cov** — coverage plugin (`uv add --dev pytest-cov` to install)
- **coverage** — coverage reporting CLI (`coverage report`, `coverage html`)

## Commands

### Generate coverage report
```powershell
uv run --frozen pytest --cov=<source-dir> --cov-report=term-missing
```

### HTML report for browser review
```powershell
uv run --frozen pytest --cov=<source-dir> --cov-report=term-missing --cov-report=html
```

### Verify with threshold
```powershell
uv run --frozen pytest --cov=<source-dir> --cov-report=term-missing --cov-fail-under=<target>
```

## Conventions
- Test file: `test_<module>.py` mirroring source structure
- Test function: `test_<function>_<scenario>`
- Use fixtures for shared setup — avoid copy-paste between tests
- Keep each test focused on one scenario

## Gotchas
- `pytest-cov` must be a dev dependency (`uv add --dev pytest-cov` if missing)
- Choose `--cov-fail-under` based on project's target — default to 80 if unspecified
- `--cov-report=html` writes to `htmlcov/` and is optional; omit if only gap analysis needed
- **Repeated runs:** Use `--frozen` to skip lockfile check (faster); use `--no-sync` to also skip venv sync entirely when environment already up-to-date
- **CI:** Prefer `--locked` instead of `--frozen` — it asserts lockfile unchanged and fails fast if drifted
