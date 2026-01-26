import { parseFrontmatter, getTitle } from './template-list-generator';

describe('template-list-generator helpers', () => {
  describe('parseFrontmatter', () => {
    it('should parse simple frontmatter', () => {
      const content = '---\nkey: value\nname: "Test Name"\n---';
      const fm = parseFrontmatter(content);
      expect(fm).toEqual({
        key: 'value',
        name: 'Test Name',
      });
    });

    it('should handle quoted values', () => {
      const content = '---\ndescription: \'A description with "quotes"\'\n---';
      const fm = parseFrontmatter(content);
      expect(fm).toEqual({
        description: 'A description with "quotes"',
      });
    });

    it('should return empty object if no frontmatter', () => {
      const content = '# No Frontmatter';
      const fm = parseFrontmatter(content);
      expect(fm).toEqual({});
    });

    it('should handle colon in values', () => {
      const content = '---\nurl: https://example.com\n---';
      const fm = parseFrontmatter(content);
      expect(fm).toEqual({
        url: 'https://example.com',
      });
    });
  });

  describe('getTitle', () => {
    it('should extract title from H1', () => {
      const content = '# My Title\nSome content';
      expect(getTitle(content, 'file.md')).toBe('My Title');
    });

    it('should return filename if no H1 found', () => {
      const content = 'Some content without H1';
      expect(getTitle(content, 'file.md')).toBe('file.md');
    });

    it('should find H1 even if not on first line', () => {
      const content = '---\nfm: true\n---\n\n# Real Title';
      expect(getTitle(content, 'file.md')).toBe('Real Title');
    });
  });
});
