import { HtmlFormatter } from '../../src/formatter/HtmlFormatter.js';
import { OutputItem } from '../../src/model/LicenseInfo.js';

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
});
