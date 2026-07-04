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
      repository: 'https://github.com/facebook/react',
      author: 'Meta Open Source <opensource@meta.com>',
    },
    license: {
      license: 'MIT',
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
    expect(result).toContain('Author       : Meta Open Source <opensource@meta.com>');
    expect(result).toContain('License Text:');
    expect(result).toContain('MIT License');
    expect(result).toMatchSnapshot();
  });

  it('omits license text when includeLicenseText is false', () => {
    const formatter = new TxtFormatter({ includeLicenseText: false });
    const result = formatter.generate(sampleItems);
    expect(result).toContain('Package Name : react');
    expect(result).not.toContain('License Text:');
    expect(result).not.toContain('MIT License\nCopyright');
    expect(result).toMatchSnapshot();
  });

  it('handles empty items', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([]);
    expect(result).toContain('# THIRD-PARTY LICENSES');
    expect(result).toMatchSnapshot();
  });

  it('outputs plain author string when no email exists', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([
      {
        ...sampleItems[0],
        package: {
          ...sampleItems[0].package,
          author: 'Meta Open Source Team',
        },
      },
    ]);
    expect(result).toContain('Author       : Meta Open Source Team');
    expect(result).toMatchSnapshot();
  });

  it('normalizes author email with extra whitespace inside brackets', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([
      {
        ...sampleItems[0],
        package: {
          ...sampleItems[0].package,
          author: 'Example Maintainer <   maintainer@example.com   >',
        },
      },
    ]);
    expect(result).toContain('Author       : Example Maintainer <maintainer@example.com>');
    expect(result).toMatchSnapshot();
  });

  it('formats author email even without whitespace before angle brackets', () => {
    const formatter = new TxtFormatter();
    const result = formatter.generate([
      {
        ...sampleItems[0],
        package: {
          ...sampleItems[0].package,
          author: 'Example<example@example.com>',
        },
      },
    ]);
    expect(result).toContain('Author       : Example <example@example.com>');
    expect(result).toMatchSnapshot();
  });
});
