---
name: create-python-workflow
description: 'Create a GitHub Actions CI/CD workflow for a Python package using GravionLabs/ci reusable workflows (lint, test, build, publish).'
allowed-tools: editFiles codebase
model: gpt-4.1
---

Create a `.github/workflows/` file for Python package CI/CD using `GravionLabs/ci`.

## What this skill does
Scaffolds a GitHub Actions workflow that calls the `GravionLabs/ci` reusable Python workflow to lint, test, build, and optionally publish the package.

## Steps
1. Ask if not provided: Python version(s), test framework (pytest default), publishing target (PyPI / GitHub Packages / none)
2. Create `.github/workflows/ci.yml`:
   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:

   jobs:
     build:
       uses: GravionLabs/ci/.github/workflows/python.yml@main
       with:
         python-version: '3.12'
       secrets: inherit
   ```
3. If publishing to PyPI, confirm `PYPI_API_TOKEN` secret is configured in repository settings
4. Ensure `pyproject.toml` or `setup.py` is present with correct package metadata

## Constraints
- Use `secrets: inherit` to pass secrets to the reusable workflow
- Matrix testing across multiple Python versions: pass `python-version` as a JSON array if supported by the reusable workflow
- Do not duplicate lint/test steps already handled by the reusable workflow
