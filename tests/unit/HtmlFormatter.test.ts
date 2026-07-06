import { HtmlFormatter } from '../../src/formatter/HtmlFormatter';
import { OutputItem } from '../../src/model/LicenseInfo';

const sampleItems: OutputItem[] = [
  {
    package: {
      name: 'vue',
      version: '3.0.0',
      path: '/node_modules/vue',
      packageJsonPath: '/node_modules/vue/package.json',
      chunks: [],
      modules: [],
    },
    license: { license: 'MIT', licenseText: 'MIT License\nCopyright (c) Evan You' },
  },
];

describe('HtmlFormatter', () => {
  it('generates html with table', () => {
    const formatter = new HtmlFormatter();
    const result = formatter.generate(sampleItems);
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('Third Party Licenses');
    expect(result).toContain('vue');
    expect(result).toContain('MIT');
    expect(result).toMatchSnapshot();
  });

  it('escapes html characters', () => {
    const formatter = new HtmlFormatter();
    const items: OutputItem[] = [
      {
        package: { name: '<evil>', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT & GPL' },
      },
    ];
    const result = formatter.generate(items);
    expect(result).toContain('&lt;evil&gt;');
    expect(result).toContain('MIT &amp; GPL');
  });

  it('includes Direct column when present', () => {
    const formatter = new HtmlFormatter();
    const items: OutputItem[] = [
      {
        package: { name: 'lodash', version: '4.17.21', path: '', packageJsonPath: '', chunks: [], modules: [], direct: true },
        license: { license: 'MIT' },
      },
    ];
    const result = formatter.generate(items);
    expect(result).toContain('<th>Direct</th>');
    expect(result).toContain('<td>true</td>');
  });

  it('includes Dependency Path column when present', () => {
    const formatter = new HtmlFormatter();
    const items: OutputItem[] = [
      {
        package: { name: 'nested', version: '1.0.0', path: '', packageJsonPath: '', chunks: [], modules: [], dependencyPath: '/express@4.0.0' },
        license: { license: 'MIT' },
      },
    ];
    const result = formatter.generate(items);
    expect(result).toContain('<th>Dependency Path</th>');
    expect(result).toContain('<td><code>/express@4.0.0</code></td>');
  });

  it('wraps dependency path in code element', () => {
    const formatter = new HtmlFormatter();
    const items: OutputItem[] = [
      {
        package: { name: 'pkg', version: '1.0.0', path: '', packageJsonPath: '', chunks: [], modules: [], dependencyPath: '/' },
        license: { license: 'MIT' },
      },
    ];
    const result = formatter.generate(items);
    expect(result).toContain('<td><code>/</code></td>');
  });

  it('renders root dependency path as /', () => {
    const formatter = new HtmlFormatter();
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
    const result = formatter.generate(items);
    expect(result).toContain('<th>Direct</th>');
    expect(result).toContain('<th>Dependency Path</th>');
    expect(result).toContain('<td>true</td>');
    expect(result).toContain('<td>false</td>');
  });
});
