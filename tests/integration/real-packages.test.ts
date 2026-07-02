/**
 * Integration tests that scan real installed open-source packages to verify
 * the BuiltInLicenseChecker produces correct results against actual data.
 */
import * as path from 'path';
import { builtInLicenseChecker } from '../../src/checker/BuiltInLicenseChecker';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('real packages – builtInLicenseChecker', () => {
  it('detects lodash license', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT }, (err, packages) => {
      expect(err).toBeNull();
      const lodashKey = Object.keys(packages).find((k) => k.startsWith('lodash@'));
      expect(lodashKey).toBeDefined();
      const pkg = packages[lodashKey!];
      expect(pkg.licenses).toBe('MIT');
      expect(pkg.name).toBe('lodash');
      expect(pkg.version).toBeDefined();
      expect(pkg.path).toBeDefined();
      done();
    });
  });

  it('detects lodash license with license text', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT, customFormat: { licenseText: true } }, (err, packages) => {
      expect(err).toBeNull();
      const lodashKey = Object.keys(packages).find((k) => k.startsWith('lodash@'));
      expect(lodashKey).toBeDefined();
      const pkg = packages[lodashKey!];
      expect(pkg.licenseText).toBeDefined();
      expect(pkg.licenseText!.length).toBeGreaterThan(0);
      expect(pkg.licenseText!).toContain('Copyright OpenJS Foundation');
      expect(pkg.licenseFile).toBeDefined();
      done();
    });
  });

  it('detects webpack license', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT }, (err, packages) => {
      expect(err).toBeNull();
      const webpackKey = Object.keys(packages).find((k) => k.startsWith('webpack@'));
      expect(webpackKey).toBeDefined();
      const pkg = packages[webpackKey!];
      expect(pkg.licenses).toBe('MIT');
      expect(pkg.name).toBe('webpack');
      done();
    });
  });

  it('detects webpack-sources license', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT }, (err, packages) => {
      expect(err).toBeNull();
      const wsKey = Object.keys(packages).find((k) => k.startsWith('webpack-sources@'));
      expect(wsKey).toBeDefined();
      const pkg = packages[wsKey!];
      expect(pkg.licenses).toBe('MIT');
      expect(pkg.name).toBe('webpack-sources');
      done();
    });
  });

  it('detects typescript license', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT }, (err, packages) => {
      expect(err).toBeNull();
      const tsKey = Object.keys(packages).find((k) => k.startsWith('typescript@'));
      expect(tsKey).toBeDefined();
      const pkg = packages[tsKey!];
      expect(pkg.licenses).toBe('Apache-2.0');
      expect(pkg.name).toBe('typescript');
      done();
    });
  });

  it('detects multiple known packages', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT }, (err, packages) => {
      expect(err).toBeNull();
      const keys = Object.keys(packages);
      expect(keys.length).toBeGreaterThan(10);

      const known = ['lodash', 'webpack', 'typescript', 'jest'];
      for (const name of known) {
        expect(keys.some((k) => k.startsWith(`${name}@`))).toBe(true);
      }
      done();
    });
  });

  it('extracts repository URL for lodash', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT }, (err, packages) => {
      expect(err).toBeNull();
      const lodashKey = Object.keys(packages).find((k) => k.startsWith('lodash@'));
      expect(lodashKey).toBeDefined();
      const pkg = packages[lodashKey!];
      expect(pkg.repository).toContain('lodash/lodash');
      done();
    });
  });

  it('extracts copyright for lodash from license file', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT, customFormat: { licenseText: true } }, (err, packages) => {
      expect(err).toBeNull();
      const lodashKey = Object.keys(packages).find((k) => k.startsWith('lodash@'));
      expect(lodashKey).toBeDefined();
      const pkg = packages[lodashKey!];
      expect(pkg.licenseText).toBeDefined();
      expect(pkg.licenseText).toContain('Copyright OpenJS Foundation');
      done();
    });
  });

  it('does not produce errors for real project node_modules', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT }, (err, packages) => {
      expect(err).toBeNull();
      expect(Object.keys(packages).length).toBeGreaterThan(0);
      done();
    });
  });

  it('excludes nothing when excludePrivatePackages is false', (done) => {
    builtInLicenseChecker({ start: PROJECT_ROOT, excludePrivatePackages: false }, (err, packages) => {
      expect(err).toBeNull();
      expect(Object.keys(packages).length).toBeGreaterThan(0);
      done();
    });
  });
});
