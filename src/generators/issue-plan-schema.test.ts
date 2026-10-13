import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv/dist/2020';

const refs = path.resolve(
  __dirname,
  '../../packages/development-workflow/.apm/skills/issue-planning/references',
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
});
