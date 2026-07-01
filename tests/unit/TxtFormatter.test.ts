import { TxtFormatter } from '../../src/formatter/TxtFormatter';
import { OutputItem } from '../../src/model/LicenseInfo';

const sampleItems: OutputItem[] = [
  {
    package: {
      name: 'react',
      version: '18.0.0',
      path: '/node_modules/react',
      packageJsonPath: '/node_modules/react/package.json',
      chunks: ['main'],
      modules: ['/node_modules/react/index.js'],
    },
    license: {
      license: 'MIT',
      repository: 'https://github.com/facebook/react',
      licenseText: 'MIT License\nCopyright (c) Facebook',
    },
  },
];

describe('TxtFormatter', () => {
  it('generates txt output with correct header', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate(sampleItems);
    expect(result).toContain('# THIRD-PARTY LICENSES');
  });

  it('generates aligned labels', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate(sampleItems);
    expect(result).toContain('Package Name : react');
    expect(result).toContain('Version      : 18.0.0');
    expect(result).toContain('License      : MIT');
    expect(result).toContain('Repository   : https://github.com/facebook/react');
  });

  it('includes license text block by default', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate(sampleItems);
    expect(result).toContain('License Text :');
    expect(result).toContain('MIT License');
  });

  it('omits license text when includeLicenseText is false', () => {
    const formatter = new TxtFormatter({ includeLicenseText: false });
    const result = formatter.generate(sampleItems);
    expect(result).toContain('Package Name : react');
    expect(result).not.toContain('License Text');
    expect(result).not.toContain('MIT License\nCopyright');
  });

  it('uses --- separator between multiple packages', () => {
    const items: OutputItem[] = [
      {
        package: {
          name: 'pkg-a',
          version: '1.0.0',
          path: '/node_modules/pkg-a',
          packageJsonPath: '/node_modules/pkg-a/package.json',
          chunks: ['main'],
          modules: [],
        },
        license: { license: 'MIT' },
      },
      {
        package: {
          name: 'pkg-b',
          version: '2.0.0',
          path: '/node_modules/pkg-b',
          packageJsonPath: '/node_modules/pkg-b/package.json',
          chunks: ['main'],
          modules: [],
        },
        license: { license: 'Apache-2.0' },
      },
    ];
    const formatter = new TxtFormatter({ includeLicenseText: false });
    const result = formatter.generate(items);
    expect(result).toContain('---');
    const parts = result.split('---');
    expect(parts.length).toBe(2);
    expect(parts[0]).toContain('pkg-a');
    expect(parts[1]).toContain('pkg-b');
  });

  it('formats author with email using <a> tags', () => {
    const items: OutputItem[] = [
      {
        package: {
          name: 'pkg',
          version: '1.0.0',
          path: '/node_modules/pkg',
          packageJsonPath: '/node_modules/pkg/package.json',
          chunks: ['main'],
          modules: [],
        },
        license: { license: 'MIT', author: 'afc163 <afc163@gmail.com>' },
      },
    ];
    const formatter = new TxtFormatter({ includeLicenseText: false });
    const result = formatter.generate(items);
    expect(result).toContain('Author       : afc163 <a>afc163@gmail.com</a>');
  });

  it('handles empty items', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([]);
    expect(result).toContain('# THIRD-PARTY LICENSES');
  });
});
