import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/hooks/.apm/hooks/context-warning.sh');
const BASH = spawnSync('sh', ['-c', 'command -v bash'], { encoding: 'utf8' }).stdout.trim();

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

  const runRaw = (payload: string, env: Record<string, string> = {}) => {
    const r = spawnSync(BASH, [SCRIPT], {
      input: payload,
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: dir, ...env },
    });
    return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
  };

  const run = (transcript: string, env: Record<string, string> = {}) =>
    runRaw(JSON.stringify({ transcript_path: transcript, session_id: session }), env);

  // PATH with the tools the hook needs but without jq: forces the bash scanner
  const noJqEnv = () => {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    for (const tool of ['cat', 'grep', 'tail', 'head', 'rm', 'tr', 'sed', 'dirname']) {
      const found = spawnSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).stdout.trim();
      if (found && !fs.existsSync(path.join(bin, tool))) fs.symlinkSync(found, path.join(bin, tool));
    }
    return { PATH: bin };
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
    expect(run(t)).toEqual({ code: 0, out: '', err: '' });
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
    expect(run(path.join(dir, 'missing.jsonl'))).toEqual({ code: 0, out: '', err: '' });
    expect(run(writeTranscript('not json at all'))).toEqual({ code: 0, out: '', err: '' });
    expect(run(writeTranscript('{"message":{"role":"user"}}'))).toEqual({ code: 0, out: '', err: '' });
    const r = spawnSync('bash', [SCRIPT], { input: 'garbage', encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  describe.each([
    ['jq', () => ({}) as Record<string, string>],
    ['bash scanner (no jq)', () => noJqEnv()],
  ])('payload parsing with %s', (_name, envFor) => {
    const pretty = (t: string) =>
      JSON.stringify({ session_id: session, transcript_path: t, hook_event_name: 'UserPromptSubmit' }, null, 2);

    it('handles a pretty-printed multi-line payload with reordered fields', () => {
      const t = writeTranscript(usageLine(1, 200000, 0));
      expect(runRaw(pretty(t), envFor()).out).toContain('200k');
    });

    it('handles spaces around colons', () => {
      const t = writeTranscript(usageLine(1, 200000, 0));
      const payload = `{ "session_id" : "${session}" ,\n "transcript_path"\t:\t "${t}" }`;
      expect(runRaw(payload, envFor()).out).toContain('200k');
    });

    it('handles escaped quotes and backslashes in the path', () => {
      const sub = path.join(dir, 'we"ird \\dir');
      fs.mkdirSync(sub);
      const file = path.join(sub, 't.jsonl');
      fs.writeFileSync(file, usageLine(1, 200000, 0) + '\n');
      const payload = JSON.stringify({ transcript_path: file, session_id: session }, null, 2);
      expect(payload).toContain('\\"');
      expect(runRaw(payload, envFor()).out).toContain('200k');
    });

    it('handles escaped slashes and unicode escapes in the path', () => {
      const t = writeTranscript(usageLine(1, 200000, 0));
      const payload = `{"transcript_path":"${t.replace(/\//g, '\\/')}","session_id":"${session}"}`;
      expect(runRaw(payload, envFor()).out).toContain('200k');
    });

    it('reads usage counts with spaces after colons', () => {
      const t = writeTranscript(
        '{"message": {"usage": {"input_tokens": 1, "cache_read_input_tokens": 200000, "cache_creation_input_tokens": 0}}}',
      );
      expect(runRaw(pretty(t), envFor()).out).toContain('200k');
    });

    it('is silent on failure without the debug variable, and notes it with it', () => {
      const missing = path.join(dir, 'missing.jsonl');
      expect(runRaw(pretty(missing), envFor())).toEqual({ code: 0, out: '', err: '' });
      const dbg = runRaw(pretty(missing), { ...envFor(), CONTEXT_WARN_DEBUG: '1' });
      expect(dbg.code).toBe(0);
      expect(dbg.out).toBe('');
      expect(dbg.err).toMatch(/^context-warning: transcript not readable/);
      const bad = runRaw('garbage', { ...envFor(), CONTEXT_WARN_DEBUG: '1' });
      expect(bad.code).toBe(0);
      expect(bad.err).toBe('context-warning: no transcript_path in payload');
      const t = writeTranscript('{"message":{"role":"user"}}');
      expect(runRaw(pretty(t), { ...envFor(), CONTEXT_WARN_DEBUG: '1' }).err).toBe(
        'context-warning: no usage line in transcript',
      );
    });
  });
});
