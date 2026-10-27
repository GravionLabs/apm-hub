import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const fanout = fs.readFileSync(
  path.join(root, 'packages/delivery/.apm/skills/review-fanout/SKILL.md'),
  'utf-8'
);
const filterRef = fs.readFileSync(
  path.join(root, 'packages/delivery/.apm/skills/review-fanout/references/package-filter.md'),
  'utf-8'
);
const correctness = fs.readFileSync(
  path.join(
    root,
    'packages/delivery/.apm/skills/review-fanout/references/correctness-dimension.md'
  ),
  'utf-8'
);
const pipeline = fs.readFileSync(
  path.join(root, 'packages/github/.apm/skills/github-issue/references/pbi-pipeline.md'),
  'utf-8'
);

// The exclude list lives in the reference; parse it so docs and tests cannot drift.
const EXCLUDED = (/Excluded patterns[^\n]*\n\n```text\n([\s\S]*?)\n```/.exec(filterRef)?.[1] ?? '')
  .split('\n')
  .filter(Boolean);

describe('review-fanout: no active waiting (#451)', () => {
  it('SKILL.md dispatches in one message and forbids sleep and polling', () => {
    expect(fanout).toMatch(/No active waiting/);
    expect(fanout).toMatch(/ONE message, then wait for their replies/);
    expect(fanout).toMatch(/Never run `sleep` or `Start-Sleep`, never poll/);
    for (const c of ['`Agent` returns', '`task()` awaits', '`runSubagent` returns'])
      expect(fanout).toContain(c);
  });
});

describe('review-fanout: smaller package (#453)', () => {
  it('reference lists lockfiles, goldens, minified assets, build output and generated docs', () => {
    expect(EXCLUDED).toEqual(
      expect.arrayContaining([
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',
        'Cargo.lock',
        'poetry.lock',
        'uv.lock',
        'packages.lock.json',
        '__snapshots__/',
        '*.snap',
        '*.golden*',
        'goldens/',
        '*.min.js',
        'dist/',
        'coverage/',
        'docs/*-list.md',
      ])
    );
    expect(new Set(EXCLUDED).size).toBe(EXCLUDED.length);
    for (const p of EXCLUDED) expect(p).toMatch(/^[^\s:]+$/);
  });

  it('SKILL.md step 1 filters via pathspecs, points to the reference and names binary files', () => {
    expect(fanout).toMatch(
      /Filter out generated files, lockfiles, goldens\/snapshots, minified\/bundled assets/
    );
    expect(fanout).toContain("':!<pattern>'");
    expect(fanout).toContain('references/package-filter.md');
    expect(fanout).toMatch(/binary files/);
    expect(filterRef).toMatch(/Binary files/);
  });

  it('re-review package is the fix diff plus the earlier findings with status', () => {
    expect(fanout).toMatch(
      /Re-review\*\* after a fix round \(the caller passes the previous round's `review.json`\)/
    );
    expect(fanout).toMatch(
      /only the fix diff `<last review HEAD>\.\.HEAD` plus the earlier findings/
    );
    expect(fanout).toContain('fixed|open|pr-body|declined: <reason>');
    expect(fanout).not.toContain('fixed|open|advisory');
    expect(fanout).toMatch(/never the full diff again/);
  });

  it('review-lead and the PBI pipeline pass the previous review.json', () => {
    expect(pipeline).toMatch(/previous round's `review\.json` path/);
  });
});

describe('review-fanout: rulings pass (#482)', () => {
  const pass = fanout.split('\n').find((l) => l.startsWith('3. **Rulings pass**'))!;

  it('matches on same file and normalised text, ignoring the line', () => {
    expect(pass).toMatch(/`file` equals an entry's `file`/);
    expect(pass).toMatch(/normalised `issue` equals that entry's normalised `title`/);
    expect(pass).toMatch(/lowercase, collapse whitespace, strip trailing punctuation/);
    expect(pass).toMatch(/`line` is ignored/);
    expect(pass).toMatch(/`pr-body`, `declined` or `deferred`/);
  });

  it('runs before dedupe and verify and drops only MEDIUM/LOW', () => {
    expect(pass).toMatch(/before dedupe and verify/);
    expect(pass).toMatch(/new MEDIUM\/LOW finding/);
    expect(pass).toMatch(/CRITICAL\/HIGH match is never dropped[^.]*goes through verify/);
  });

  it('without a readable rulings file nothing is dropped', () => {
    expect(pass).toMatch(/missing, unreadable or invalid → skip the pass, nothing dropped/);
    expect(fanout).toMatch(/`\[\]` without a rulings file/);
  });

  it('output schema carries suppressed', () => {
    expect(fanout).toContain('"suppressed":[]');
  });
});

describe('review-fanout: rulings pass fixtures (#482)', () => {
  type F = { file: string; severity: string; issue: string; dim?: string };
  type R = { file: string; title: string; status: string };
  const norm = (t: string) =>
    t
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!?;:,]+$/, '');
  // Mirrors the SKILL.md rulings pass rules (keep in sync with the prose asserted below)
  const pass = (findings: F[], rulings: R[] | null) => {
    if (!rulings) return { kept: findings, suppressed: [] as F[] };
    const valid = rulings.filter(
      (r) => r.file && r.title && ['pr-body', 'declined', 'deferred'].includes(r.status)
    );
    const kept: F[] = [];
    const suppressed: F[] = [];
    for (const f of findings) {
      const n = norm(f.issue);
      const hit = valid.some((r) => {
        const t = norm(r.title);
        return r.file === f.file && (n === t || n.includes(t) || t.includes(n));
      });
      const droppable = ['MEDIUM', 'LOW'].includes(f.severity) && f.dim !== 'security';
      (hit && droppable ? suppressed : kept).push(f);
    }
    return { kept, suppressed };
  };
  const rulings: R[] = [
    { file: 'a.ts', title: 'Missing null check', status: 'declined' },
    { file: '', title: 'x', status: 'pr-body' },
    { file: 'b.ts', title: 'Naming', status: 'bogus' },
  ];

  it('drops a reworded MEDIUM match on another line, keeps other files and malformed-entry matches', () => {
    const r = pass(
      [
        { file: 'a.ts', severity: 'MEDIUM', issue: ' missing NULL check.' },
        { file: 'c.ts', severity: 'MEDIUM', issue: 'Missing null check' },
        { file: 'b.ts', severity: 'LOW', issue: 'Naming' },
      ],
      rulings
    );
    expect(r.suppressed.map((f) => f.file)).toEqual(['a.ts']);
    expect(r.kept.map((f) => f.file)).toEqual(['c.ts', 'b.ts']);
  });

  it('keeps HIGH and security matches, and drops nothing without a rulings file', () => {
    const fs = [
      { file: 'a.ts', severity: 'HIGH', issue: 'Missing null check' },
      { file: 'a.ts', severity: 'MEDIUM', issue: 'Missing null check', dim: 'security' },
    ];
    expect(pass(fs, rulings).kept).toHaveLength(2);
    expect(pass(fs, null).suppressed).toEqual([]);
  });

  it('SKILL.md states the rules the fixture mirrors', () => {
    expect(fanout).toMatch(/contains it or is contained in it/);
    expect(fanout).toMatch(/skipped, the other entries still apply/);
    expect(fanout).toMatch(/`security` finding is never dropped/);
  });
});

describe('review-fanout: early verify (#452)', () => {
  it('SKILL.md starts verify per arriving dimension and keeps the verdict behind all results', () => {
    expect(fanout).toMatch(/Early verify/);
    expect(fanout).toMatch(
      /as soon as its result contains a CRITICAL or HIGH finding, while other dimensions still run/
    );
    expect(fanout).toMatch(/one verify batch \(a single message\) per arriving dimension/);
    expect(fanout).toMatch(/verdict waits for all dimensions and all verify results/);
  });

  it('dedupe stays after all dimensions and keeps early refutations', () => {
    expect(fanout).toMatch(/runs after all dimensions reported/);
    expect(fanout).toMatch(/refuted in early verify stays refuted/);
  });

  it('keeps the fail-closed rules', () => {
    expect(fanout).toMatch(/`unverifiable` \(stays blocking\)/);
    expect(fanout).toMatch(/Fail closed: a failed dimension/);
  });
});

describe('review-fanout: correctness checks invariants (#485)', () => {
  it('step 1 appends plan.json invariants of items without a Task issue under Invariants (plan)', () => {
    expect(fanout).toMatch(
      /append the plan invariants as `references\/correctness-dimension\.md` describes/
    );
    expect(fanout).toContain('references/correctness-dimension.md');
    expect(correctness).toMatch(
      /items\[\]\.issue` null, or its number is not among the Task sub-issues/
    );
    expect(correctness).toContain('"## Invariants (plan)" >> <package>');
    expect(correctness).toMatch(/no item qualifies: write no `## Invariants \(plan\)` heading/);
  });

  it('correctness brief makes a violated invariant HIGH with the invariant and diff line as evidence', () => {
    expect(fanout).toMatch(
      /`correctness`: bugs, edge cases, error handling, races; check each invariant in the issue section: a violated one is HIGH, `evidence` quotes the invariant and the diff line/
    );
    expect(correctness).toMatch(
      /A violated invariant is HIGH\. `evidence` quotes the invariant and the diff line/
    );
  });

  it('a violated invariant goes through verify like any HIGH', () => {
    expect(fanout).toMatch(/goes through verify like any HIGH, refuted → advisory/);
    expect(correctness).toMatch(/`refuted` turns it into an advisory/);
    expect(fanout).toMatch(/tries to disprove each CRITICAL\/HIGH finding/);
  });

  it('without an Invariants section brief and findings stay unchanged', () => {
    expect(fanout).toMatch(/no `## Invariants` section: unchanged/);
    expect(correctness).toMatch(
      /No `## Invariants` anywhere in the package: the brief and the findings are unchanged/
    );
  });

  it('selection rule on a sample plan: only items with Invariants and no matching Task issue are appended', () => {
    // rule as documented in correctness-dimension.md: has `## Invariants`, and `issue` null or not among Task sub-issues
    const select = (items: { id: string; body: string; issue: number | null }[], tasks: number[]) =>
      items
        .filter(
          (i) => /^## Invariants$/m.test(i.body) && (i.issue === null || !tasks.includes(i.issue))
        )
        .map((i) => i.id);
    const items = [
      { id: 't1', body: 'x\n## Invariants\n- a', issue: null },
      { id: 't2', body: 'x\n## Invariants\n- b', issue: 11 },
      { id: 't3', body: 'x\n## Invariants\n- c', issue: 99 },
      { id: 't4', body: 'no section', issue: null },
    ];
    expect(select(items, [11])).toEqual(['t1', 't3']);
    expect(select(items, [])).toEqual(['t1', 't2', 't3']);
    expect(select([], [11])).toEqual([]);
    expect(correctness).toMatch(/has no `## Invariants`|each item whose body has one/);
  });

  it('invariant violated by omission gets a valid location fallback', () => {
    expect(correctness).toMatch(
      /violated by omission[^\n]*closest changed file[^\n]*placeholder `file` = the package path, `line` = 1/
    );
  });

  it('"no spec available" sentence precedes the plan append, which also applies in a re-review', () => {
    expect(fanout.indexOf('no spec available" as advisory')).toBeLessThan(
      fanout.indexOf('plan invariants')
    );
    expect(fanout).toMatch(/also in a re-review\) and `<state>\/<issue>\/plan\.json` present/);
  });

  it('SKILL.md stays within 100 lines', () => {
    expect(fanout.trimEnd().split('\n').length).toBeLessThanOrEqual(100);
  });
});

describe('review-fanout: smaller package (#535)', () => {
  const MARKER = '=== DOCUMENTATION ===';
  const DOC_PATTERNS = (
    /Patterns, one per line[^\n]*\n\n```text\n([\s\S]*?)\n```/.exec(filterRef)?.[1] ?? ''
  )
    .split('\n')
    .filter(Boolean);

  it('uses -U3 in SKILL.md and package-filter.md, never -U10', () => {
    expect(fanout).toContain('git diff -U3 <base>..<head>');
    expect(filterRef).toContain('`git diff -U3`');
    expect(fanout).not.toContain('-U10');
    expect(filterRef).not.toContain('-U10');
  });

  it('documentation patterns cover top-level files and nested markdown, one per line', () => {
    expect(DOC_PATTERNS).toEqual(['docs/**/*.md', 'CHANGELOG.md', '**/README*.md', 'site/**/*.md']);
    expect(filterRef).toContain(':(glob)');
  });

  it('uses a unique marker line, not a markdown heading, and tells code reviewers to stop there', () => {
    expect(fanout).toContain(MARKER);
    expect(filterRef).toContain(MARKER);
    expect(fanout).not.toContain('## Documentation');
    expect(fanout).toMatch(/written LAST, after the issue and invariants sections/);
    expect(fanout).toMatch(/none → no marker/);
    expect(fanout).toMatch(
      /`correctness`, `security`, `tests`: stop reading at the `=== DOCUMENTATION ===` line/
    );
    expect(fanout).toMatch(/`spec` and `conventions` read it/);
  });

  it('PR path writes the same marker section', () => {
    expect(fanout).toMatch(/a PR: `gh pr diff <nr>` sections of those files, same marker/);
  });

  it('SKILL.md declares the size fields, the 15k note and no split', () => {
    expect(fanout).toContain('"package":{"bytes":0,"tokensEstimated":0,"hunks":0,"docsHunks":0}');
    expect(fanout).toMatch(/Above 15000 estimated tokens/);
    expect(fanout).toContain('package ~<n>k tokens > 15k — largest: <files>');
    expect(fanout).toMatch(/never split the package/);
    expect(filterRef).toMatch(/never split automatically/);
  });

  it('ledger review line carries the package size and the reply names the new keys', () => {
    expect(pipeline).toMatch(/Phase review: complete — <sha> — package ~<n>k tokens/);
    expect(pipeline).toMatch(/packageTokens, oversize\?, packageFile, review\}/);
    expect(pipeline).toMatch(/Phase review/);
  });
});

describe('review-fanout: size class and skipped dimensions (#534)', () => {
  const orchestratorDoc = fs.readFileSync(path.join(root, 'docs/orchestrator.md'), 'utf-8');
  const classifyLine = fanout
    .split('\n')
    .find((l) => l.includes('Classify-Diff.ps1 -Range') === false && l.includes('It prints'))!;

  it('step 2 names the reduced full + small set and that a caller list replaces it', () => {
    expect(classifyLine).toContain('{mode,dimensions,reason,size,signals,skippedDimensions}');
    expect(classifyLine).toMatch(/`full` \+ `small`/);
    expect(classifyLine).toMatch(/`correctness`, `tests`, `spec`/);
    expect(classifyLine).toMatch(/`security` on the `risky` or `sensitive` signal/);
    expect(classifyLine).toMatch(/`conventions` on the `source` signal/);
    expect(classifyLine).toMatch(/a dimension list given by the caller replaces them/);
    expect(classifyLine).toMatch(/`-Force full` runs all five/);
    expect(classifyLine).toMatch(/invalid JSON is `full` with all five dimensions/);
  });

  it('output shape and review.json carry skippedDimensions', () => {
    expect(fanout).toContain('"skippedDimensions":[{"dimension","reason"}]');
    expect(fanout).toMatch(
      /`skippedDimensions` = the dimensions the size class dropped, `\[\]` when none/
    );
  });

  it('ledger review line lists skipped dimensions read from review.json', () => {
    expect(pipeline).toContain('[ — skipped <dim>,<dim> (size small)]');
    expect(pipeline).toMatch(/read from `skippedDimensions` of `review\.json`/);
  });

  it('a size-skipped dimension is never added back in a re-review', () => {
    expect(pipeline).toMatch(/a dimension skipped for size is never added back/);
    expect(fanout).toMatch(/never adds a size-skipped dimension back/);
  });

  it('docs mention the size class and skippedDimensions', () => {
    expect(orchestratorDoc).toMatch(/The size class: a small diff/);
    expect(orchestratorDoc).toContain('`skippedDimensions` in `review.json`');
    expect(fs.readFileSync(path.join(root, 'docs/working-mode.md'), 'utf-8')).toMatch(
      /a small `full` diff runs fewer/
    );
  });
});

describe('review-fanout: review.json shape and ledger line (#534)', () => {
  // Output template of SKILL.md, made parseable by quoting the bare field names.
  const shapeLine = fanout.split('\n').find((l) => l.startsWith('`{"mode"'))!;
  const template = /^`(\{.*\})`/
    .exec(shapeLine)![1]
    .replace(/\{(file,line,severity,issue,evidence)\}/, '"$1"')
    .replace(/\{"dimension","reason"\}/, '{"dimension":"","reason":""}')
    .replace(/"APPROVE\|CHANGES_REQUESTED"|"[a-z|]+\|[a-z|]+"/g, '""');
  const shape = JSON.parse(template) as Record<string, unknown>;

  it('the output template is valid JSON with skippedDimensions as {dimension,reason} array', () => {
    expect(Object.keys(shape)).toEqual(
      expect.arrayContaining([
        'mode',
        'dimensions',
        'verdict',
        'suppressed',
        'skippedDimensions',
        'package',
      ])
    );
    expect(shape.skippedDimensions).toEqual([{ dimension: '', reason: '' }]);
  });

  // Ledger template of pbi-pipeline.md as a regex: the optional skipped part becomes an optional group.
  const ledgerTemplate = /`(Phase review: complete[^`]*)`/.exec(pipeline)![1];
  const ledger = new RegExp(
    '^' +
      ledgerTemplate
        .replace(
          /\[ — skipped <dim>,<dim> \(size small\)\]/,
          '( — skipped \\w+(,\\w+)* \\(size small\\))?'
        )
        .replace('<sha>', '[0-9a-f]+')
        .replace('<n>', '\\d+') +
      '$'
  );

  it('the ledger template accepts a review line with and without skipped dimensions', () => {
    expect(ledgerTemplate).toBe(
      'Phase review: complete — <sha> — package ~<n>k tokens[ — skipped <dim>,<dim> (size small)]'
    );
    expect('Phase review: complete — abc1234 — package ~12k tokens').toMatch(ledger);
    expect(
      'Phase review: complete — abc1234 — package ~12k tokens — skipped security,conventions (size small)'
    ).toMatch(ledger);
    expect(
      'Phase review: complete — abc1234 — package ~3k tokens — skipped security (size small)'
    ).toMatch(ledger);
  });

  it('the ledger template rejects an empty skipped list or a missing size note', () => {
    expect(
      'Phase review: complete — abc1234 — package ~12k tokens — skipped  (size small)'
    ).not.toMatch(ledger);
    expect('Phase review: complete — abc1234 — package ~12k tokens — skipped security').not.toMatch(
      ledger
    );
    expect('Phase review: complete — abc1234 — skipped security (size small)').not.toMatch(ledger);
  });

  it('a re-review carries the earlier skippedDimensions forward along the whole dispatch chain', () => {
    // The previous review.json travels pipeline -> review-lead -> review-fanout.
    expect(pipeline).toMatch(
      /`review-lead` gets range, dimension list, the previous round's `review\.json` path[^\n]*?passes them to `review-fanout`/
    );
    expect(fanout).toMatch(
      /\*\*Re-review\*\* after a fix round \(the caller passes the previous round's `review\.json`\)/
    );
    // The carried field is the one the output template defines, with the same entry shape.
    const rule = fanout.split('\n').find((l) => l.includes('A re-review keeps the delta rule'))!;
    const carried =
      /carries the `(\w+)` of the previous `review\.json` into its own \(union, no duplicates\)/.exec(
        rule
      );
    expect(carried?.[1]).toBe('skippedDimensions');
    expect(shape).toHaveProperty(carried![1]);
    expect(shape[carried![1]]).toEqual([{ dimension: '', reason: '' }]);
    // Same sentence: nothing skipped is re-added, and the record survives the overwrite.
    expect(rule).toMatch(
      /never adds a size-skipped dimension back and carries the `skippedDimensions`[^\n]*?so the record survives the overwrite\./
    );
  });
});
