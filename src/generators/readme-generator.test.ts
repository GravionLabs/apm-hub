import { describe, it, expect, vi, beforeEach } from 'vitest';
import { injectBlock, updateFileBlock } from './readme-generator';

vi.mock('fs');

import * as fs from 'fs';

const mockFs = vi.mocked(fs);

describe('injectBlock', () => {
  it('replaces the content between markers', () => {
    const content = [
      '# README',
      '<!-- AUTO:start my-block -->',
      'old content',
      '<!-- AUTO:end my-block -->',
      'after',
    ].join('\n');

    const result = injectBlock(content, 'my-block', 'new content');
    expect(result).toContain(
      '<!-- AUTO:start my-block -->\nnew content\n<!-- AUTO:end my-block -->',
    );
    expect(result).not.toContain('old content');
    expect(result).toContain('after');
  });

  it('works when block was previously empty', () => {
    const content = '<!-- AUTO:start x -->\n<!-- AUTO:end x -->';
    const result = injectBlock(content, 'x', 'inserted');
    expect(result).toBe('<!-- AUTO:start x -->\ninserted\n<!-- AUTO:end x -->');
  });

  it('throws when start marker is missing', () => {
    const content = '<!-- AUTO:end my-block -->';
    expect(() => injectBlock(content, 'my-block', 'x')).toThrow(
      "AUTO markers for 'my-block' not found",
    );
  });

  it('throws when end marker is missing', () => {
    const content = '<!-- AUTO:start my-block -->';
    expect(() => injectBlock(content, 'my-block', 'x')).toThrow(
      "AUTO markers for 'my-block' not found",
    );
  });
});

describe('updateFileBlock', () => {
  const FILE_PATH = 'docs/overview.md';
  const fileWithMarkers =
    '# Overview\n\n<!-- AUTO:start version -->\nWelcome to **apm-hub** v1.0.0 👋\n<!-- AUTO:end version -->\n\nSome content.\n';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.writeFileSync = vi.fn();
  });

  it('updates the block content and returns true when changed', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readFileSync = vi.fn().mockReturnValue(fileWithMarkers);

    const result = updateFileBlock(FILE_PATH, 'version', 'Welcome to **apm-hub** v2.0.0 👋');

    expect(result).toBe(true);
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('v2.0.0');
  });

  it('returns false and does not write when content is unchanged', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readFileSync = vi.fn().mockReturnValue(fileWithMarkers);

    const result = updateFileBlock(FILE_PATH, 'version', 'Welcome to **apm-hub** v1.0.0 👋');

    expect(result).toBe(false);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('returns false and warns when file does not exist', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);

    const result = updateFileBlock(FILE_PATH, 'version', 'Welcome to **apm-hub** v2.0.0 👋');

    expect(result).toBe(false);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('returns false and warns when AUTO markers are missing', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readFileSync = vi.fn().mockReturnValue('# Overview\n\nNo markers here.\n');

    const result = updateFileBlock(FILE_PATH, 'version', 'Welcome to **apm-hub** v2.0.0 👋');

    expect(result).toBe(false);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
});
