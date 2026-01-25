# Project-Specific Copilot Instructions

## General Principles
- This repository is a collection of GitHub Copilot templates (Prompts, Instructions, Agents).
- Always follow the established Markdown standards defined in `docs/concepts/instructions.md` and `templates/instructions/markdown.instructions.md`.
- Maintain the repository structure: `docs/`, `templates/`, `examples/`, `scripts/`.
- Ensure all templates are reusable and tech-stack agnostic where possible.

## Documentation Standards
- Documentation should be clear, concise, and professional.
- Use internal links between documentation pages to improve navigability.
- When adding new templates, update the `docs/template-list.md` by running the `scripts/generate-template-list.py` script.

## Automation
- Python scripts in `scripts/` should follow PEP 8.
- Scripts should be well-documented and handle errors gracefully.

## Quality Assurance
- Use the review checklists in `docs/checklists/` before finalizing any new templates.
- Ensure that scoped instructions have correct `applyTo` patterns in their YAML front-matter.
