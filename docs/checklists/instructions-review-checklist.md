# Instruction Review Checklist


Use this checklist to review **GitHub Copilot Custom Instructions** before merging.  
It applies to repository‑wide instructions (`.github/copilot-instructions.md`) and path‑specific files (`.github/instructions/*.instructions.md`).

> Mental model: **Instructions = persistent rules** that guide Copilot’s behavior across the repo or a scoped subset.  
> They should be **stable, concise, safe, and broadly useful**.

---

## 1) Purpose & Scope ✅ (Must‑Have)

- [ ] **Purpose is explicit** in the first section (what these instructions are meant to achieve).
- [ ] **Audience is clear** (repository‑wide vs. team/language/area specific).
- [ ] **Scope is appropriate** for an instructions file (general rules), not task‑specific logic (→ use prompts for that).
- [ ] The file **does not duplicate** project documentation verbatim; it references docs instead where possible.

---

## 2) File Location & Naming ✅ (Must‑Have)

- [ ] **Repo‑wide** file is at: `.github/copilot-instructions.md`.
- [ ] **Scoped** instructions live under: `.github/instructions/…`.
- [ ] Scoped files are named meaningfully, in lowercase kebab‑case, e.g.:
  - `frontend.instructions.md`
  - `backend.instructions.md`
  - `security.instructions.md`

---

## 3) YAML Frontmatter & Targeting ✅ (Must‑Have for scoped files)

- [ ] Scoped files use `applyTo:` glob(s) to target relevant files/folders, e.g.:
  ```yaml
  ---
  applyTo: "**/*.ts,**/*.tsx"
  ---
  ```

---

## Learning More

- [What are Instructions?](../concepts/instructions.md)
- [How to Use Instructions](../usage/how-to-use-instructions.md)
- [Writing Good Instructions](../best-practices/writing-good-instructions.md)
