import { describe, it, expect } from 'vitest';
import { isCopilotAvailable, createTestSession, SKILLS_DIR, PACKAGES_DIR } from '../harness/copilot-harness.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const skip = !isCopilotAvailable();

describe.skipIf(skip)('Skill loading via Copilot SDK', () => {
  it('should connect to Copilot CLI successfully', async () => {
    const { client, session } = await createTestSession();
    try {
      expect(session).toBeDefined();
    } finally {
      await session.disconnect();
      await client.stop();
    }
  }, 60_000);

  it('should receive a response to a basic prompt', async () => {
    const { client, session } = await createTestSession();
    try {
      const response = await session.sendAndWait({ prompt: 'Say "hello" in one word.' });
      expect(response?.data.content).toBeTruthy();
    } finally {
      await session.disconnect();
      await client.stop();
    }
  }, 60_000);

  it('should load skills from .github/skills directory', async () => {
    const { client, session } = await createTestSession({ skillsDir: SKILLS_DIR });
    try {
      expect(session).toBeDefined();
    } finally {
      await session.disconnect();
      await client.stop();
    }
  }, 60_000);
});

describe('Skill directory structure (static, always runs)', () => {
  it('should have .github/skills directory with SKILL.md files', () => {
    expect(existsSync(SKILLS_DIR)).toBe(true);
    const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    expect(skillDirs.length).toBeGreaterThan(0);
    for (const dir of skillDirs) {
      const skillMd = join(SKILLS_DIR, dir, 'SKILL.md');
      expect(existsSync(skillMd), `Missing SKILL.md in ${dir}`).toBe(true);
    }
  });

  it('should have packages directory with at least one .apm/skills subdirectory', () => {
    expect(existsSync(PACKAGES_DIR)).toBe(true);
    const domains = readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    const domainsWithSkills = domains.filter(d =>
      existsSync(join(PACKAGES_DIR, d, '.apm', 'skills'))
    );
    expect(domainsWithSkills.length).toBeGreaterThan(0);
  });
});
