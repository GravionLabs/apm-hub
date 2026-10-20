import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const pkg = path.join(root, 'packages/rust');
const skills = ['rust-implementation', 'rust-test'];
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('rust package', () => {
  it('rust-test description explains purpose, not just keywords', () => {
    const text = read('packages/rust/.apm/skills/rust-test/SKILL.md');
    expect(/^description: (.*)$/m.exec(text)![1].length).toBeGreaterThan(60);
  });

  it('README and verify-project know rust', () => {
    expect(read('README.md')).toMatch(/^\| `rust`\s+\| `rust-implementation`, `rust-test`/m);
    const v = read('packages/delivery/.apm/skills/verify-project/SKILL.md');
    expect(v).toContain('cargo clippy --all-targets --all-features -- -D warnings');
    expect(v).toContain('cargo fmt --all -- --check');
    expect(v).not.toContain('cargo test');
  });

  it.each(skills)('%s has valid frontmatter and size', (name) => {
    const text = fs.readFileSync(path.join(pkg, '.apm/skills', name, 'SKILL.md'), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
    expect(fm).not.toBeNull();
    expect(fm![1]).toMatch(new RegExp(`^name: ${name}$`, 'm'));
    expect(fm![1]).toMatch(/^description:/m);
    expect(text.split('\n').length).toBeLessThanOrEqual(100);
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
    expect(refs).toContain('use mockall::predicate::eq;');
    expect(refs).toContain('`#[async_trait]` above `#[automock]`');
    expect(text).toContain('tests/*.rs');
  });

  it('manifest lists exactly the skills on disk and every referenced file exists', () => {
    expect(fs.readdirSync(path.join(pkg, '.apm/skills')).sort()).toEqual([...skills].sort());
    let refCount = 0;
    for (const name of skills) {
      const text = read(`packages/rust/.apm/skills/${name}/SKILL.md`);
      for (const m of text.matchAll(/`(references\/[\w.-]+)`/g)) {
        refCount++;
        expect(fs.existsSync(path.join(pkg, '.apm/skills', name, m[1]))).toBe(true);
      }
    }
    expect(refCount).toBeGreaterThanOrEqual(2);
  });

  it('is registered in root apm.yml and the all meta-package', () => {
    expect(read('apm.yml')).toMatch(/- name: rust\n[\s\S]*?source: \.\/packages\/rust/);
    expect(read('packages/all/apm.yml')).toContain('GravionLabs/apm-hub/packages/rust');
  });

  describe('Tauri conventions', () => {
    const impl = () => read('packages/rust/.apm/skills/rust-implementation/SKILL.md');
    const ref = () => read('packages/rust/.apm/skills/rust-implementation/references/tauri.md');

    it('rust-implementation loads the reference only for framework tauri', () => {
      const line = impl().split('\n').find((l) => l.includes('references/tauri.md'))!;
      expect(line).toContain('frameworks: ["tauri"]');
      expect(line).toContain('`references/tauri.md`');
      expect(impl().match(/references\/tauri\.md/g)).toHaveLength(1);
    });

    it('detect-techstack reports tauri as a framework', () => {
      const dt = read('packages/shared/.apm/skills/detect-techstack/SKILL.md')
        + fs.readdirSync(path.join(root, 'packages/shared/.apm/skills/detect-techstack'), { recursive: true })
          .filter((f) => String(f).endsWith('.md')).map((f) => read(`packages/shared/.apm/skills/detect-techstack/${f}`)).join('');
      expect(dt).toContain('tauri');
    });

    it('tauri.md has a section per required topic', () => {
      for (const h of [/^## Commands$/m, /^## Events vs commands$/m, /^## Capabilities and permissions/m, /^## Plugins$/m, /^## Layout and separation$/m, /^## Tauri 1 vs 2$/m])
        expect(ref()).toMatch(h);
      expect(ref()).toContain('tauri::State');
      expect(ref()).toContain('thiserror');
      expect(ref()).toContain('src-tauri/capabilities');
      expect(ref()).toContain('untrusted');
    });

    it('rust-test names the command strategy conditionally and delegates frontend to ts-test', () => {
      const t = read('packages/rust/.apm/skills/rust-test/SKILL.md');
      const line = t.split('\n').find((l) => l.includes('tauri::test'))!;
      expect(line).toContain('frameworks: ["tauri"]');
      expect(line).toContain('pure functions');
      expect(line).toContain('`ts-test`');
    });

    it('verify-project step 5 runs cargo in src-tauri and builds with tauri build', () => {
      const line = read('packages/delivery/.apm/skills/verify-project/SKILL.md').split('\n').find((l) => l.startsWith('5. Rust'))!;
      expect(line).toContain('src-tauri/');
      expect(line).toContain('`pnpm tauri build`');
      expect(line).toContain('packageManager');
      expect(line).not.toContain('cargo test');
    });
  });
});
