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
});
