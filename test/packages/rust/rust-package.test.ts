import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const pkg = path.join(root, 'packages/rust');
const skills = ['rust-implementation', 'rust-test'];
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('rust package', () => {
  it.each(skills)('%s has valid frontmatter and size', (name) => {
    const text = fs.readFileSync(path.join(pkg, '.apm/skills', name, 'SKILL.md'), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
    expect(fm).not.toBeNull();
    expect(fm![1]).toMatch(new RegExp(`^name: ${name}$`, 'm'));
    expect(fm![1]).toMatch(/^description:/m);
    expect(text.split('\n').length).toBeLessThan(100);
  });

  it('rust-implementation has Review rules and clippy/rustfmt/unsafe/thiserror/anyhow guidance', () => {
    const dir = path.join(pkg, '.apm/skills/rust-implementation');
    const text = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
    expect(text).toMatch(/^## Review rules$/m);
    expect(text).toContain('-D warnings');
    expect(text).toContain('rustfmt');
    const refs = fs.readFileSync(path.join(dir, 'references/conventions.md'), 'utf8');
    for (const word of ['thiserror', 'anyhow', 'unsafe', 'tokio']) expect(refs).toContain(word);
  });

  it('rust-test covers cargo test, nextest, mockall and proptest', () => {
    const dir = path.join(pkg, '.apm/skills/rust-test');
    const text = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
    expect(text).toContain('cargo test');
    expect(text).toContain('nextest');
    expect(text).toContain('#[cfg(test)]');
    const refs = fs.readFileSync(path.join(dir, 'references/mocking-and-properties.md'), 'utf8');
    expect(refs).toContain('mockall');
    expect(refs).toContain('proptest');
  });

  it('manifest lists exactly the skills on disk and every referenced file exists', () => {
    const listed = [...read('packages/rust/apm.yml').matchAll(/^ {2}- (rust-[\w-]+)$/gm)].map((m) => m[1]);
    expect(listed.sort()).toEqual(fs.readdirSync(path.join(pkg, '.apm/skills')).sort());
    for (const name of skills) {
      const text = read(`packages/rust/.apm/skills/${name}/SKILL.md`);
      for (const m of text.matchAll(/`(references\/[\w.-]+)`/g)) {
        expect(fs.existsSync(path.join(pkg, '.apm/skills', name, m[1]))).toBe(true);
      }
    }
  });

  it('is registered in root apm.yml and the all meta-package', () => {
    expect(read('apm.yml')).toMatch(/- name: rust\n[\s\S]*?source: \.\/packages\/rust/);
    expect(read('packages/all/apm.yml')).toContain('GravionLabs/apm-hub/packages/rust');
  });
});
