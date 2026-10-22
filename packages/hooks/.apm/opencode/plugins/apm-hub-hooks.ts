// OpenCode plugin: ports of the apm-hub hooks that OpenCode cannot run as shell hooks.
// State dir (same as state_dir() in subagent-ledger.sh): DROMOS_STATE_DIR (relative: against the project dir), else
// <git common dir>/agents (shared by all worktrees), else none (nothing is written). Below, ".agents" means that dir.
//  - subagent ledger: after a `task` tool call of an orchestrator subagent (allowlist), append
//    `Subagent <name>: stopped — <first line>` to the ledger of the PBI named by a live loop marker of the project's checkout,
//    <state>/current.d/<key> (<key>: first 16 hex of the SHA-256 of the git top level, the lease key of Enter-Checkout.ps1;
//    `<pbi> loop-<nr>[ <origin>]`; the old single <state>/current only while current.d/ does not exist; no marker for the key:
//    the one marker resolved through the live lease of the bound PBI, see markerFile) unless the branch names another issue that is not the PBI, the origin or a
//    `Loop: PBI #<nr> done` PBI, else to .agents/<nr>/progress.md of the issue number in the git branch
//    (<type>/[<scope>/]<nr>[-<slug>]); nothing when that ledger is missing or git fails inside a repository; the newest
//    non-loop ledger only without a number (also detached HEAD), without git or outside a repository, and only while at most one live
//    lease (<state>/leases, heartbeat within 120 min) exists. Same rules and format as subagent-ledger.sh; AGENTS_LEDGER overrides.
//  - context warning: on a new user message, warn once the last request passed CONTEXT_WARN_TOKENS (default
//    150000), again after another CONTEXT_WARN_STEP (default 100000). Same logic as context-warning.sh.
// Never throws: every hook swallows errors. Keep this file self-contained and export ONLY the plugin function:
// OpenCode calls every function export as a plugin and fails to load the file on non-function exports.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const int = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : d;
};

/** True for a regular file that is not a symlink. */
function isRegular(p: string): boolean {
  try {
    const st = lstatSync(p);
    return st.isFile() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

const CONTROL = /[\x00-\x1f\x7f\x85\u2028\u2029]/g;
let partSeq = 0;

const AGENTS = new Set(["issue-reader", "explorer", "planner", "reviewer", "review-lead", "implementer", "pr-writer", "pbi-runner"]);

/** State dir: DROMOS_STATE_DIR (resolved against dir), else <git common dir>/agents, else "" (no write). */
function stateDir(dir: string): string {
  try {
    const o = process.env.DROMOS_STATE_DIR;
    if (o) return resolve(dir, o);
    const common = execFileSync("git", ["-C", dir, "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim();
    return common ? join(common, "agents") : "";
  } catch {
    return "";
  }
}

/** True when dir or a parent holds a .git entry (checked without git). */
function inRepo(dir: string): boolean {
  for (let d = dir; d; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return true;
    if (dirname(d) === d) return false;
  }
  return false;
}

/** Issue number of the current git branch (<type>/[<scope>/]<nr>[-<slug>]), "" (no number, detached HEAD, no git, not a repo), or null when git fails or times out inside a repository (write nothing). */
function branchIssue(dir: string): string | null {
  try {
    const branch = execFileSync("git", ["-C", dir, "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim();
    return /^(?:feat|fix|chore|docs|refactor|test|perf|ci|build|style|revert|hotfix)\/(?:[^/]+\/)*([0-9]+)(?:-[^/]*)?$/i.exec(branch)?.[1] ?? "";
  } catch (e: any) {
    return e?.code === "ENOENT" || !inRepo(dir) ? "" : null;
  }
}

/** True for a regular file whose directory is not a symlink either. */
function isRegularIn(p: string): boolean {
  try {
    return isRegular(p) && !lstatSync(dirname(p)).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Optional ISO-8601 UTC prefix of a ledger line (`2026-10-21T15:19:46Z `); readers accept lines with and without it. */
const TS_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z /;
const untimed = (l: string): string => l.replace(TS_PREFIX, "");
const nowStamp = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const LEASE_TTL_MS = 120 * 60 * 1000; // same TTL as Enter-Checkout.ps1 -LeaseTtlMinutes

/** Lease key of the checkout of dir: first 16 hex of the SHA-256 of its git top level (the dir itself outside a repository). */
function checkoutKey(dir: string): string {
  let top = "";
  try {
    top = execFileSync("git", ["-C", dir, "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim();
  } catch {
    top = "";
  }
  return createHash("sha256").update((top || dir).replace(/[\\/]+$/, ""), "utf8").digest("hex").slice(0, 16);
}

/** Live leases of <state>/leases (heartbeat within the TTL): checkout path and issue. */
function liveLeases(base: string): { path: string; issue: string }[] {
  const out: { path: string; issue: string }[] = [];
  try {
    const dir = join(base, "leases");
    if (lstatSync(dir).isSymbolicLink()) return out;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const file = join(dir, name);
        if (!isRegular(file)) continue;
        const o = JSON.parse(readFileSync(file, "utf8"));
        const beat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(text(o?.heartbeat)) ? Date.parse(o.heartbeat) : NaN;
        if (!(Date.now() - beat < LEASE_TTL_MS) || typeof o.path !== "string" || !/^[0-9]+$/.test(String(o.issue))) continue;
        out.push({ path: o.path, issue: String(o.issue) });
      } catch {
        /* unreadable lease: ignored */
      }
    }
  } catch {
    /* no leases directory */
  }
  return out;
}

const MARKER_RE = /^([1-9][0-9]{0,9}) (loop-[1-9][0-9]{0,9})(?: ([1-9][0-9]{0,9}))?\n?$/;

/** The loop marker of the checkout of dir: <state>/current.d/<key>; the old <state>/current only while current.d/ does not exist.
 * No marker for the key: through the live leases, cwd in a leased checkout (longest path) → the one marker of that lease's issue,
 * cwd in no leased checkout → the one marker whose PBI holds a live lease; several candidates or none: "". */
function markerFile(base: string, dir: string): string {
  const d = join(base, "current.d");
  let st;
  try {
    st = lstatSync(d);
  } catch {
    return join(base, "current"); // no current.d/: legacy marker
  }
  if (!st.isDirectory() || st.isSymbolicLink()) return "";
  const own = join(d, checkoutKey(dir));
  if (isRegular(own)) return own;
  let real = dir;
  try {
    real = realpathSync(dir); // lease paths are real paths
  } catch {
    /* keep dir */
  }
  const leases = liveLeases(base);
  let inside: { path: string; issue: string } | undefined;
  for (const l of leases) if ((real === l.path || real.startsWith(l.path.replace(/[\\/]+$/, "") + sep)) && (!inside || l.path.length > inside.path.length)) inside = l;
  const found: string[] = [];
  for (const name of readdirSync(d)) {
    const file = join(d, name);
    try {
      if (!isRegular(file)) continue;
      const m = MARKER_RE.exec(readFileSync(file, "latin1"));
      if (!m) continue;
      if (inside ? m[1] !== inside.issue : !leases.some((l) => l.issue === m[1])) continue;
      found.push(file);
    } catch {
      /* unreadable marker */
    }
  }
  return found.length === 1 ? found[0] : "";
}

/** Ledger of the PBI named by the loop marker of the checkout of dir (`<pbi> loop-<nr>[ <origin>]`, one line; <origin> is the
 * issue number of the branch -Bind ran on), or "" when the marker is missing, not a regular file, malformed, stale (loop
 * ledger missing or its last `Loop: ` line is `Loop: stopped`), the branch names another issue that is neither <origin>
 * nor recorded as `Loop: PBI #<nr> done`, or its PBI ledger is missing (#375). */
function boundLedger(base: string, branchNr: string, dir: string): string {
  try {
    const marker = markerFile(base, dir);
    if (!marker || !isRegular(marker)) return "";
    const m = MARKER_RE.exec(readFileSync(marker, "latin1"));
    if (!m) return "";
    const loop = join(base, m[2], "progress.md");
    if (!isRegularIn(loop)) return "";
    const lines = readFileSync(loop, "utf8").split(/\r?\n/).map(untimed).filter((l) => l.startsWith("Loop: "));
    if ((lines[lines.length - 1] ?? "").startsWith("Loop: stopped")) return "";
    // a branch naming another issue wins unless -Bind ran on it or the loop finished it (the previous PBI still checked out)
    if (branchNr && branchNr !== m[1] && branchNr !== m[3] && !lines.some((l) => l === `Loop: PBI #${branchNr} done` || l.startsWith(`Loop: PBI #${branchNr} done `))) return "";
    const own = join(base, m[1], "progress.md");
    return isRegularIn(own) ? own : "";
  } catch {
    return "";
  }
}

/** Loop-marker ledger, else branch issue ledger (may not exist), else newest .agents/<issue>/progress.md (loop-<nr> skipped) when the branch has no number; AGENTS_LEDGER overrides. */
function findLedger(dir: string, override?: string): string {
  try {
    if (override) return isRegular(override) ? override : "";
    const base = stateDir(dir);
    if (!base) return ""; // no override and no repository: nothing to write
    if (lstatSync(base).isSymbolicLink()) return ""; // never write through a symlinked state dir
    const nr = branchIssue(dir);
    if (nr === null) return ""; // git failing inside a repository: no write, not even through the loop marker
    const bound = boundLedger(base, nr, dir);
    if (bound) return bound;
    if (nr) {
      const own = join(base, nr, "progress.md");
      return isRegular(own) && !lstatSync(join(base, nr)).isSymbolicLink() ? own : "";
    }
    // more than one live lease: the newest ledger may belong to another run, write nothing (#466)
    if (liveLeases(base).length > 1) return "";
    let best = "";
    let bestTime = -1;
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || e.isSymbolicLink() || /^loop-[1-9]\d*$/.test(e.name)) continue;
      const p = join(base, e.name, "progress.md");
      if (!isRegular(p)) continue;
      const t = lstatSync(p).mtimeMs;
      if (t > bestTime) {
        best = p;
        bestTime = t;
      }
    }
    return best;
  } catch {
    return "";
  }
}

/** First non-empty line of the subagent result, max 120 chars (`<task_result>` wrapper stripped). */
function summaryOf(output: string): string {
  const m = /<task_result>([\s\S]*?)(?:<\/task_result>|$)/.exec(output);
  const body = m ? m[1] : output;
  const line = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0 && !l.startsWith("<task") && (m !== null || !/^task_id:/i.test(l))) ?? "";
  return line.replace(CONTROL, " ").slice(0, 120);
}

/** Ledger line for a finished `task` call, or "" when the call is not a ledger-worthy subagent stop. */
function ledgerLine(input: any, output: any): string {
  if (input?.tool !== "task") return "";
  const agent = text(input?.args?.subagent_type).replace(/[^A-Za-z0-9:_./-]/g, "").slice(0, 64);
  // a namespaced name counts by its last part (plugin namespaces are not known up front; see subagent-ledger.sh)
  if (!AGENTS.has(agent.toLowerCase().split(/[:/.]/).pop() ?? "")) return "";
  const summary = summaryOf(text(output?.output));
  return summary ? `Subagent ${agent}: stopped — ${summary}` : `Subagent ${agent}: stopped`;
}

/** Appends the line unless the ledger is missing or already ends with it. Returns whether it wrote. */
function appendLedger(dir: string, line: string, env: Record<string, string | undefined>): boolean {
  try {
    if (!line) return false;
    const ledger = findLedger(dir, env.AGENTS_LEDGER);
    if (!ledger || !isRegular(ledger)) return false;
    const last = untimed(readFileSync(ledger, "utf8").trimEnd().split("\n").pop() ?? "");
    if (last === line) return false;
    appendFileSync(ledger, `${nowStamp()} ${line}\n`);
    return true;
  } catch {
    return false;
  }
}

/** Context size of an assistant message: input + cache read + cache write. -1 when unreadable. */
function contextTokens(info: any): number {
  const t = info?.tokens;
  if (info?.role !== "assistant" || !t) return -1;
  const n = (Number(t.input) || 0) + (Number(t.cache?.read) || 0) + (Number(t.cache?.write) || 0);
  return n > 0 ? n : -1;
}

/** Warning text when ctx crossed the threshold (or grew by step since the last warning), else "". */
function warningFor(ctx: number, lastWarned: number, threshold: number, step: number): string {
  if (ctx < threshold) return "";
  if (lastWarned > 0 && ctx < lastWarned + step) return "";
  return `Context is ${Math.round(ctx / 1000)}k tokens (limit ${Math.round(threshold / 1000)}k). Finish the current step, append the hand-off to <state dir>/<issue>/progress.md, then start a new session and resume.`;
}

export const ApmHubHooks = async (ctx: any) => {
  const dir: string = text(ctx?.directory) || process.cwd();
  const threshold = int(process.env.CONTEXT_WARN_TOKENS, 150000);
  const step = int(process.env.CONTEXT_WARN_STEP, 100000);
  const context = new Map<string, number>(); // sessionID -> context tokens of the last assistant message
  const warned = new Map<string, number>(); // sessionID -> context size at the last warning

  return {
    event: async (arg: any) => {
      try {
        const event = arg?.event;
        if (event?.type !== "message.updated") return;
        const n = contextTokens(event.properties?.info);
        const sid = text(event.properties?.info?.sessionID ?? event.properties?.sessionID);
        if (n > 0 && sid) context.set(sid, n);
      } catch {
        /* never throw */
      }
    },
    "tool.execute.after": async (input: any, output: any) => {
      try {
        appendLedger(dir, ledgerLine(input, output), process.env);
      } catch {
        /* never throw */
      }
    },
    "chat.message": async (input: any, output: any) => {
      try {
        const sid = text(input?.sessionID);
        const n = context.get(sid) ?? -1;
        if (n < 0 || !Array.isArray(output?.parts)) return;
        if (n < threshold) {
          warned.delete(sid);
          return;
        }
        const msg = warningFor(n, warned.get(sid) ?? 0, threshold, step);
        if (!msg) return;
        warned.set(sid, n);
        output.parts.push({
          id: `prt_apmhub_ctx_${Date.now()}_${++partSeq}`,
          sessionID: sid,
          messageID: text(input?.messageID) || text(output?.message?.id),
          type: "text",
          text: msg,
          synthetic: true,
        });
      } catch {
        /* never throw */
      }
    },
  };
};
