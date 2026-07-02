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
    it('detects MIT license from package.json', (done) => {
      createPackage('test-mit', '1.0.0', { license: 'MIT' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-mit@1.0.0']).toBeDefined();
        expect(packages['test-mit@1.0.0'].licenses).toBe('MIT');
        done();
      });
    });

    it('detects Apache-2.0 license', (done) => {
      createPackage('test-apache', '2.0.0', { license: 'Apache-2.0' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-apache@2.0.0'].licenses).toBe('Apache-2.0');
        done();
      });
    });

    it('detects BSD-3-Clause license', (done) => {
      createPackage('test-bsd', '3.0.0', { license: 'BSD-3-Clause' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-bsd@3.0.0'].licenses).toBe('BSD-3-Clause');
        done();
      });
    });

    it('handles UNKNOWN license', (done) => {
      createPackage('test-unknown', '1.0.0', { license: 'UNKNOWN-LICENSE' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-unknown@1.0.0']).toBeDefined();
        done();
      });
    });

    it('handles multiple licenses (array)', (done) => {
      createPackage('test-multi', '1.0.0', { licenses: ['MIT', 'Apache-2.0'] });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-multi@1.0.0'].licenses).toEqual(['MIT', 'Apache-2.0']);
        done();
      });
    });

    it('handles SPDX compound license expression', (done) => {
      createPackage('test-compound', '1.0.0', { license: '(MIT OR Apache-2.0)' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-compound@1.0.0'].licenses).toBe('(MIT OR Apache-2.0)');
        done();
      });
    });

    it('handles license with { type } object syntax', (done) => {
      createPackage('test-obj-license', '1.0.0', { license: { type: 'MIT' } });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-obj-license@1.0.0'].licenses).toBe('MIT');
        done();
      });
    });

    it('handles ISC license', (done) => {
      createPackage('test-isc', '1.0.0', { license: 'ISC' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-isc@1.0.0'].licenses).toBe('ISC');
        done();
      });
    });

    it('handles Unlicense', (done) => {
      createPackage('test-unlicense', '1.0.0', { license: 'Unlicense' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-unlicense@1.0.0'].licenses).toBe('Unlicense');
        done();
      });
    });

    it('handles GPL-3.0 license', (done) => {
      createPackage('test-gpl', '1.0.0', { license: 'GPL-3.0' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-gpl@1.0.0'].licenses).toBe('GPL-3.0');
        done();
      });
    });
  });

  describe('scoped packages', () => {
    it('detects scoped packages', (done) => {
      const scopeDir = path.join(tempDir, 'node_modules', '@test', 'scoped-pkg');
      fs.mkdirSync(scopeDir, { recursive: true });
      fs.writeFileSync(path.join(scopeDir, 'package.json'), JSON.stringify({
        name: '@test/scoped-pkg',
        version: '1.0.0',
        license: 'MIT',
      }));
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['@test/scoped-pkg@1.0.0']).toBeDefined();
        expect(packages['@test/scoped-pkg@1.0.0'].licenses).toBe('MIT');
        done();
      });
    });

    it('detects multiple scoped packages under same scope', (done) => {
      for (const name of ['@scope/foo', '@scope/bar']) {
        const dir = path.join(tempDir, 'node_modules', ...name.split('/'));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
          name,
          version: '1.0.0',
          license: 'MIT',
        }));
      }
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['@scope/foo@1.0.0']).toBeDefined();
        expect(packages['@scope/bar@1.0.0']).toBeDefined();
        done();
      });
    });
  });

  describe('license file detection', () => {
    it('finds LICENSE file', (done) => {
      createPackage('test-license-file', '1.0.0', {}, 'MIT License Content');
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-license-file@1.0.0'].licenseFile).toBeDefined();
        done();
      });
    });

    it('reads license text when customFormat.licenseText is true', (done) => {
      const licenseContent = 'MIT License\nPermission is hereby granted...';
      createPackage('test-license-text', '1.0.0', { license: 'MIT' }, licenseContent);
      builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-license-text@1.0.0'].licenseText).toBe(licenseContent);
        done();
      });
    });

    it('does not read license text when customFormat.licenseText is false', (done) => {
      createPackage('test-no-license-text', '1.0.0', { license: 'MIT' }, 'Some content');
      builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: false } }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-no-license-text@1.0.0'].licenseText).toBeUndefined();
        done();
      });
    });

    it('does not read license text when customFormat.licenseText is not set', (done) => {
      createPackage('test-no-format', '1.0.0', { license: 'MIT' }, 'MIT License');
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-no-format@1.0.0'].licenseText).toBeUndefined();
        done();
      });
    });

    it('finds LICENSE-MIT file', (done) => {
      const pkgDir = path.join(tempDir, 'node_modules', 'license-mit');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'license-mit', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'LICENSE-MIT'), 'MIT License Text');
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['license-mit@1.0.0'].licenseFile).toMatch(/LICENSE-MIT$/);
        done();
      });
    });

    it('finds Licence file (alternative spelling)', (done) => {
      const pkgDir = path.join(tempDir, 'node_modules', 'licence-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'licence-pkg', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'Licence'), 'MIT License');
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['licence-pkg@1.0.0'].licenseFile).toMatch(/Licence$/);
        done();
      });
    });

    it('finds COPYING file', (done) => {
      const pkgDir = path.join(tempDir, 'node_modules', 'copying-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'copying-pkg', version: '1.0.0', license: 'GPL-2.0' }));
      fs.writeFileSync(path.join(pkgDir, 'COPYING'), 'GPL License');
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['copying-pkg@1.0.0'].licenseFile).toMatch(/COPYING$/);
        done();
      });
    });

    it('prefers LICENSE over other license file names', (done) => {
      const pkgDir = path.join(tempDir, 'node_modules', 'multi-license');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'multi-license', version: '1.0.0', license: 'MIT' }));
      fs.writeFileSync(path.join(pkgDir, 'LICENSE-MIT'), 'MIT');
      fs.writeFileSync(path.join(pkgDir, 'LICENSE'), 'MIT License');
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['multi-license@1.0.0'].licenseFile).toMatch(/LICENSE$/);
        done();
      });
    });

    it('returns undefined licenseFile when no license file exists', (done) => {
      createPackage('no-license-file', '1.0.0', { license: 'MIT' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['no-license-file@1.0.0'].licenseFile).toBeUndefined();
        done();
      });
    });
  });

  describe('copyright extraction', () => {
    it('extracts copyright from license file', (done) => {
      const licenseContent = `MIT License

Copyright (c) 2024 Test Author

Permission is hereby granted...`;
      createPackage('test-copyright', '1.0.0', { license: 'MIT' }, licenseContent);
      builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-copyright@1.0.0'].copyright).toBeDefined();
        expect(packages['test-copyright@1.0.0'].copyright).toContain('2024');
        done();
      });
    });

    it('extracts copyright with year range', (done) => {
      const licenseContent = `MIT License

Copyright (c) 2020-2024 Test Author

Permission is hereby granted...`;
      createPackage('test-copyright-range', '1.0.0', { license: 'MIT' }, licenseContent);
      builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-copyright-range@1.0.0'].copyright).toContain('2020-2024');
        done();
      });
    });

    it('extracts copyright with © symbol', (done) => {
      const licenseContent = `MIT License

© 2024 Test Author

Permission is hereby granted...`;
      createPackage('test-copyright-symbol', '1.0.0', { license: 'MIT' }, licenseContent);
      builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-copyright-symbol@1.0.0'].copyright).toContain('2024');
        done();
      });
    });

    it('returns undefined copyright when no copyright line exists', (done) => {
      const licenseContent = `MIT License

Permission is hereby granted, free of charge, to any person...`;
      createPackage('test-no-copyright', '1.0.0', { license: 'MIT' }, licenseContent);
      builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-no-copyright@1.0.0'].copyright).toBeUndefined();
        done();
      });
    });

    it('extracts copyright with copyright (c) notation (with space)', (done) => {
      const licenseContent = `BSD License

Copyright (c) 2023 The Author

Redistribution and use...`;
      createPackage('test-copyright-c', '1.0.0', { license: 'BSD-3-Clause' }, licenseContent);
      builtInLicenseChecker({ start: tempDir, customFormat: { licenseText: true } }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-copyright-c@1.0.0'].copyright).toContain('2023');
        done();
      });
    });
  });

  describe('repository URL normalization', () => {
    it('normalizes git+https URL', (done) => {
      createPackage('test-repo-https', '1.0.0', { repository: 'git+https://github.com/test/repo.git' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-repo-https@1.0.0'].repository).toBe('https://github.com/test/repo');
        done();
      });
    });

    it('normalizes git URL', (done) => {
      createPackage('test-repo-git', '1.0.0', { repository: 'git://github.com/test/repo.git' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-repo-git@1.0.0'].repository).toBe('https://github.com/test/repo');
        done();
      });
    });

    it('normalizes git+ssh URL', (done) => {
      createPackage('test-repo-ssh', '1.0.0', { repository: 'git+ssh://git@github.com:test/repo.git' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-repo-ssh@1.0.0'].repository).toBe('https://github.com/test/repo');
        done();
      });
    });

    it('handles repository as object with url field', (done) => {
      createPackage('test-repo-obj', '1.0.0', { repository: { type: 'git', url: 'https://github.com/test/repo.git' } });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-repo-obj@1.0.0'].repository).toBe('https://github.com/test/repo');
        done();
      });
    });

    it('handles shorthand repository (user/repo)', (done) => {
      createPackage('test-repo-shorthand', '1.0.0', { repository: 'visionmedia/debug' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-repo-shorthand@1.0.0'].repository).toBe('visionmedia/debug');
        done();
      });
    });

    it('returns undefined for missing repository', (done) => {
      createPackage('test-no-repo', '1.0.0', { license: 'MIT' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-no-repo@1.0.0'].repository).toBeUndefined();
        done();
      });
    });
  });

  describe('author parsing', () => {
    it('parses author string with email', (done) => {
      createPackage('test-author-email', '1.0.0', { license: 'MIT', author: 'Test Author <test@example.com>' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-author-email@1.0.0'].publisher).toBe('Test Author');
        expect(packages['test-author-email@1.0.0'].email).toBe('test@example.com');
        done();
      });
    });

    it('parses author string without email', (done) => {
      createPackage('test-author-noemail', '1.0.0', { license: 'MIT', author: 'Test Author' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-author-noemail@1.0.0'].publisher).toBe('Test Author');
        expect(packages['test-author-noemail@1.0.0'].email).toBeUndefined();
        done();
      });
    });

    it('parses author object with name and email', (done) => {
      createPackage('test-author-obj', '1.0.0', { license: 'MIT', author: { name: 'Test Author', email: 'test@example.com' } });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-author-obj@1.0.0'].publisher).toBe('Test Author');
        expect(packages['test-author-obj@1.0.0'].email).toBe('test@example.com');
        done();
      });
    });

    it('parses author object with only name', (done) => {
      createPackage('test-author-only-name', '1.0.0', { license: 'MIT', author: { name: 'Just Name' } });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-author-only-name@1.0.0'].publisher).toBe('Just Name');
        expect(packages['test-author-only-name@1.0.0'].email).toBeUndefined();
        done();
      });
    });

    it('returns undefined publisher/email when author is missing', (done) => {
      createPackage('test-no-author', '1.0.0', { license: 'MIT' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-no-author@1.0.0'].publisher).toBeUndefined();
        expect(packages['test-no-author@1.0.0'].email).toBeUndefined();
        done();
      });
    });

    it('handles author wrapped entirely in angle brackets', (done) => {
      createPackage('test-author-bracket', '1.0.0', { license: 'MIT', author: '<user@example.com>' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-author-bracket@1.0.0'].publisher).toBe('<user@example.com>');
        expect(packages['test-author-bracket@1.0.0'].email).toBeUndefined();
        done();
      });
    });
  });

  describe('excludePrivatePackages option', () => {
    it('excludes scoped packages when excludePrivatePackages is true', (done) => {
      const scopeDir = path.join(tempDir, 'node_modules', '@private', 'private-pkg');
      fs.mkdirSync(scopeDir, { recursive: true });
      fs.writeFileSync(path.join(scopeDir, 'package.json'), JSON.stringify({
        name: '@private/private-pkg',
        version: '1.0.0',
        license: 'MIT',
      }));
      createPackage('public-pkg', '1.0.0', { license: 'MIT' });
      builtInLicenseChecker({ start: tempDir, excludePrivatePackages: true }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['@private/private-pkg@1.0.0']).toBeUndefined();
        expect(packages['public-pkg@1.0.0']).toBeDefined();
        done();
      });
    });

    it('includes scoped packages when excludePrivatePackages is false', (done) => {
      const scopeDir = path.join(tempDir, 'node_modules', '@private', 'private-pkg');
      fs.mkdirSync(scopeDir, { recursive: true });
      fs.writeFileSync(path.join(scopeDir, 'package.json'), JSON.stringify({
        name: '@private/private-pkg',
        version: '1.0.0',
        license: 'MIT',
      }));
      builtInLicenseChecker({ start: tempDir, excludePrivatePackages: false }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['@private/private-pkg@1.0.0']).toBeDefined();
        done();
      });
    });
  });

  describe('private package field', () => {
    it('sets private to true when package.json has private: true', (done) => {
      const pkgDir = path.join(tempDir, 'node_modules', 'internal-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
        name: 'internal-pkg',
        version: '1.0.0',
        license: 'MIT',
        private: true,
      }));
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['internal-pkg@1.0.0'].private).toBe(true);
        done();
      });
    });

    it('sets private to false when package.json does not have private field', (done) => {
      createPackage('public-pkg', '1.0.0', { license: 'MIT' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['public-pkg@1.0.0'].private).toBe(false);
        done();
      });
    });
  });

  describe('error handling', () => {
    it('returns error for non-existent path', (done) => {
      builtInLicenseChecker({ start: '/non/existent/path' }, (err, packages) => {
        expect(err).toBeDefined();
        expect(err!.message).toContain('does not exist');
        expect(packages).toEqual({});
        done();
      });
    });

    it('handles package.json without license field', (done) => {
      const pkgDir = path.join(tempDir, 'node_modules', 'no-license-field');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
        name: 'no-license-field',
        version: '1.0.0',
      }));
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['no-license-field@1.0.0']).toBeDefined();
        expect(packages['no-license-field@1.0.0'].licenses).toBeUndefined();
        done();
      });
    });

    it('handles malformed package.json', (done) => {
      const pkgDir = path.join(tempDir, 'node_modules', 'malformed-pkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), 'not valid json');
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeDefined();
        done();
      });
    });
  });

  describe('homepage field', () => {
    it('extracts homepage as url', (done) => {
      createPackage('test-homepage', '1.0.0', { license: 'MIT', homepage: 'https://example.com' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-homepage@1.0.0'].url).toBe('https://example.com');
        done();
      });
    });
  });

  describe('multiple packages', () => {
    it('detects multiple packages in node_modules', (done) => {
      createPackage('pkg-a', '1.0.0', { license: 'MIT' });
      createPackage('pkg-b', '2.0.0', { license: 'Apache-2.0' });
      createPackage('pkg-c', '3.0.0', { license: 'ISC' });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        const keys = Object.keys(packages);
        expect(keys).toContain('pkg-a@1.0.0');
        expect(keys).toContain('pkg-b@2.0.0');
        expect(keys).toContain('pkg-c@3.0.0');
        expect(keys.length).toBe(3);
        done();
      });
    });
  });

  describe('empty node_modules', () => {
    it('returns empty packages when node_modules is empty', (done) => {
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages).toEqual({});
        done();
      });
    });

    it('returns empty packages when node_modules does not exist', (done) => {
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages).toEqual({});
        done();
      });
    });
  });

  describe('package without version', () => {
    it('uses 0.0.0 as default version', (done) => {
      const pkgDir = path.join(tempDir, 'node_modules', 'noversion');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'noversion', license: 'MIT' }));
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['noversion@0.0.0']).toBeDefined();
        expect(packages['noversion@0.0.0'].version).toBe('0.0.0');
        done();
      });
    });
  });
});
