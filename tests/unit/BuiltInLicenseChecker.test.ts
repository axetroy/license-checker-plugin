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
    it('detects MIT license from package.json', async () => {
      createPackage('test-mit', '1.0.0', { license: 'MIT' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-mit@1.0.0']).toBeDefined();
      expect(packages['test-mit@1.0.0'].licenses).toBe('MIT');
    });

    it('detects Apache-2.0 license', async () => {
      createPackage('test-apache', '2.0.0', { license: 'Apache-2.0' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-apache@2.0.0'].licenses).toBe('Apache-2.0');
    });

    it('detects BSD-3-Clause license', async () => {
      createPackage('test-bsd', '3.0.0', { license: 'BSD-3-Clause' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-bsd@3.0.0'].licenses).toBe('BSD-3-Clause');
    });

    it('handles UNKNOWN license', async () => {
      createPackage('test-unknown', '1.0.0', { license: 'UNKNOWN-LICENSE' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-unknown@1.0.0']).toBeDefined();
    });

    it('passes through "SEE LICENSE IN LICENSE" verbatim', async () => {
      createPackage('test-see-license', '1.0.0', { license: 'SEE LICENSE IN LICENSE' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-see-license@1.0.0'].licenses).toBe('SEE LICENSE IN LICENSE');
    });

    it('passes through "UNLICENSED" verbatim', async () => {
      createPackage('test-unlicensed', '1.0.0', { license: 'UNLICENSED' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-unlicensed@1.0.0'].licenses).toBe('UNLICENSED');
    });

    it('passes through "Proprietary" verbatim', async () => {
      createPackage('test-proprietary', '1.0.0', { license: 'Proprietary' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-proprietary@1.0.0'].licenses).toBe('Proprietary');
    });

    it('passes through custom license string verbatim', async () => {
      createPackage('test-custom', '1.0.0', { license: 'Custom' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-custom@1.0.0'].licenses).toBe('Custom');
    });

    it('treats empty license string as undefined', async () => {
      createPackage('test-empty-license', '1.0.0', { license: '' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-empty-license@1.0.0'].licenses).toBeUndefined();
    });

    it('handles multiple licenses (array)', async () => {
      createPackage('test-multi', '1.0.0', { licenses: ['MIT', 'Apache-2.0'] });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-multi@1.0.0'].licenses).toEqual(['MIT', 'Apache-2.0']);
    });

    it('handles SPDX compound license expression', async () => {
      createPackage('test-compound', '1.0.0', { license: '(MIT OR Apache-2.0)' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-compound@1.0.0'].licenses).toBe('(MIT OR Apache-2.0)');
    });

    it('handles license with { type } object syntax', async () => {
      createPackage('test-obj-license', '1.0.0', { license: { type: 'MIT' } });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-obj-license@1.0.0'].licenses).toBe('MIT');
    });

    it('handles ISC license', async () => {
      createPackage('test-isc', '1.0.0', { license: 'ISC' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-isc@1.0.0'].licenses).toBe('ISC');
    });

    it('handles Unlicense', async () => {
      createPackage('test-unlicense', '1.0.0', { license: 'Unlicense' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-unlicense@1.0.0'].licenses).toBe('Unlicense');
    });

    it('handles GPL-3.0 license', async () => {
      createPackage('test-gpl', '1.0.0', { license: 'GPL-3.0' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-gpl@1.0.0'].licenses).toBe('GPL-3.0');
    });
  });

  describe('scoped packages', () => {
    it('detects scoped packages', async () => {
      const scopeDir = path.join(tempDir, 'node_modules', '@test', 'scoped-pkg');
      fs.mkdirSync(scopeDir, { recursive: true });
      fs.writeFileSync(path.join(scopeDir, 'package.json'), JSON.stringify({
        name: '@test/scoped-pkg',
        version: '1.0.0',
        license: 'MIT',
      }));
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['@test/scoped-pkg@1.0.0']).toBeDefined();
      expect(packages['@test/scoped-pkg@1.0.0'].licenses).toBe('MIT');
    });

    it('detects multiple scoped packages under same scope', async () => {
      for (const name of ['@scope/foo', '@scope/bar']) {
        const dir = path.join(tempDir, 'node_modules', ...name.split('/'));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', license: 'MIT' }));
      }
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['@scope/foo@1.0.0']).toBeDefined();
      expect(packages['@scope/bar@1.0.0']).toBeDefined();
    });
  });

  describe('license file detection', () => {
    it('finds LICENSE file', async () => {
      createPackage('test-license-file', '1.0.0', {}, 'MIT License Content');
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-license-file@1.0.0'].licenseFile).toBeDefined();
    });

    it('reads license text when customFormat.licenseText is true', async () => {
      const licenseContent = 'MIT License\nPermission is hereby granted...';
      createPackage('test-license-text', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = await builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-license-text@1.0.0'].licenseText).toBe(licenseContent);
    });

    it('does not read license text when customFormat.licenseText is false', async () => {
      createPackage('test-no-license-text', '1.0.0', { license: 'MIT' }, 'Some content');
      const packages = await builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: false } });
      expect(packages['test-no-license-text@1.0.0'].licenseText).toBeUndefined();
    });

    it('does not read license text when customFormat.licenseText is not set', async () => {
      createPackage('test-no-format', '1.0.0', { license: 'MIT' }, 'MIT License');
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-no-format@1.0.0'].licenseText).toBeUndefined();
    });

    it('finds LICENSE-MIT file', async () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'license-mit');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'license-mit', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'LICENSE-MIT'), 'MIT License Text');
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['license-mit@1.0.0'].licenseFile).toMatch(/LICENSE-MIT$/);
    });

    it('finds Licence file (alternative spelling)', async () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'licence-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'licence-pkg', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'Licence'), 'MIT License');
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['licence-pkg@1.0.0'].licenseFile).toMatch(/Licence$/);
    });

    it('finds COPYING file', async () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'copying-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'copying-pkg', version: '1.0.0', license: 'GPL-2.0' }));
      fs.writeFileSync(path.join(pkgDir, 'COPYING'), 'GPL License');
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['copying-pkg@1.0.0'].licenseFile).toMatch(/COPYING$/);
    });

    it('prefers LICENSE over other license file names', async () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'multi-license');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'multi-license', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'LICENSE-MIT'), 'MIT');
      fs.writeFileSync(path.join(pkgDir, 'LICENSE'), 'MIT License');
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['multi-license@1.0.0'].licenseFile).toMatch(/LICENSE$/);
    });

    it('returns undefined licenseFile when no license file exists', async () => {
      createPackage('no-license-file', '1.0.0', { license: 'MIT' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['no-license-file@1.0.0'].licenseFile).toBeUndefined();
    });
  });

  describe('copyright extraction', () => {
    it('extracts copyright from license file', async () => {
      const licenseContent = `MIT License\n\nCopyright (c) 2024 Test Author\n\nPermission is hereby granted...`;
      createPackage('test-copyright', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = await builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-copyright@1.0.0'].copyright).toBeDefined();
      expect(packages['test-copyright@1.0.0'].copyright).toContain('2024');
    });

    it('extracts copyright with year range', async () => {
      const licenseContent = `MIT License\n\nCopyright (c) 2020-2024 Test Author\n\nPermission is hereby granted...`;
      createPackage('test-copyright-range', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = await builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-copyright-range@1.0.0'].copyright).toContain('2020-2024');
    });

    it('extracts copyright with © symbol', async () => {
      const licenseContent = `MIT License\n\n© 2024 Test Author\n\nPermission is hereby granted...`;
      createPackage('test-copyright-symbol', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = await builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-copyright-symbol@1.0.0'].copyright).toContain('2024');
    });

    it('returns undefined copyright when no copyright line exists', async () => {
      const licenseContent = `MIT License\n\nPermission is hereby granted, free of charge, to any person...`;
      createPackage('test-no-copyright', '1.0.0', { license: 'MIT' }, licenseContent);
      const packages = await builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-no-copyright@1.0.0'].copyright).toBeUndefined();
    });

    it('extracts copyright with copyright (c) notation', async () => {
      const licenseContent = `BSD License\n\nCopyright (c) 2023 The Author\n\nRedistribution and use...`;
      createPackage('test-copyright-c', '1.0.0', { license: 'BSD-3-Clause' }, licenseContent);
      const packages = await builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } });
      expect(packages['test-copyright-c@1.0.0'].copyright).toContain('2023');
    });
  });

  describe('repository URL normalization', () => {
    it('normalizes git+https URL', async () => {
      createPackage('test-repo-https', '1.0.0', { repository: 'git+https://github.com/test/repo.git' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-https@1.0.0'].repository).toBe('https://github.com/test/repo');
    });

    it('normalizes git URL', async () => {
      createPackage('test-repo-git', '1.0.0', { repository: 'git://github.com/test/repo.git' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-git@1.0.0'].repository).toBe('https://github.com/test/repo');
    });

    it('normalizes git+ssh URL', async () => {
      createPackage('test-repo-ssh', '1.0.0', { repository: 'git+ssh://git@github.com:test/repo.git' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-ssh@1.0.0'].repository).toBe('https://github.com/test/repo');
    });

    it('handles repository as object with url field', async () => {
      createPackage('test-repo-obj', '1.0.0', { repository: { type: 'git', url: 'https://github.com/test/repo.git' } });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-obj@1.0.0'].repository).toBe('https://github.com/test/repo');
    });

    it('handles shorthand repository (user/repo)', async () => {
      createPackage('test-repo-shorthand', '1.0.0', { repository: 'visionmedia/debug' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-repo-shorthand@1.0.0'].repository).toBe('visionmedia/debug');
    });

    it('returns undefined for missing repository', async () => {
      createPackage('test-no-repo', '1.0.0', { license: 'MIT' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-no-repo@1.0.0'].repository).toBeUndefined();
    });
  });

  describe('author parsing', () => {
    it('parses author string with email', async () => {
      createPackage('test-author-email', '1.0.0', { license: 'MIT', author: 'Test Author <test@example.com>' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-email@1.0.0'].publisher).toBe('Test Author');
      expect(packages['test-author-email@1.0.0'].email).toBe('test@example.com');
    });

    it('parses author string without email', async () => {
      createPackage('test-author-noemail', '1.0.0', { license: 'MIT', author: 'Test Author' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-noemail@1.0.0'].publisher).toBe('Test Author');
      expect(packages['test-author-noemail@1.0.0'].email).toBeUndefined();
    });

    it('parses author object with name and email', async () => {
      createPackage('test-author-obj', '1.0.0', { license: 'MIT', author: { name: 'Test Author', email: 'test@example.com' } });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-obj@1.0.0'].publisher).toBe('Test Author');
      expect(packages['test-author-obj@1.0.0'].email).toBe('test@example.com');
    });

    it('parses author object with only name', async () => {
      createPackage('test-author-only-name', '1.0.0', { license: 'MIT', author: { name: 'Just Name' } });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-only-name@1.0.0'].publisher).toBe('Just Name');
      expect(packages['test-author-only-name@1.0.0'].email).toBeUndefined();
    });

    it('returns undefined publisher/email when author is missing', async () => {
      createPackage('test-no-author', '1.0.0', { license: 'MIT' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-no-author@1.0.0'].publisher).toBeUndefined();
      expect(packages['test-no-author@1.0.0'].email).toBeUndefined();
    });

    it('handles author wrapped entirely in angle brackets', async () => {
      createPackage('test-author-bracket', '1.0.0', { license: 'MIT', author: '<user@example.com>' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-author-bracket@1.0.0'].publisher).toBe('<user@example.com>');
      expect(packages['test-author-bracket@1.0.0'].email).toBeUndefined();
    });
  });

  describe('excludePrivatePackages option', () => {
    it('excludes packages with private: true when excludePrivatePackages is true', async () => {
      createPackage('private-pkg', '1.0.0', { license: 'MIT', private: true });
      createPackage('public-pkg', '1.0.0', { license: 'MIT' });
      const packages = await builtInLicenseChecker({ start: tempDir, excludePrivatePackages: true });
      expect(packages['private-pkg@1.0.0']).toBeUndefined();
      expect(packages['public-pkg@1.0.0']).toBeDefined();
    });

    it('includes packages without private: true when excludePrivatePackages is true', async () => {
      createPackage('public-pkg', '1.0.0', { license: 'MIT' });
      createPackage('@scope/public-pkg', '1.0.0', { license: 'MIT' });
      const packages = await builtInLicenseChecker({ start: tempDir, excludePrivatePackages: true });
      expect(packages['public-pkg@1.0.0']).toBeDefined();
      expect(packages['@scope/public-pkg@1.0.0']).toBeDefined();
    });

    it('includes scoped packages when excludePrivatePackages is false', async () => {
      const scopeDir = path.join(tempDir, 'node_modules', '@private', 'private-pkg');
      fs.mkdirSync(scopeDir, { recursive: true });
      fs.writeFileSync(path.join(scopeDir, 'package.json'), JSON.stringify({
        name: '@private/private-pkg', version: '1.0.0', license: 'MIT',
      }));
      const packages = await builtInLicenseChecker({ start: tempDir, excludePrivatePackages: false });
      expect(packages['@private/private-pkg@1.0.0']).toBeDefined();
    });
  });

  describe('private package field', () => {
    it('sets private to true when package.json has private: true', async () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'internal-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
        name: 'internal-pkg', version: '1.0.0', license: 'MIT', private: true,
      }));
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['internal-pkg@1.0.0'].private).toBe(true);
    });

    it('sets private to false when package.json does not have private field', async () => {
      createPackage('public-pkg', '1.0.0', { license: 'MIT' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['public-pkg@1.0.0'].private).toBe(false);
    });
  });

  describe('error handling', () => {
    it('throws for non-existent path', async () => {
      await expect(builtInLicenseChecker({ start: '/non/existent/path' })).rejects.toThrow('does not exist');
    });

    it('handles package.json without license field', async () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'no-license-field');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'no-license-field', version: '1.0.0' }));
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['no-license-field@1.0.0']).toBeDefined();
      expect(packages['no-license-field@1.0.0'].licenses).toBeUndefined();
    });

    it('handles malformed package.json gracefully', async () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'malformed-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), 'not valid json');
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['malformed-pkg@1.0.0']).toBeUndefined();
    });
  });

  describe('homepage field', () => {
    it('extracts homepage as url', async () => {
      createPackage('test-homepage', '1.0.0', { license: 'MIT', homepage: 'https://example.com' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['test-homepage@1.0.0'].url).toBe('https://example.com');
    });
  });

  describe('multiple packages', () => {
    it('detects multiple packages in node_modules', async () => {
      createPackage('pkg-a', '1.0.0', { license: 'MIT' });
      createPackage('pkg-b', '2.0.0', { license: 'Apache-2.0' });
      createPackage('pkg-c', '3.0.0', { license: 'ISC' });
      const packages = await builtInLicenseChecker({ start: tempDir });
      const keys = Object.keys(packages);
      expect(keys).toContain('pkg-a@1.0.0');
      expect(keys).toContain('pkg-b@2.0.0');
      expect(keys).toContain('pkg-c@3.0.0');
      expect(keys.length).toBe(3);
    });
  });

  describe('nested node_modules detection', () => {
    it('detects packages in nested node_modules', async () => {
      const pkgADir = createPackage('package-a', '1.0.0', { license: 'MIT' });
      createPackage('package-b', '1.0.0', { license: 'Apache-2.0' });

      const pkgCNodeModules = path.join(pkgADir, 'node_modules');
      fs.mkdirSync(pkgCNodeModules, { recursive: true });
      const pkgCDir = path.join(pkgCNodeModules, 'package-c');
      fs.mkdirSync(pkgCDir, { recursive: true });
      fs.writeFileSync(path.join(pkgCDir, 'package.json'), JSON.stringify({
        name: 'package-c', version: '1.0.0', license: 'MIT',
      }));

      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['package-a@1.0.0']).toBeDefined();
      expect(packages['package-b@1.0.0']).toBeDefined();
      expect(packages['package-c@1.0.0']).toBeDefined();
    });

    it('detects packages at multiple levels of nesting', async () => {
      const pkgADir = createPackage('package-a', '1.0.0', { license: 'MIT' });

      const level2 = path.join(pkgADir, 'node_modules', 'package-b');
      fs.mkdirSync(level2, { recursive: true });
      fs.writeFileSync(path.join(level2, 'package.json'), JSON.stringify({
        name: 'package-b', version: '2.0.0', license: 'ISC',
      }));

      const level3 = path.join(level2, 'node_modules', 'package-c');
      fs.mkdirSync(level3, { recursive: true });
      fs.writeFileSync(path.join(level3, 'package.json'), JSON.stringify({
        name: 'package-c', version: '3.0.0', license: 'MIT',
      }));

      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['package-a@1.0.0']).toBeDefined();
      expect(packages['package-b@2.0.0']).toBeDefined();
      expect(packages['package-c@3.0.0']).toBeDefined();
    });

    it('detects scoped packages in nested node_modules', async () => {
      const pkgADir = createPackage('package-a', '1.0.0', { license: 'MIT' });

      const nestedPkgDir = path.join(pkgADir, 'node_modules', '@scope', 'nested-pkg');
      fs.mkdirSync(nestedPkgDir, { recursive: true });
      fs.writeFileSync(path.join(nestedPkgDir, 'package.json'), JSON.stringify({
        name: '@scope/nested-pkg', version: '1.0.0', license: 'BSD-3-Clause',
      }));

      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['package-a@1.0.0']).toBeDefined();
      expect(packages['@scope/nested-pkg@1.0.0']).toBeDefined();
    });

    it('avoids infinite recursion with circular node_modules', async () => {
      const pkgADir = createPackage('package-a', '1.0.0', { license: 'MIT' });
      const pkgBDir = createPackage('package-b', '1.0.0', { license: 'MIT' });

      // package-a/node_modules/package-b → points back to package-b
      const nestedDir = path.join(pkgADir, 'node_modules');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.symlinkSync(pkgBDir, path.join(nestedDir, 'package-b'), 'dir');

      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['package-a@1.0.0']).toBeDefined();
      expect(packages['package-b@1.0.0']).toBeDefined();
      // Should not infinite-loop, returns all packages
      expect(Object.keys(packages).length).toBe(2);
    });

  });

  describe('empty node_modules', () => {
    it('returns empty packages when node_modules is empty', async () => {
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages).toEqual({});
    });

    it('returns empty packages when node_modules does not exist', async () => {
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages).toEqual({});
    });
  });

  describe('package without version', () => {
    it('uses 0.0.0 as default version', async () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'noversion');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'noversion', license: 'MIT' }));
      const packages = await builtInLicenseChecker({ start: tempDir });
      expect(packages['noversion@0.0.0']).toBeDefined();
      expect(packages['noversion@0.0.0'].version).toBe('0.0.0');
    });
  });
});
