import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/claude-hooks/.apm/hooks/context-warning.sh');

describe('context-warning hook', () => {
  let dir: string;
  let session: string;

  const usageLine = (input: number, read: number, write: number) =>
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        usage: {
          input_tokens: input,
          cache_creation_input_tokens: write,
          cache_read_input_tokens: read,
          output_tokens: 10,
        },
      },
    });

  const writeTranscript = (...lines: string[]) => {
    const file = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(file, lines.join('\n') + '\n');
    return file;
  };

  const run = (transcript: string, env: Record<string, string> = {}) => {
    const payload = JSON.stringify({ transcript_path: transcript, session_id: session });
    const r = spawnSync('bash', [SCRIPT], {
      input: payload,
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: dir, ...env },
    });
    return { code: r.status, out: r.stdout.trim() };
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-warn-'));
    session = `s-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stays silent below the threshold', () => {
    const t = writeTranscript(usageLine(5, 90000, 4000));
    expect(run(t)).toEqual({ code: 0, out: '' });
  });

  it('warns at the threshold with the size in k tokens', () => {
    const t = writeTranscript(usageLine(10, 140000, 9990));
    const { code, out } = run(t);
    expect(code).toBe(0);
    const json = JSON.parse(out);
    expect(json.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(json.hookSpecificOutput.additionalContext).toContain('Context is 150k tokens (limit 150k)');
    expect(json.hookSpecificOutput.additionalContext).toContain('/clear');
  });

  it('uses the last request of the transcript', () => {
    const t = writeTranscript(usageLine(1, 400000, 1000), usageLine(1, 20000, 500));
    expect(run(t).out).toBe('');
  });

  it('warns again only after another step of growth', () => {
    const t1 = writeTranscript(usageLine(1, 312000, 0));
    expect(run(t1).out).toContain('312k');
    const t2 = writeTranscript(usageLine(1, 320000, 0));
    expect(run(t2).out).toBe('');
    const t3 = writeTranscript(usageLine(1, 420000, 0));
    expect(run(t3).out).toContain('420k');
  });

  it('resets after the context shrinks below the threshold', () => {
    expect(run(writeTranscript(usageLine(1, 200000, 0))).out).toContain('200k');
    expect(run(writeTranscript(usageLine(1, 30000, 0))).out).toBe('');
    expect(run(writeTranscript(usageLine(1, 200000, 0))).out).toContain('200k');
  });

  it('honors CONTEXT_WARN_TOKENS and CONTEXT_WARN_STEP', () => {
    const t = writeTranscript(usageLine(1, 60000, 0));
    expect(run(t, { CONTEXT_WARN_TOKENS: '50000' }).out).toContain('limit 50k');
    expect(run(t, { CONTEXT_WARN_TOKENS: '50000', CONTEXT_WARN_STEP: '5000' }).out).toBe('');
  });

  it('never blocks on bad input', () => {
    expect(run(path.join(dir, 'missing.jsonl'))).toEqual({ code: 0, out: '' });
    expect(run(writeTranscript('not json at all'))).toEqual({ code: 0, out: '' });
    expect(run(writeTranscript('{"message":{"role":"user"}}'))).toEqual({ code: 0, out: '' });
    const r = spawnSync('bash', [SCRIPT], { input: 'garbage', encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});
