# Project-Specific Copilot Instructions

## General Principles
- This repository is a collection of GitHub Copilot templates (Prompts, Instructions, Agents).
- Always follow the established Markdown standards defined in `docs/concepts/instructions.md` and `templates/instructions/markdown.instructions.md`.
- Maintain the repository structure: `docs/`, `templates/`, `examples/`, `src/`.
- Ensure all templates are reusable and tech-stack agnostic where possible.

## Documentation Standards
- Documentation should be clear, concise, and professional.
- Use internal links between documentation pages to improve navigability.
- When adding new templates, update the `docs/template-list.md` by running the TypeScript generators from the `src/` directory.

## Automation
- TypeScript code in `src/` should follow consistent coding standards and maintain proper type safety.
- Use async/await for asynchronous operations.
- Code should be well-documented with JSDoc comments and handle errors gracefully.
- Ensure all TypeScript files are properly typed and pass type checking.

## Quality Assurance
- Use the review checklists in `docs/checklists/` before finalizing any new templates.
- Ensure that scoped instructions have correct `applyTo` patterns in their YAML front-matter.
