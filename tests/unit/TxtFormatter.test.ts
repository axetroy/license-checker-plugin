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
      author: 'Meta Open Source <opensource@meta.com>',
      licenseText: 'MIT License\nCopyright (c) Facebook',
    },
  },
];

describe('TxtFormatter', () => {
  it('generates txt output with license text by default', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate(sampleItems);
    expect(result).toContain('# THIRD-PARTY LICENSES');
    expect(result).toContain('Package Name : react');
    expect(result).toContain('Version      : 18.0.0');
    expect(result).toContain('License      : MIT');
    expect(result).toContain('Repository   : https://github.com/facebook/react');
    expect(result).toContain('Author       : Meta Open Source <a>opensource@meta.com</a>');
    expect(result).toContain('License Text:');
    expect(result).toContain('MIT License');
  });

  it('omits license text when includeLicenseText is false', () => {
    const formatter = new TxtFormatter({ includeLicenseText: false });
    const result = formatter.generate(sampleItems);
    expect(result).toContain('Package Name : react');
    expect(result).not.toContain('License Text:');
    expect(result).not.toContain('MIT License\nCopyright');
  });

  it('handles empty items', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([]);
    expect(result).toContain('# THIRD-PARTY LICENSES');
  });

  it('outputs plain author string when no email exists', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([
      {
        ...sampleItems[0],
        license: {
          ...sampleItems[0].license,
          author: 'Meta Open Source Team',
        },
      },
    ]);
    expect(result).toContain('Author       : Meta Open Source Team');
  });

  it('normalizes author email with extra whitespace inside brackets', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([
      {
        ...sampleItems[0],
        license: {
          ...sampleItems[0].license,
          author: 'Example Maintainer <   maintainer@example.com   >',
        },
      },
    ]);
    expect(result).toContain('Author       : Example Maintainer <a>maintainer@example.com</a>');
  });

  it('formats author email even without whitespace before angle brackets', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([
      {
        ...sampleItems[0],
        license: {
          ...sampleItems[0].license,
          author: 'Example<example@example.com>',
        },
      },
    ]);
    expect(result).toContain('Author       : Example <a>example@example.com</a>');
  });
});
