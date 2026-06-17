import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


TARGET_DIRS = {
    "opencode": ".opencode",
    "copilot": ".github",
    "claude": ".claude",
    "cursor": ".cursor",
    "codex": ".codex",
}

TOOLS_ARRAY_RE = re.compile(r'^tools:\s*\[')
TOOLS_BLOCK_RE = re.compile(r'^tools:\s*$')
USER_INVOCABLE_RE = re.compile(r'^user-invocable:\s*(true|false)')
PERMISSION_RE = re.compile(r'^permission:')


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="apm install wrapper — runs apm install then sanitizes agent frontmatter per target."
    )
    parser.add_argument(
        "-t", "--target",
        default="opencode",
        choices=list(TARGET_DIRS.keys()),
        help="Target platform (default: opencode)",
    )
    parser.add_argument(
        "-s", "--source",
        action="store_true",
        help="Also add permission block to source agent files under packages/",
    )
    parser.add_argument(
        "apm_args",
        nargs=argparse.REMAINDER,
        help="Arguments forwarded to apm install",
    )
    return parser.parse_args(argv)


def find_frontmatter(lines: list[str]) -> tuple[int, int] | None:
    if len(lines) < 3 or lines[0].strip() != "---":
        return None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return (0, i)
    return None


def has_array_tools(fm_lines: list[str]) -> bool:
    for line in fm_lines:
        if TOOLS_ARRAY_RE.match(line) or TOOLS_BLOCK_RE.match(line):
            return True
    return False


def strip_copilot_only(fm_lines: list[str]) -> list[str] | None:
    new_lines: list[str] = []
    in_block_list = False
    for line in fm_lines:
        if in_block_list:
            if line.startswith("    -") or line.startswith("  -") or line.strip().startswith("-"):
                continue
            in_block_list = False
        if TOOLS_ARRAY_RE.match(line):
            continue
        if TOOLS_BLOCK_RE.match(line):
            in_block_list = True
            continue
        if USER_INVOCABLE_RE.match(line):
            continue
        new_lines.append(line)
    if len(new_lines) == len(fm_lines):
        return None
    return new_lines


def add_permission_block(fm_lines: list[str]) -> list[str] | None:
    for line in fm_lines:
        if PERMISSION_RE.match(line):
            return None

    tool_names: list[str] = []
    in_block = False
    for line in fm_lines:
        if in_block:
            m = re.match(r'^\s+-\s+(.+)$', line)
            if m:
                tool_names.append(m.group(1).strip())
            else:
                break
        elif TOOLS_ARRAY_RE.match(line):
            m = TOOLS_ARRAY_RE.match(line)
            rest = line[m.end():]
            if rest.endswith("]"):
                rest = rest[:-1]
            tool_names = [t.strip().strip("'\"" ) for t in rest.split(",") if t.strip()]
            break
        elif TOOLS_BLOCK_RE.match(line):
            in_block = True

    if not tool_names:
        return None

    insert_at = None
    for i, line in enumerate(fm_lines):
        if line.strip().startswith("# Copilot/APM fields") or line.strip().startswith("# Copilot"):
            insert_at = i
            break

    perm_block = ["permission:"]
    for name in tool_names:
        perm_block.append(f"  {name}: allow")

    if insert_at is not None:
        return fm_lines[:insert_at] + perm_block + fm_lines[insert_at:]
    else:
        return fm_lines + perm_block


def rewrite_file(path: Path, new_fm_lines: list[str], original_lines: list[str], fm_end: int) -> None:
    body = original_lines[fm_end + 1:]
    result = ["---"] + new_fm_lines + ["---"] + body
    text = "\n".join(result)
    if text and not text.endswith("\n"):
        text += "\n"
    path.write_text(text)


def sanitize_installed(target_dir: Path) -> int:
    agents_dir = target_dir / "agents"
    if not agents_dir.is_dir():
        return 0

    changed = 0
    for f in sorted(agents_dir.glob("*.md")):
        lines = f.read_text().splitlines()
        fm = find_frontmatter(lines)
        if fm is None:
            continue
        _, fm_end = fm
        fm_lines = lines[1:fm_end]

        new_fm = strip_copilot_only(fm_lines)
        if new_fm is None:
            continue

        rewrite_file(f, new_fm, lines, fm_end)
        changed += 1
        name = f.stem
        print(f"  [strip]   {name} — removed Copilot-only fields")

    return changed


def sanitize_source(packages_dir: Path) -> int:
    if not packages_dir.is_dir():
        return 0

    changed = 0
    for f in sorted(packages_dir.glob("*/.apm/agents/*.agent.md")):
        lines = f.read_text().splitlines()
        fm = find_frontmatter(lines)
        if fm is None:
            continue
        _, fm_end = fm
        fm_lines = lines[1:fm_end]

        if not has_array_tools(fm_lines):
            continue

        new_fm = add_permission_block(fm_lines)
        if new_fm is None:
            continue

        rewrite_file(f, new_fm, lines, fm_end)
        changed += 1
        name = f.stem
        tools = [l.split(":")[0].strip() for l in new_fm if l.startswith("  ") and ":" in l and l.strip() != "permission:"]
        print(f"  [convert] {name} — added permission ({', '.join(tools)})")

    return changed


def run_apm_install(args: list[str]) -> int:
    apm_exe = shutil.which("apm")
    if apm_exe is None:
        print("error: 'apm' command not found in PATH", file=sys.stderr)
        return 1

    cmd = [apm_exe, "install"] + args
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd)
    return result.returncode


def main() -> None:
    ns = parse_args(sys.argv[1:])

    apm_args = ns.apm_args
    if apm_args and apm_args[0] == "--":
        apm_args = apm_args[1:]

    rc = run_apm_install(apm_args)
    if rc != 0:
        sys.exit(rc)

    target_subdir = TARGET_DIRS[ns.target]
    target_dir = Path.cwd() / target_subdir
    packages_dir = Path.cwd() / "packages"

    changed_installed = sanitize_installed(target_dir)
    changed_source = 0
    if ns.source:
        changed_source = sanitize_source(packages_dir)

    print(f"\nDone: {changed_installed} installed files sanitized", end="")
    if ns.source:
        print(f", {changed_source} source files updated", end="")
    print()


if __name__ == "__main__":
    main()
