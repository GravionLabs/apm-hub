# Mechanical vs full classification

`pwsh -NoProfile -File scripts/Classify-Diff.ps1 [-Range "<base>..<head>"] [-Force full] [-MaxLines 20] [-SmallLines 150]` prints `{"mode","dimensions","reason","size","signals","skippedDimensions"}` (`mode` is `mechanical`, `docs`, `text` or `full`) and exits 0. No `-Range`: working tree vs `HEAD`. Use `dimensions` as the fan-out list. Script fails, prints nothing or invalid JSON: `full`. The script is authoritative: its regexes are the complete lists; the names below are what they cover.

**Ref safety**: run it only when both refs match `^[A-Za-z0-9._/@~^-]+$` and do not start with `-`; else `full` without running it. The script also rejects a range starting with `-`, containing whitespace, or with a side `git rev-parse --verify` rejects, and returns `full` outside a git work tree or when any git call fails. Git runs with `--literal-pathspecs` and `--` before pathspecs. Working-tree mode: any untracked file is `full` (`git diff` cannot see it). A PR number without a local range is always `full`.

## Location classes

Every path (rename source and destination) gets one class, first match wins:

1. **exec** (run by tools, hooks or CI): `.github/`, `.husky/`, `.claude/`, `.opencode/`, `.cursor/`, `.vscode/`, `.devcontainer/`, `.circleci/`, `.gitlab/`, `.githooks/`, any `hooks/` or `hook/` directory, `.mcp.json`, `.npmrc`, `.yarnrc*`, `.pre-commit-config.yaml`, `.envrc`, `.env*`, `.gitattributes`, `.gitmodules`, `.gitignore`, CI files (`.gitlab-ci.yml`, `.travis.yml`, `azure-pipelines.yml`, `Jenkinsfile`), `Makefile`, `Dockerfile*`, `Containerfile`, `docker-compose*`, `compose.yml`, `Procfile`, `Justfile`, `Taskfile.yml`, `*.pth`, `sitecustomize.py`, `usercustomize.py`.
2. **build** (build, dependency and test config, entry points): `package.json`, lockfiles, `pnpm-workspace.yaml`, `tsconfig*.json`, `*.config.{js,ts,mjs,cjs,...}`, any `.*rc*` dotfile (`.eslintrc.js`, `.prettierrc`), `babel.config*`, `*setup*.{js,ts,...}`, `pyproject.toml`, `setup.py`, `setup.cfg`, `conftest.py`, `requirements*.txt`, `Pipfile`, `tox.ini`, `noxfile.py`, `pytest.ini`, `manage.py`, `__init__.py`, `__main__.py`, `Cargo.toml`, `build.rs`, `lib.rs`, `mod.rs`, `go.mod`, `Gemfile`, `Rakefile`, `*.gemspec`, `pom.xml`, Gradle files, `CMakeLists.txt`, `*.csproj`/`*.sln`/`*.props`/`*.targets`, `global.json`, `NuGet.config`, `Program.cs`, `Startup.cs`, `index.*`/`main.*` code files, anything under `bin/`.
3. **instruction** (steers agents): `SKILL.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `COPILOT.md`, `copilot-instructions.md`, `*.agent.md`, `*.prompt.md`, `*.instructions.md`, `*.chatmode.md`, anything under `.apm/`, `skills/` or `agents/`.
4. **manifest**: `apm.yml`, `marketplace.json`, `plugin.json`.
5. **docs**: `README*`/`CHANGELOG*`/`CONTRIBUTING*` (`.md`, `.mdx`, `.txt`), `docs/**/*.md|mdx`, any other `*.md` that is not instruction text (classes 1 to 3 win).
6. **test**: `tests/`, `test/`, `__tests__/`, `*.test.*`, `*.spec.*`, `test_*`, `*_test.*`.
7. **source**: code extensions (`.ts`, `.js`, `.py`, `.ps1`, `.sh`, `.cs`, `.go`, `.rs`, ...). 8. **other**: the rest.

## Mechanical

Based on one `git diff --ignore-submodules=none -M --raw --numstat` (a submodule pointer hidden by `ignore = all` still shows). Mechanical only when every file is one of:

- a **pure rename** (`R100`) with unchanged mode whose source and destination have the **same class**, that class is not exec or build, and an instruction, source, other or test file keeps its file name (a directory move; only docs and manifests may change the name). `a.json` → `composer.json` or `lib.js` → `gulpfile.js` is full, `src/lib.js` → `lib/lib.js` is mechanical. A package-directory move (`packages/a/.apm/skills/**` → `packages/b/.apm/skills/**`, SKILL.md and scripts included) stays in one class: mechanical. A rename that changes class (source → `package.json`, a config, an entry point, a hook, `.github/`, an instruction file; or out of one) is full;
- a **docs** or **manifest** file, modified, added, deleted or renamed with edits within its class (an added file must be mode 100644);
- a **test** file, modified or renamed with edits within its class and keeping its file name, passing the test-file rule. Added or deleted test files are full.

The changed lines (added + deleted) of all non-pure-rename files together total at most **20** (`-MaxLines`). Any content change in exec, build, instruction, source or other files is full (SKILL.md, scripts, agent and prompt edits included), as are mode changes, symlinks, submodules, type changes, binaries and any path git C-quotes (tab, newline, `"` or `\` in the name).

A package rename that also edits skill, agent or prompt text (instruction files) is `full` by design: only the pure move is mechanical. The orchestrator passes the user's request for a `full` review as `-Force full`.

Always-full rename destinations, tested from `src/evil.js` (exec, build and instruction examples):

```text
.github/workflows/ci.yml
.github/x.yml
.husky/pre-commit
.claude/settings.json
.opencode/plugins/p.ts
.vscode/tasks.json
.devcontainer/devcontainer.json
hooks/run.sh
.mcp.json
.npmrc
.pre-commit-config.yaml
.envrc
.env
.gitattributes
.gitlab-ci.yml
Jenkinsfile
Makefile
Dockerfile
docker-compose.yml
evil.pth
sitecustomize.py
package.json
pnpm-lock.yaml
tsconfig.json
jest.config.js
vitest.config.ts
eslint.config.mjs
.eslintrc.js
.prettierrc
babel.config.js
vitest.setup.ts
src/index.js
src/main.py
bin/cli.js
pyproject.toml
setup.py
setup.cfg
conftest.py
requirements.txt
pkg/__init__.py
tox.ini
Cargo.toml
build.rs
go.mod
Gemfile
pom.xml
build.gradle
CMakeLists.txt
App.csproj
Directory.Build.props
Program.cs
AGENTS.md
CLAUDE.md
x.agent.md
x.prompt.md
packages/x/.apm/skills/foo/scripts/run.ps1
```

**Test-file rule** (`git diff -U100000`): removed and added lines pair one to one and differ only by identifier tokens; each old token maps to one new token (injective). Every old name must be **declared** as a local binding in the removed lines: `const`/`let`/`var`/`function`/`class`/`def`/`type`/`interface`/`enum`, default, namespace or aliased import, array destructuring, function/arrow/lambda parameter, `catch`, `for ... in`, `with`/`except ... as`. Named imports and object destructuring change what is read: full. Never renamed: tokens after `.` or `?.` (members, methods, matchers), object keys and shorthand properties, keyword arguments and default parameters, keywords, builtins and globals (`NaN`, `Infinity`, `undefined`, `Math`, `JSON`, `Object`, `Array`, `process`, `globalThis`, `require`, `this`, `self`, ...), matcher names (`to*`, `assert*`, ...). A new token must not appear in the removed or unchanged lines (no merges, no `toBe(expected)` → `toBe(x)` tautology); an old token must not remain. Numbers, operators, string literals and comments must not change; block comments, JSDoc and multi-line strings are full; pure deletions and additions are full. Cannot prove it: full.

## Docs mode

A diff whose content changes (modified, added, deleted, or renamed with edits) are all in **docs** files, such as a `CONTRIBUTING.md`-only change, gets mode `docs` with dimensions `conventions` and `spec`. Pure renames next to them do not matter. The `-MaxLines` threshold applies, so does the security scan below. The diff stays `mechanical` (with `security`) when an added line matches a command or remote pattern, a path is security-sensitive, or a manifest changes; any other file kind (script, build file) is not docs: see its own rule, Text mode or `full`.

## Text mode

Two content classes, checked on the changed paths after the location class (renames keep the rules above). Mode `text`; the dimensions of all classes in the diff are united (order `correctness`, `security`, `conventions`, `tests`, `spec`). No line threshold.

- **skilltext** (`correctness`, `conventions`, `spec`): `SKILL.md`, `AGENTS.md`, `CLAUDE.md`, `*.agent.md`, `*.prompt.md`, `.md` files under `references/`, `templates/` and `assets/`. Added, deleted, modified or renamed with edits (same file name). Frontmatter: only `name`, `description` and `license` may change; any other changed key (`tools`, `permission`, `metadata`, `user-invocable`, ...) or delimiter is `full`.
- **tests** (`correctness`, `tests`, `spec`): `*.test.ts` and everything under `test/`: added, deleted, modified or renamed with edits (same file name). A pure identifier rename stays `mechanical`; any other edit is `tests` instead of `full`.

Security triggers stay authoritative and make the whole diff `full` (reason `security trigger in added lines`): an added line in a skilltext file matching the command patterns of the Dimensions section, or `rm`/`del`/`rmdir`/`Remove-Item` commands, `git push --force`/`-f`/`--force-with-lease`, `git reset --hard`, `git clean -f`, `git branch -D`, a credential assignment (`password`, `secret`, `token`, `api_key`, `credentials`, `private_key`, `bearer`, `authorization` followed by `:` or `=`), a private key header or a token prefix (`ghp_`, `github_pat`, `sk-`, `AKIA`). Test files use the command patterns except the `import`/`export` line rule. A security-sensitive path (Dimensions) or a manifest next to skilltext or tests is `full` too. Scripts (`scripts/*.ps1`, hooks, `*.sh`, `*.mjs`, `*.ts` outside `test/`, `.github/`) and build files are `full` as before, also next to text. `-Force full` still forces `full`.

## Dimensions

Mechanical runs `correctness` and `spec`. `security` is added when:

- any touched path (source and destination) matches auth, crypt, password, secret, token, oauth, login, http, network, socket, sql, query, database, jwt, session, cookie, permission, rbac, acl, cert, tls, ssl, cors, csrf, hash, apikey, `.github/workflows`, hook, Dockerfile, `.env`, migration or `public/`;
- any manifest (`apm.yml`, `marketplace.json`, `plugin.json`) changed: it stays mechanical (cheap renames) but dependency or source edits get a security look;
- any added line in a docs, manifest or test file (renamed with edits included) contains a command, install or remote pattern: `curl`, `wget`, `eval`, `iex`, `iwr`/`irm`, `Invoke-Expression`, `Invoke-WebRequest`, `Invoke-RestMethod`, `chmod`, `sudo`, `ssh`/`scp`/`rsync`, `nc`/`ncat`/`socat`, `npx`/`pnpx`/`bunx`/`uvx`, `npm`/`pnpm`/`yarn`/`bun` `install`/`add`/`dlx`/`exec`, `pip`/`pipx`/`gem`/`cargo`/`uv pip` `install`, `go install`/`go get`, `-enc`/`-EncodedCommand`, `pwsh -e`, `python -c`, `node`/`perl`/`ruby -e`, `bash -c`, `bash <(`, `rm -rf`, `base64`, `certutil`, any `scheme://` URL (`https://`, `ftp://`, `ssh://`), `git@host:`, `git clone`, a pipe into `sh`/`bash`/`zsh`/`pwsh`/`powershell`/`python`/`node`/`iex`, or looks like executable code (`.mdx` pages): `<script`, a line starting with `import` or `export`, `require(`, `child_process`, `process.env`, `fs.write`/`fs.unlink`/`fs.rm`. Docs stay mechanical.

## Full

Everything else: other content change, binary, more lines than the threshold, empty diff, git or parse error, script error, unsupported change type. Unsure means full. `-Force full` skips classification and always returns all five dimensions (`size: large`), also on a small diff.

### Size class and signals

Every result carries `size` (`small|large`), `signals` (subset of `risky`, `sensitive`, `source`, in that order) and `skippedDimensions` (`[{dimension, reason}]`, empty unless a small `full` diff dropped some). The script is authoritative.

- **size**: added + deleted lines over all changed paths except those of the package filter (`references/package-filter.md`: lockfiles, snapshots, goldens, minified, `dist/`, `coverage/`, `docs/*-list.md`; those lines are not counted, not scanned and their location class is ignored, except under an `exec` path such as `.github/actions/x/dist/`, which is never filtered). `small` when at most **150** lines (`-SmallLines`) and no counted path (source or destination) is class `exec` or `build`; else `large`. Whatever cannot be measured (git error, parse error, empty or invalid range, binary, symlink, submodule, mode change, quoted path, `-Force full`) is `large` with `signals: []`.
- **signals**: `risky` = an added line matches the command patterns of the Dimensions section (skill text, instruction files and source files also the destructive/credential patterns, test files without the `import`/`export` rule); `sensitive` = a path matches the path triggers; `source` = a path of class source, or an instruction file with a source extension (`.ps1`, `.ts`, ...). Computed for every diff that reaches classification.
- **selection** for `full` + `small`; `full` + `large` and the modes `mechanical`, `docs` and `text` keep their dimensions and skip nothing:

| Dimension | `full` + `small` runs it when |
|:--|:--|
| `correctness`, `tests`, `spec` | always |
| `security` | `risky` or `sensitive` |
| `conventions` | `source` |

Skipped dimensions get the reason `size small: <n> <= <limit> lines, no risky/sensitive trigger` (security) or `... no source file` (conventions). A caller-supplied dimension list still replaces the selection.

Known limits: a basename-preserving move into a convention-loaded place is still mechanical: file-based routes, plugin folders, or a tool file not in the lists moved to where the tool reads it (`config/vercel.json` → `vercel.json`); the `correctness` reviewer sees it.
