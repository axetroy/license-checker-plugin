import { ReportFormatter } from '../../src/formatter/ReportFormatter';
import { OutputItem } from '../../src/model/LicenseInfo';

const sampleItems: OutputItem[] = [
  {
    package: {
      name: 'lodash',
      version: '4.17.21',
      path: '/node_modules/lodash',
      packageJsonPath: '/node_modules/lodash/package.json',
      chunks: ['main', 'vendor'],
      modules: [],
    },
    license: {
      license: 'MIT',
      repository: 'https://github.com/lodash/lodash',
      author: 'John-David Dalton <john@example.com>',
      licenseText: 'MIT License\nCopyright lodash',
    },
  },
];

describe('ReportFormatter', () => {
  it('generates valid JSON array with chunks included', () => {
    const formatter = new ReportFormatter();
    const result = formatter.generate(sampleItems);
    const parsed = JSON.parse(result) as Array<{ name: string; chunks: string[] }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe('lodash');
    expect(parsed[0].chunks).toEqual(['main', 'vendor']);
  });

  it('includes license text in report', () => {
    const formatter = new ReportFormatter();
    const result = formatter.generate(sampleItems);
    const parsed = JSON.parse(result) as Array<{ licenseText: string }>;
    expect(parsed[0].licenseText).toContain('MIT License');
  });

  it('returns empty array for no items', () => {
    const formatter = new ReportFormatter();
    const result = formatter.generate([]);
    expect(JSON.parse(result)).toEqual([]);
  });
});
