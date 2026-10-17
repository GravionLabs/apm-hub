import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/github/.apm/skills/github-project/scripts/Set-ProjectStandard.ps1');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

it('pwsh is installed in CI (the Set-ProjectStandard cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

type Opt = { id: string; name: string; color: string; description: string };
const opt = (name: string, color = 'GRAY'): Opt => ({ id: `id-${name}`, name, color, description: `d ${name}` });
const select = (name: string, options: Opt[]) => ({ id: `F-${name}`, name, databaseId: name.length, dataType: 'SINGLE_SELECT', options });
const plain = (name: string, n: number) => ({ id: `F-${name}`, name, databaseId: n, dataType: 'TEXT' });
const PLAIN = ['Title', 'Labels', 'Linked pull requests', 'Parent issue', 'Sub-issues progress'].map((n, i) => plain(n, i + 1));
const DEFAULT_STATUS = ['Todo', 'In Progress', 'Done'].map((n) => opt(n));
const HELIX_STATUS = ['Backlog', 'Ready', 'In progress', 'In review', 'Done'].map((n) => opt(n));
const LEVEL = select('Level', ['Epic', 'Feature', 'PBI', 'Task', 'Bug'].map((n) => opt(n)));
const STANDARD_VIEWS = ['Hierarchy', 'Board', 'Release next', 'Backlog', 'Recently closed'].map((name) => ({ id: `V-${name}`, name }));

type Item = { id: string; number: number; title: string; state: string; labels: string[]; status?: string; level?: string };
const item = (number: number, o: Partial<Item> = {}): Item => ({ id: `I-${number}`, number, title: `t${number}`, state: 'OPEN', labels: [], ...o });

interface State {
  fields: unknown[];
  views: { id: string; name: string }[];
  items: Item[];
}
const state = (o: Partial<State> & { status?: Opt[] } = {}): State => ({
  fields: [select('Status', o.status ?? DEFAULT_STATUS), LEVEL, ...PLAIN, ...(o.fields ?? [])],
  views: o.views ?? STANDARD_VIEWS,
  items: o.items ?? [],
});

interface Action {
  type: string;
  [k: string]: any;
}

describe.skipIf(!hasPwsh)('Set-ProjectStandard.ps1 -StateFile', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projstd-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const plan = (s: unknown, ...flags: string[]): Action[] => {
    const file = path.join(dir, 'state.json');
    fs.writeFileSync(file, JSON.stringify({ projectId: 'P', ownerType: 'User', ...(s as object) }));
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-StateFile', file, '-DryRun', '-Json', ...flags], { cwd: dir, encoding: 'utf8' });
    expect(r.status, r.stderr + r.stdout).toBe(0);
    return JSON.parse(r.stdout).actions;
  };
  const ofType = (a: Action[], t: string) => a.filter((x) => x.type === t);

  describe('Status', () => {
    it.each([
      ['default set', DEFAULT_STATUS, ['Todo', 'In Progress', 'In release', 'Done']],
      ['Helix set', HELIX_STATUS, ['Backlog', 'Ready', 'In progress', 'In review', 'In release', 'Done']],
    ])('inserts In release before Done and keeps ids (%s)', (_n, status, names) => {
      const [a] = ofType(plan(state({ status })), 'UpdateStatusOptions');
      expect(a.options.map((o: Opt) => o.name)).toEqual(names);
      for (const o of status) expect(a.options.find((x: Opt) => x.name === o.name)).toMatchObject(o);
      expect(a.options.find((x: Opt) => x.name === 'In release')).toMatchObject({ color: 'BLUE' });
      expect(a.options.find((x: Opt) => x.name === 'In release').id).toBeUndefined();
    });

    it('appends at the end without a Done option', () => {
      const [a] = ofType(plan(state({ status: [opt('Todo'), opt('Doing')] })), 'UpdateStatusOptions');
      expect(a.options.map((o: Opt) => o.name)).toEqual(['Todo', 'Doing', 'In release']);
    });

    it('is a no-op when In release exists', () => {
      const status = [opt('Todo'), opt('In release'), opt('Done')];
      expect(ofType(plan(state({ status })), 'UpdateStatusOptions')).toHaveLength(0);
    });
  });

  describe('Level', () => {
    it('creates the field with five options when missing', () => {
      const s = state();
      s.fields = s.fields.filter((f: any) => f.name !== 'Level');
      const [a] = ofType(plan(s), 'CreateField');
      expect(a.name).toBe('Level');
      expect(a.options.map((o: Opt) => `${o.name}:${o.color}`)).toEqual(['Epic:PURPLE', 'Feature:GREEN', 'PBI:BLUE', 'Task:GRAY', 'Bug:RED']);
    });

    it('keeps an existing field untouched', () => {
      expect(ofType(plan(state()), 'CreateField')).toHaveLength(0);
    });
  });

  describe('-Sync', () => {
    const sync = (items: Item[], status?: Opt[]) => plan(state({ items, status }), '-Sync').filter((a) => a.type === 'SetItem');
    const set = (a: Action[], n: number, field: string) => a.find((x) => x.number === n && x.field === field)?.option;

    it('derives Level from labels in order epic|feature|pbi|task|bug, then title prefix', () => {
      const a = sync([
        item(1, { labels: ['task', 'feature'] }),
        item(2, { labels: ['bug'] }),
        item(3, { title: '[PBI] something' }),
        item(4, { title: 'plain' }),
        item(5, { labels: ['epic'], level: 'Task' }),
      ]);
      expect(set(a, 1, 'Level')).toBe('Feature');
      expect(set(a, 2, 'Level')).toBe('Bug');
      expect(set(a, 3, 'Level')).toBe('PBI');
      expect(set(a, 4, 'Level')).toBeUndefined();
      expect(set(a, 5, 'Level')).toBeUndefined();
    });

    it('moves open merged issues to In release, and In release without merged back to Todo', () => {
      const a = sync([
        item(1, { labels: ['merged'], status: 'Todo', level: 'PBI' }),
        item(2, { labels: ['merged'], status: 'In release', level: 'PBI' }),
        item(3, { status: 'In release', level: 'PBI' }),
      ]);
      expect(set(a, 1, 'Status')).toBe('In release');
      expect(set(a, 2, 'Status')).toBeUndefined();
      expect(set(a, 3, 'Status')).toBe('Todo');
    });

    it('falls back to the first status option when Todo does not exist', () => {
      const a = sync([item(3, { status: 'In release', level: 'PBI' })], [opt('Backlog'), opt('Done')]);
      expect(set(a, 3, 'Status')).toBe('Backlog');
    });

    it('sets Level on closed items but never their Status', () => {
      const a = sync([item(1, { state: 'CLOSED', labels: ['merged', 'pbi'], status: 'Done' }), item(2, { state: 'CLOSED', status: 'In release' })]);
      expect(set(a, 1, 'Level')).toBe('PBI');
      expect(set(a, 1, 'Status')).toBeUndefined();
      expect(set(a, 2, 'Status')).toBeUndefined();
      expect(a).toHaveLength(1);
    });

    it('does nothing without -Sync', () => {
      expect(ofType(plan(state({ items: [item(1, { labels: ['pbi'] })] })), 'SetItem')).toHaveLength(0);
    });
  });

  describe('views', () => {
    it('creates only the missing standard views with field names and grouping', () => {
      const views = STANDARD_VIEWS.filter((v) => v.name !== 'Board' && v.name !== 'Backlog');
      const creates = ofType(plan(state({ views: [...views, { id: 'V-x', name: 'Mine' }] })), 'CreateView');
      expect(creates.map((c) => c.name)).toEqual(['Board', 'Backlog']);
      expect(creates[0]).toMatchObject({ layout: 'board', filter: '-label:epic,feature -status:Done', verticalGroupBy: 'Status' });
      expect(creates[1]).toMatchObject({ layout: 'table', groupBy: 'Parent issue' });
    });

    it('never deletes foreign views', () => {
      const a = plan(state({ views: [...STANDARD_VIEWS, { id: 'V-x', name: 'Mine' }] }), '-RemoveDefaultViews');
      expect(ofType(a, 'DeleteView')).toHaveLength(0);
    });
  });

  describe('-RemoveDefaultViews', () => {
    const defaults = [
      { id: 'V1', name: 'View 1' },
      { id: 'V2', name: 'View 12' },
      { id: 'V3', name: 'Probe' },
      { id: 'V4', name: 'Probe' },
      { id: 'V5', name: 'View of mine' },
    ];

    it('deletes View <n> and Probe when all standard views exist', () => {
      const a = plan(state({ views: [...STANDARD_VIEWS, ...defaults] }), '-RemoveDefaultViews');
      expect(ofType(a, 'DeleteView').map((d) => d.id)).toEqual(['V1', 'V2', 'V3', 'V4']);
    });

    it('plans the missing standard view before any deletion (it counts as existing afterwards)', () => {
      const guard = plan(state({ views: [...STANDARD_VIEWS.slice(0, 4), ...defaults] }), '-RemoveDefaultViews');
      expect(guard.findIndex((a) => a.type === 'CreateView')).toBeLessThan(guard.findIndex((a) => a.type === 'DeleteView'));
      expect(ofType(guard, 'CreateView').map((c) => c.name)).toEqual(['Recently closed']);
      expect(ofType(guard, 'DeleteView')).toHaveLength(4);
    });

    it('deletes nothing without the flag', () => {
      expect(ofType(plan(state({ views: [...STANDARD_VIEWS, ...defaults] })), 'DeleteView')).toHaveLength(0);
    });
  });

  it('is idempotent: a standard state yields no actions', () => {
    const items = [
      item(1, { labels: ['pbi'], status: 'Todo', level: 'PBI' }),
      item(2, { labels: ['merged', 'task'], status: 'In release', level: 'Task' }),
      item(3, { state: 'CLOSED', status: 'Done', level: 'Bug' }),
    ];
    const status = [opt('Todo'), opt('In release'), opt('Done')];
    expect(plan(state({ status, items }), '-Sync', '-RemoveDefaultViews')).toEqual([]);
  });
});
