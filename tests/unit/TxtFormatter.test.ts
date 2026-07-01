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
  it('generates txt output with license text by default', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate(sampleItems);
    expect(result).toContain('Third Party Licenses');
    expect(result).toContain('Package: react');
    expect(result).toContain('Version: 18.0.0');
    expect(result).toContain('License: MIT');
    expect(result).toContain('MIT License');
  });

  it('omits license text when includeLicenseText is false', () => {
    const formatter = new TxtFormatter({ includeLicenseText: false });
    const result = formatter.generate(sampleItems);
    expect(result).toContain('Package: react');
    expect(result).not.toContain('MIT License\nCopyright');
  });

  it('handles empty items', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([]);
    expect(result).toContain('Third Party Licenses');
  });
});
