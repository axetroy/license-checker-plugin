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
      repository: 'https://github.com/lodash/lodash',
    },
    license: { license: 'MIT' },
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
    expect(result).toMatchSnapshot();
  });

  it('returns empty array for no items', () => {
    const formatter = new JsonFormatter();
    const result = formatter.generate([]);
    expect(JSON.parse(result)).toEqual([]);
    expect(result).toMatchSnapshot();
  });

  it('includes licenseText when present', () => {
    const items: OutputItem[] = [
      {
        package: {
          name: 'react',
          version: '18.0.0',
          path: '',
          packageJsonPath: '',
          chunks: [],
          modules: [],
        },
        license: { license: 'MIT', licenseText: 'MIT License Text' },
      },
    ];
    const formatter = new JsonFormatter();
    const result = formatter.generate(items);
    const parsed = JSON.parse(result);
    expect(parsed[0].licenseText).toBe('MIT License Text');
    expect(result).toMatchSnapshot();
  });

  it('omits licenseText when not present', () => {
    const items: OutputItem[] = [
      {
        package: {
          name: 'lodash',
          version: '4.17.21',
          path: '',
          packageJsonPath: '',
          chunks: [],
          modules: [],
        },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new JsonFormatter();
    const result = formatter.generate(items);
    const parsed = JSON.parse(result);
    expect(parsed[0].licenseText).toBeUndefined();
  });

  it('includes direct field when present', () => {
    const items: OutputItem[] = [
      {
        package: {
          name: 'lodash',
          version: '4.17.21',
          path: '',
          packageJsonPath: '',
          chunks: [],
          modules: [],
          direct: true,
        },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new JsonFormatter();
    const result = formatter.generate(items);
    const parsed = JSON.parse(result);
    expect(parsed[0].direct).toBe(true);
  });

  it('includes dependencyPath field when present', () => {
    const items: OutputItem[] = [
      {
        package: {
          name: 'nested-pkg',
          version: '1.0.0',
          path: '',
          packageJsonPath: '',
          chunks: [],
          modules: [],
          dependencyPath: '/parent@2.0.0',
        },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new JsonFormatter();
    const result = formatter.generate(items);
    const parsed = JSON.parse(result);
    expect(parsed[0].dependencyPath).toBe('/parent@2.0.0');
  });

  it('includes both direct and dependencyPath fields', () => {
    const items: OutputItem[] = [
      {
        package: {
          name: 'lodash',
          version: '4.17.21',
          path: '',
          packageJsonPath: '',
          chunks: [],
          modules: [],
          direct: true,
          dependencyPath: '/',
        },
        license: { license: 'MIT' },
      },
      {
        package: {
          name: 'nested',
          version: '1.0.0',
          path: '',
          packageJsonPath: '',
          chunks: [],
          modules: [],
          direct: false,
          dependencyPath: '/express@4.0.0',
        },
        license: { license: 'Apache-2.0' },
      },
    ];
    const formatter = new JsonFormatter();
    const result = formatter.generate(items);
    const parsed = JSON.parse(result);
    expect(parsed[0].direct).toBe(true);
    expect(parsed[0].dependencyPath).toBe('/');
    expect(parsed[1].direct).toBe(false);
    expect(parsed[1].dependencyPath).toBe('/express@4.0.0');
  });
});
