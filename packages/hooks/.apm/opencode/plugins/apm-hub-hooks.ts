// OpenCode plugin: ports of the apm-hub hooks that OpenCode cannot run as shell hooks.
//  - subagent ledger: after a `task` tool call, append `Subagent <name>: stopped — <first line>` to the newest
//    .agents/*/progress.md (same format as subagent-ledger.sh; skips the orchestrator; no-op without a ledger).
//  - context warning: on a new user message, warn once the last request passed CONTEXT_WARN_TOKENS (default
//    150000), again after another CONTEXT_WARN_STEP (default 100000). Same logic as context-warning.sh.
// Never throws: every hook swallows errors. Keep this file self-contained and export ONLY the plugin function:
// OpenCode calls every function export as a plugin and fails to load the file on non-function exports.
import { appendFileSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

/** Newest .agents/<issue>/progress.md under dir (loop-<nr> ledgers skipped), or "" (AGENTS_LEDGER overrides). */
function findLedger(dir: string, override?: string): string {
  try {
    if (override) return isRegular(override) ? override : "";
    const root = join(dir, ".agents");
    let best = "";
    let bestTime = -1;
    for (const e of readdirSync(root, { withFileTypes: true })) {
      if (!e.isDirectory() || e.isSymbolicLink() || /^loop-[1-9]\d*$/.test(e.name)) continue;
      const p = join(root, e.name, "progress.md");
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
  const agent = text(input?.args?.subagent_type).replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, 64) || "subagent";
  if (/^(.*[:/.])?orchestrator$/i.test(agent)) return "";
  const summary = summaryOf(text(output?.output));
  return summary ? `Subagent ${agent}: stopped — ${summary}` : `Subagent ${agent}: stopped`;
}

/** Appends the line unless the ledger is missing or already ends with it. Returns whether it wrote. */
function appendLedger(dir: string, line: string, env: Record<string, string | undefined>): boolean {
  try {
    if (!line) return false;
    const ledger = findLedger(dir, env.AGENTS_LEDGER);
    if (!ledger || !isRegular(ledger)) return false;
    const last = readFileSync(ledger, "utf8").trimEnd().split("\n").pop();
    if (last === line) return false;
    appendFileSync(ledger, line + "\n");
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
  return `Context is ${Math.round(ctx / 1000)}k tokens (limit ${Math.round(threshold / 1000)}k). Finish the current step, append the hand-off to .agents/<issue>/progress.md, then start a new session and resume.`;
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
