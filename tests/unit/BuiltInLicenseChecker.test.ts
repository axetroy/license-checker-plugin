import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { builtInLicenseChecker } from '../../src/checker/BuiltInLicenseChecker';

describe('BuiltInLicenseChecker', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-checker-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createPackage(name: string, version: string, packageJson: Record<string, unknown>, licenseContent?: string) {
    const pkgDir = path.join(tempDir, 'node_modules', name);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      name,
      version,
      ...packageJson,
    }, null, 2));
    if (licenseContent) {
      fs.writeFileSync(path.join(pkgDir, 'LICENSE'), licenseContent);
    }
    return pkgDir;
  }

  describe('basic license detection', () => {
    it('detects MIT license from package.json', () => {
      createPackage('test-mit', '1.0.0', { license: 'MIT' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-mit@1.0.0']).toBeDefined();
      expect(packages['test-mit@1.0.0'].licenses).toBe('MIT');
    });

    it('detects Apache-2.0 license', () => {
      createPackage('test-apache', '2.0.0', { license: 'Apache-2.0' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-apache@2.0.0'].licenses).toBe('Apache-2.0');
    });

    it('detects BSD-3-Clause license', () => {
      createPackage('test-bsd', '3.0.0', { license: 'BSD-3-Clause' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-bsd@3.0.0'].licenses).toBe('BSD-3-Clause');
    });

    it('handles UNKNOWN license', () => {
      createPackage('test-unknown', '1.0.0', { license: 'UNKNOWN-LICENSE' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-unknown@1.0.0']).toBeDefined();
    });

    it('passes through "SEE LICENSE IN LICENSE" verbatim', () => {
      createPackage('test-see-license', '1.0.0', { license: 'SEE LICENSE IN LICENSE' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-see-license@1.0.0'].licenses).toBe('SEE LICENSE IN LICENSE');
    });

    it('passes through "UNLICENSED" verbatim', () => {
      createPackage('test-unlicensed', '1.0.0', { license: 'UNLICENSED' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-unlicensed@1.0.0'].licenses).toBe('UNLICENSED');
    });

    it('passes through "Proprietary" verbatim', () => {
      createPackage('test-proprietary', '1.0.0', { license: 'Proprietary' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-proprietary@1.0.0'].licenses).toBe('Proprietary');
    });

    it('passes through custom license string verbatim', () => {
      createPackage('test-custom', '1.0.0', { license: 'Custom' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-custom@1.0.0'].licenses).toBe('Custom');
    });

    it('treats empty license string as undefined (falsy check in getLicenseString)', () => {
      createPackage('test-empty-license', '1.0.0', { license: '' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-empty-license@1.0.0'].licenses).toBeUndefined();
    });

    it('handles multiple licenses (array)', () => {
      createPackage('test-multi', '1.0.0', { licenses: ['MIT', 'Apache-2.0'] });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-multi@1.0.0'].licenses).toEqual(['MIT', 'Apache-2.0']);
    });

    it('handles SPDX compound license expression', () => {
      createPackage('test-compound', '1.0.0', { license: '(MIT OR Apache-2.0)' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-compound@1.0.0'].licenses).toBe('(MIT OR Apache-2.0)');
    });

    it('handles license with { type } object syntax', () => {
      createPackage('test-obj-license', '1.0.0', { license: { type: 'MIT' } });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-obj-license@1.0.0'].licenses).toBe('MIT');
    });

    it('handles ISC license', () => {
      createPackage('test-isc', '1.0.0', { license: 'ISC' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-isc@1.0.0'].licenses).toBe('ISC');
    });

    it('handles Unlicense', () => {
      createPackage('test-unlicense', '1.0.0', { license: 'Unlicense' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-unlicense@1.0.0'].licenses).toBe('Unlicense');
    });

    it('handles GPL-3.0 license', () => {
      createPackage('test-gpl', '1.0.0', { license: 'GPL-3.0' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-gpl@1.0.0'].licenses).toBe('GPL-3.0');
    });
  });

  describe('scoped packages', () => {
    it('detects scoped packages', () => {
      const scopeDir = path.join(tempDir, 'node_modules', '@test', 'scoped-pkg');
      fs.mkdirSync(scopeDir, { recursive: true });
      fs.writeFileSync(path.join(scopeDir, 'package.json'), JSON.stringify({
        name: '@test/scoped-pkg',
        version: '1.0.0',
        license: 'MIT',
      }));
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['@test/scoped-pkg@1.0.0']).toBeDefined();
      expect(packages['@test/scoped-pkg@1.0.0'].licenses).toBe('MIT');
    });

    it('detects multiple scoped packages under same scope', () => {
      for (const name of ['@scope/foo', '@scope/bar']) {
        const dir = path.join(tempDir, 'node_modules', ...name.split('/'));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
          name,
          version: '1.0.0',
          license: 'MIT',
        }));
      }
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['@scope/foo@1.0.0']).toBeDefined();
      expect(packages['@scope/bar@1.0.0']).toBeDefined();
    });
  });

  describe('license file detection', () => {
    it('finds LICENSE file', () => {
      createPackage('test-license-file', '1.0.0', {}, 'MIT License Content');
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-license-file@1.0.0'].licenseFile).toBeDefined();
    });

    it('reads license text when customFormat.licenseText is true', () => {
      const licenseContent = 'MIT License\nPermission is hereby granted...';
      createPackage('test-license-text', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-license-text@1.0.0'].licenseText).toBe(licenseContent);
    });

    it('does not read license text when customFormat.licenseText is false', () => {
      createPackage('test-no-license-text', '1.0.0', { license: 'MIT' }, 'Some content');
      const packages = builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: false } });
      expect(packages['test-no-license-text@1.0.0'].licenseText).toBeUndefined();
    });

    it('does not read license text when customFormat.licenseText is not set', () => {
      createPackage('test-no-format', '1.0.0', { license: 'MIT' }, 'MIT License');
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-no-format@1.0.0'].licenseText).toBeUndefined();
    });

    it('finds LICENSE-MIT file', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'license-mit');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'license-mit', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'LICENSE-MIT'), 'MIT License Text');
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['license-mit@1.0.0'].licenseFile).toMatch(/LICENSE-MIT$/);
    });

    it('finds Licence file (alternative spelling)', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'licence-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'licence-pkg', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'Licence'), 'MIT License');
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['licence-pkg@1.0.0'].licenseFile).toMatch(/Licence$/);
    });

    it('finds COPYING file', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'copying-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'copying-pkg', version: '1.0.0', license: 'GPL-2.0' }));
      fs.writeFileSync(path.join(pkgDir, 'COPYING'), 'GPL License');
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['copying-pkg@1.0.0'].licenseFile).toMatch(/COPYING$/);
    });

    it('prefers LICENSE over other license file names', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'multi-license');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'multi-license', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'LICENSE-MIT'), 'MIT');
      fs.writeFileSync(path.join(pkgDir, 'LICENSE'), 'MIT License');
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['multi-license@1.0.0'].licenseFile).toMatch(/LICENSE$/);
    });

    it('returns undefined licenseFile when no license file exists', () => {
      createPackage('no-license-file', '1.0.0', { license: 'MIT' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['no-license-file@1.0.0'].licenseFile).toBeUndefined();
    });
  });

  describe('copyright extraction', () => {
    it('extracts copyright from license file', () => {
      const licenseContent = `MIT License

Copyright (c) 2024 Test Author

Permission is hereby granted...`;
      createPackage('test-copyright', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-copyright@1.0.0'].copyright).toBeDefined();
      expect(packages['test-copyright@1.0.0'].copyright).toContain('2024');
    });

    it('extracts copyright with year range', () => {
      const licenseContent = `MIT License

Copyright (c) 2020-2024 Test Author

Permission is hereby granted...`;
      createPackage('test-copyright-range', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-copyright-range@1.0.0'].copyright).toContain('2020-2024');
    });

    it('extracts copyright with © symbol', () => {
      const licenseContent = `MIT License

© 2024 Test Author

Permission is hereby granted...`;
      createPackage('test-copyright-symbol', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-copyright-symbol@1.0.0'].copyright).toContain('2024');
    });

    it('returns undefined copyright when no copyright line exists', () => {
      const licenseContent = `MIT License

Permission is hereby granted, free of charge, to any person...`;
      createPackage('test-no-copyright', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-no-copyright@1.0.0'].copyright).toBeUndefined();
    });

    it('extracts copyright with copyright (c) notation (with space)', () => {
      const licenseContent = `BSD License

Copyright (c) 2023 The Author

Redistribution and use...`;
      createPackage('test-copyright-c', '1.0.0', { license: 'BSD-3-Clause' }, licenseContent);
      const packages = builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-copyright-c@1.0.0'].copyright).toContain('2023');
    });
  });

  describe('repository URL normalization', () => {
    it('normalizes git+https URL', () => {
      createPackage('test-repo-https', '1.0.0', { repository: 'git+https://github.com/test/repo.git' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-https@1.0.0'].repository).toBe('https://github.com/test/repo');
    });

    it('normalizes git URL', () => {
      createPackage('test-repo-git', '1.0.0', { repository: 'git://github.com/test/repo.git' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-git@1.0.0'].repository).toBe('https://github.com/test/repo');
    });

    it('normalizes git+ssh URL', () => {
      createPackage('test-repo-ssh', '1.0.0', { repository: 'git+ssh://git@github.com:test/repo.git' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-ssh@1.0.0'].repository).toBe('https://github.com/test/repo');
    });

    it('handles repository as object with url field', () => {
      createPackage('test-repo-obj', '1.0.0', { repository: { type: 'git', url: 'https://github.com/test/repo.git' } });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-obj@1.0.0'].repository).toBe('https://github.com/test/repo');
    });

    it('handles shorthand repository (user/repo)', () => {
      createPackage('test-repo-shorthand', '1.0.0', { repository: 'visionmedia/debug' });
      const packages = builtInLicenseChecker({ start: tempDir });
      // Shorthand formats like "user/repo" are not normalized further
      expect(packages['test-repo-shorthand@1.0.0'].repository).toBe('visionmedia/debug');
    });

    it('returns undefined for missing repository', () => {
      createPackage('test-no-repo', '1.0.0', { license: 'MIT' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-no-repo@1.0.0'].repository).toBeUndefined();
    });
  });

  describe('author parsing', () => {
    it('parses author string with email', () => {
      createPackage('test-author-email', '1.0.0', { license: 'MIT', author: 'Test Author <test@example.com>' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-email@1.0.0'].publisher).toBe('Test Author');
      expect(packages['test-author-email@1.0.0'].email).toBe('test@example.com');
    });

    it('parses author string without email', () => {
      createPackage('test-author-noemail', '1.0.0', { license: 'MIT', author: 'Test Author' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-noemail@1.0.0'].publisher).toBe('Test Author');
      expect(packages['test-author-noemail@1.0.0'].email).toBeUndefined();
    });

    it('parses author object with name and email', () => {
      createPackage('test-author-obj', '1.0.0', { license: 'MIT', author: { name: 'Test Author', email: 'test@example.com' } });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-obj@1.0.0'].publisher).toBe('Test Author');
      expect(packages['test-author-obj@1.0.0'].email).toBe('test@example.com');
    });

    it('parses author object with only name', () => {
      createPackage('test-author-only-name', '1.0.0', { license: 'MIT', author: { name: 'Just Name' } });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-only-name@1.0.0'].publisher).toBe('Just Name');
      expect(packages['test-author-only-name@1.0.0'].email).toBeUndefined();
    });

    it('returns undefined publisher/email when author is missing', () => {
      createPackage('test-no-author', '1.0.0', { license: 'MIT' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-no-author@1.0.0'].publisher).toBeUndefined();
      expect(packages['test-no-author@1.0.0'].email).toBeUndefined();
    });

    it('handles author wrapped entirely in angle brackets', () => {
      createPackage('test-author-bracket', '1.0.0', { license: 'MIT', author: '<user@example.com>' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-bracket@1.0.0'].publisher).toBe('<user@example.com>');
      expect(packages['test-author-bracket@1.0.0'].email).toBeUndefined();
    });
  });

  describe('excludePrivatePackages option', () => {
    it('excludes packages with private: true when excludePrivatePackages is true', () => {
      createPackage('private-pkg', '1.0.0', { license: 'MIT', private: true });
      createPackage('public-pkg', '1.0.0', { license: 'MIT' });
      const packages = builtInLicenseChecker({ start: tempDir, excludePrivatePackages: true });
      expect(packages['private-pkg@1.0.0']).toBeUndefined();
      expect(packages['public-pkg@1.0.0']).toBeDefined();
    });

    it('includes packages without private: true when excludePrivatePackages is true', () => {
      createPackage('public-pkg', '1.0.0', { license: 'MIT' });
      createPackage('@scope/public-pkg', '1.0.0', { license: 'MIT' });
      const packages = builtInLicenseChecker({ start: tempDir, excludePrivatePackages: true });
      expect(packages['public-pkg@1.0.0']).toBeDefined();
      expect(packages['@scope/public-pkg@1.0.0']).toBeDefined();
    });

    it('includes scoped packages when excludePrivatePackages is false', () => {
      const scopeDir = path.join(tempDir, 'node_modules', '@private', 'private-pkg');
      fs.mkdirSync(scopeDir, { recursive: true });
      fs.writeFileSync(path.join(scopeDir, 'package.json'), JSON.stringify({
        name: '@private/private-pkg',
        version: '1.0.0',
        license: 'MIT',
      }));
      const packages = builtInLicenseChecker({ start: tempDir, excludePrivatePackages: false });
      expect(packages['@private/private-pkg@1.0.0']).toBeDefined();
    });
  });

  describe('private package field', () => {
    it('sets private to true when package.json has private: true', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'internal-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
        name: 'internal-pkg',
        version: '1.0.0',
        license: 'MIT',
        private: true,
      }));
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['internal-pkg@1.0.0'].private).toBe(true);
    });

    it('sets private to false when package.json does not have private field', () => {
      createPackage('public-pkg', '1.0.0', { license: 'MIT' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['public-pkg@1.0.0'].private).toBe(false);
    });
  });

  describe('error handling', () => {
    it('throws for non-existent path', () => {
      expect(() => builtInLicenseChecker({ start: '/non/existent/path' })).toThrow('does not exist');
    });

    it('handles package.json without license field', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'no-license-field');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
        name: 'no-license-field',
        version: '1.0.0',
      }));
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['no-license-field@1.0.0']).toBeDefined();
      expect(packages['no-license-field@1.0.0'].licenses).toBeUndefined();
    });

    it('handles malformed package.json gracefully', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'malformed-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), 'not valid json');
      // Malformed package.json is skipped, no error thrown
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['malformed-pkg@1.0.0']).toBeUndefined();
    });
  });

  describe('homepage field', () => {
    it('extracts homepage as url', () => {
      createPackage('test-homepage', '1.0.0', { license: 'MIT', homepage: 'https://example.com' });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['test-homepage@1.0.0'].url).toBe('https://example.com');
    });
  });

  describe('multiple packages', () => {
    it('detects multiple packages in node_modules', () => {
      createPackage('pkg-a', '1.0.0', { license: 'MIT' });
      createPackage('pkg-b', '2.0.0', { license: 'Apache-2.0' });
      createPackage('pkg-c', '3.0.0', { license: 'ISC' });
      const packages = builtInLicenseChecker({ start: tempDir });
      const keys = Object.keys(packages);
      expect(keys).toContain('pkg-a@1.0.0');
      expect(keys).toContain('pkg-b@2.0.0');
      expect(keys).toContain('pkg-c@3.0.0');
      expect(keys.length).toBe(3);
    });
  });

  describe('empty node_modules', () => {
    it('returns empty packages when node_modules is empty', () => {
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages).toEqual({});
    });

    it('returns empty packages when node_modules does not exist', () => {
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages).toEqual({});
    });
  });

  describe('package without version', () => {
    it('uses 0.0.0 as default version', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'noversion');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'noversion', license: 'MIT' }));
      const packages = builtInLicenseChecker({ start: tempDir });
      expect(packages['noversion@0.0.0']).toBeDefined();
      expect(packages['noversion@0.0.0'].version).toBe('0.0.0');
    });
  });
});
