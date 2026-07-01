import { JsonFormatter } from '../../src/formatter/JsonFormatter';
import { OutputItem } from '../../src/model/LicenseInfo';

const sampleItems: OutputItem[] = [
  {
    package: {
      name: 'lodash',
      version: '4.17.21',
      path: '/node_modules/lodash',
      packageJsonPath: '/node_modules/lodash/package.json',
      chunks: ['main'],
      modules: [],
    },
    license: { license: 'MIT', repository: 'https://github.com/lodash/lodash' },
  },
];

describe('JsonFormatter', () => {
  it('generates valid JSON array', () => {
    const formatter = new JsonFormatter();
    const result = formatter.generate(sampleItems);
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe('lodash');
    expect(parsed[0].version).toBe('4.17.21');
    expect(parsed[0].license).toBe('MIT');
  });

  it('returns empty array for no items', () => {
    const formatter = new JsonFormatter();
    const result = formatter.generate([]);
    expect(JSON.parse(result)).toEqual([]);
  });
});
