import { MarkdownFormatter } from '../../src/formatter/MarkdownFormatter';
import { OutputItem } from '../../src/model/LicenseInfo';

const sampleItems: OutputItem[] = [
  {
    package: {
      name: 'axios',
      version: '1.0.0',
      path: '/node_modules/axios',
      packageJsonPath: '/node_modules/axios/package.json',
      chunks: [],
      modules: [],
    },
    license: { license: 'MIT' },
  },
];

describe('MarkdownFormatter', () => {
  it('generates markdown table', () => {
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(sampleItems);
    expect(result).toContain('# Third Party Licenses');
    expect(result).toContain('| Package | Version | License |');
    expect(result).toContain('| axios | 1.0.0 | MIT |');
    expect(result).toMatchSnapshot();
  });

  it('returns header only for empty items', () => {
    const formatter = new MarkdownFormatter();
    const result = formatter.generate([]);
    expect(result).toContain('# Third Party Licenses');
    expect(result).toContain('| Package | Version | License |');
    // Check that separator row exists (may have different width now)
    expect(result).toMatch(/\|[-]+\|[-]+\|[-]+\|/);
    const rowCount = result.split('\n').filter(l => l.startsWith('| ')).length;
    expect(rowCount).toBe(1);
  });

  it('generates rows for multiple items', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'react', version: '18.0.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT' },
      },
      {
        package: { name: 'lodash', version: '4.17.21', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| react | 18.0.0 | MIT |');
    expect(result).toContain('| lodash | 4.17.21 | MIT |');
  });

  it('handles empty/missing version', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'unknown', version: '', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| unknown |  | MIT |');
  });

  it('output ends with newline', () => {
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(sampleItems);
    expect(result.endsWith('\n')).toBe(true);
  });

  it('escapes pipe character in package name to prevent table breakage', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'a|b', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    // Pipe should be escaped to prevent markdown table breakage
    expect(result).toContain('a\\|b');
    expect(result).not.toContain('| a|b |');
  });

  it('includes license text column when any item has licenseText', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'pkg-a', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT', licenseText: 'MIT License Text' },
      },
      {
        package: { name: 'pkg-b', version: '2.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'Apache-2.0' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| Package | Version | License | License Text |');
    expect(result).toContain('MIT License Text');
    expect(result).toMatchSnapshot();
  });

  it('escapes newlines in license text with <br>', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'pkg', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT', licenseText: 'Line1\nLine2\nLine3' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('Line1<br>Line2<br>Line3');
  });

  it('escapes HTML tags in license text to prevent XSS', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'pkg', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT', licenseText: '<script>alert("xss")</script>' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    // HTML should be escaped, not rendered as-is
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('escapes HTML entities in license text', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'pkg', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT', licenseText: 'Use &amp; abuse <b>bold</b>' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('Use &amp;amp; abuse &lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes pipe characters in license text to prevent table breakage', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'pkg', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT', licenseText: 'Value: A | B' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    // Pipe should be escaped to prevent markdown table breakage
    expect(result).toContain('Value: A \\| B');
    expect(result).not.toContain('| A | B |');
  });

  it('escapes double quotes in license text', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'pkg', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT', licenseText: 'Say "Hello"' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('&quot;Hello&quot;');
  });

  it('includes Direct column when present', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'lodash', version: '4.17.21', path: '', packageJsonPath: '', chunks: [], modules: [], direct: true },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| Package | Version | License | Direct |');
    expect(result).toContain('| lodash | 4.17.21 | MIT | true |');
  });

  it('includes Dependency Path column when present', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'nested', version: '1.0.0', path: '', packageJsonPath: '', chunks: [], modules: [], dependencyPath: '/express@4.0.0' },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| Package | Version | License | Dependency Path |');
    expect(result).toContain('| nested | 1.0.0 | MIT | /express@4.0.0 |');
  });

  it('includes both Direct and Dependency Path columns when both present', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'lodash', version: '4.17.21', path: '', packageJsonPath: '', chunks: [], modules: [], direct: true, dependencyPath: '/' },
        license: { license: 'MIT' },
      },
      {
        package: { name: 'nested', version: '1.0.0', path: '', packageJsonPath: '', chunks: [], modules: [], direct: false, dependencyPath: '/express@4.0.0' },
        license: { license: 'Apache-2.0' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| Package | Version | License | Direct | Dependency Path |');
    expect(result).toContain('| lodash | 4.17.21 | MIT | true | / |');
    expect(result).toContain('| nested | 1.0.0 | Apache-2.0 | false | /express@4.0.0 |');
  });
});
