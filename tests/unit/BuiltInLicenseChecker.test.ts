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
    // Clean up temp directory
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

    it('parses author object', (done) => {
      createPackage('test-author-obj', '1.0.0', { license: 'MIT', author: { name: 'Test Author', email: 'test@example.com' } });
      builtInLicenseChecker({ start: tempDir }, (err, packages) => {
        expect(err).toBeNull();
        expect(packages['test-author-obj@1.0.0'].publisher).toBe('Test Author');
        expect(packages['test-author-obj@1.0.0'].email).toBe('test@example.com');
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
        // Malformed JSON should return an error
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
});
