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
  });
});
