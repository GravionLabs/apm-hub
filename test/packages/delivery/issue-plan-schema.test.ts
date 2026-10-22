import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv/dist/2020';

const refs = path.resolve(
  __dirname,
  '../../../packages/delivery/.apm/skills/issue-planning/references',
);
const schema = JSON.parse(fs.readFileSync(path.join(refs, 'plan.schema.json'), 'utf-8'));
const doc = fs.readFileSync(path.join(refs, 'plan-schema.md'), 'utf-8');
const example = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(doc)![1]);

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(schema);

/** Graph invariants JSON Schema cannot express. Returns error strings. */
function graphErrors(plan: any): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const it of plan.items) {
    if (ids.has(it.id)) errors.push(`duplicate id ${it.id}`);
    ids.add(it.id);
  }
  for (const it of plan.items) {
    for (const b of it.blocked_by) {
      if (typeof b === 'string' && !ids.has(b)) errors.push(`dangling ${b} in ${it.id}`);
      if (b === it.id) errors.push(`self reference ${it.id}`);
    }
  }
  for (const q of plan.questions) {
    if (!q.options.includes(q.recommended)) errors.push(`${q.id}: recommended not in options`);
    for (const b of q.blocks) if (!ids.has(b)) errors.push(`dangling ${b} in ${q.id}`);
  }
  const real = plan.items.filter((i: any) => i.issue !== null);
  if (plan.level === 'task' && plan.items.length === 1 && real.length > 0) {
    errors.push('single task must not have an issue');
  }
  if (plan.level === 'task' && plan.items.length > 1 && real.length > 0 && real.length < plan.items.length) {
    errors.push('task issues must be all or none');
  }
  if (plan.input_type === 'description' && real.length > 0) {
    errors.push('description plan must not have issue numbers');
  }
  const state = new Map<string, number>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    const it = plan.items.find((i: any) => i.id === id);
    for (const b of it?.blocked_by ?? []) {
      if (typeof b === 'string' && ids.has(b) && visit(b)) return true;
    }
    state.set(id, 2);
    return false;
  };
  if ([...ids].some(visit)) errors.push('cycle');
  return errors;
}

const check = (plan: any) => [
  ...(validateSchema(plan) ? [] : ['schema']),
  ...graphErrors(plan),
];

const clone = () => structuredClone(example);
const item = (id: string, blocked_by: any[] = []) => ({ ...clone().items[0], id, blocked_by });

describe('plan.json schema', () => {
  it('accepts the example from plan-schema.md', () => {
    expect(check(example)).toEqual([]);
  });

  it('rejects a dangling blocked_by id', () => {
    const p = clone();
    p.items[0].blocked_by = ['p9'];
    expect(check(p).join()).toContain('dangling p9');
  });

  it('rejects a cycle', () => {
    const p = clone();
    p.items = [item('p1', ['p2']), item('p2', ['p1'])];
    p.questions = [];
    expect(check(p)).toContain('cycle');
  });

  it('accepts integer blockers (existing issues)', () => {
    const p = clone();
    p.items[0].blocked_by = [42];
    expect(check(p)).toEqual([]);
  });

  it('rejects recommended not in options', () => {
    const p = clone();
    p.questions[0].recommended = 'other';
    expect(check(p)).toContain('q1: recommended not in options');
  });

  it('rejects fewer than 2 options', () => {
    const p = clone();
    p.questions[0].options = ['drop now'];
    p.questions[0].recommended = 'drop now';
    expect(check(p)).toContain('schema');
  });

  it('rejects duplicate ids', () => {
    const p = clone();
    p.items = [item('p1'), item('p1')];
    p.questions = [];
    expect(check(p)).toContain('duplicate id p1');
  });

  it('accepts deferred: true with non-empty blocks', () => {
    const p = clone();
    p.questions[0].blocks = ['p1'];
    p.questions[0].deferred = true;
    expect(check(p)).toEqual([]);
  });

  it('rejects a non-boolean deferred', () => {
    const p = clone();
    p.questions[0].deferred = 'yes';
    expect(check(p)).toContain('schema');
  });

  it('rejects deferred: true with empty blocks', () => {
    const p = clone();
    p.questions[0].blocks = [];
    p.questions[0].deferred = true;
    expect(check(p)).toContain('schema');
  });

  it('accepts empty blocks when not deferred', () => {
    const p = clone();
    p.questions[0].blocks = [];
    expect(check(p)).toEqual([]);
  });

  describe('level task', () => {
    const tasks = (issues: (number | null)[]) => {
      const p = clone();
      p.level = 'task';
      p.input_type = 'pbi';
      p.parent_issue = 189;
      p.questions = [];
      p.items = issues.map((issue, i) => ({
        ...item(`p${i + 1}`, i ? [`p${i}`] : []),
        title: `chore: step ${i + 1}`,
        issue,
      }));
      return p;
    };

    it('accepts one task without an issue', () => {
      expect(check(tasks([null]))).toEqual([]);
    });

    it('rejects an issue on a single task', () => {
      expect(check(tasks([301]))).toContain('single task must not have an issue');
    });

    it('accepts two tasks with cached issue numbers and ordered blockers', () => {
      expect(check(tasks([301, 302]))).toEqual([]);
    });

    it('accepts two tasks before publish (all null)', () => {
      expect(check(tasks([null, null]))).toEqual([]);
    });

    it('rejects a half-published task list', () => {
      expect(check(tasks([301, null]))).toContain('task issues must be all or none');
      expect(check(tasks([301, 302, null]))).toContain('task issues must be all or none');
      expect(check(tasks([null, 302, 303]))).toContain('task issues must be all or none');
    });

    it('rejects issue numbers on a description plan', () => {
      const p = tasks([301, 302]);
      p.input_type = 'description';
      p.parent_issue = null;
      expect(check(p)).toContain('description plan must not have issue numbers');
    });

    it('plan-schema.md states the rules the helper enforces', () => {
      expect(doc).toMatch(/single task or a description creates none/);
      expect(doc).toMatch(/Never a mix of null and numbers after publish/);
    });
  });
});
