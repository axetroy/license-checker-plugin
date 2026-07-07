import * as path from 'path';
import { fileURLToPath } from 'url';
import { builtInLicenseChecker } from '../../../src/checker/BuiltInLicenseChecker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

describe('real packages – builtInLicenseChecker', () => {
  it('detects lodash license', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT });
    const lodashKey = Object.keys(packages).find((k) => k.startsWith('lodash@'));
    expect(lodashKey).toBeDefined();
    const pkg = packages[lodashKey!];
    expect(pkg.licenses).toBe('MIT');
    expect(pkg.name).toBe('lodash');
    expect(pkg.version).toBeDefined();
    expect(pkg.path).toBeDefined();
  });

  it('detects lodash license with license text', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT, customFormat: { licenseText: true } });
    const lodashKey = Object.keys(packages).find((k) => k.startsWith('lodash@'));
    expect(lodashKey).toBeDefined();
    const pkg = packages[lodashKey!];
    expect(pkg.licenseText).toBeDefined();
    expect(pkg.licenseText!.length).toBeGreaterThan(0);
    expect(pkg.licenseText!).toContain('Copyright OpenJS Foundation');
    expect(pkg.licenseFile).toBeDefined();
  });

  it('detects webpack license', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT });
    const webpackKey = Object.keys(packages).find((k) => k.startsWith('webpack@'));
    expect(webpackKey).toBeDefined();
    const pkg = packages[webpackKey!];
    expect(pkg.licenses).toBe('MIT');
    expect(pkg.name).toBe('webpack');
  });

  it('detects webpack-sources license', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT });
    const wsKey = Object.keys(packages).find((k) => k.startsWith('webpack-sources@'));
    expect(wsKey).toBeDefined();
    const pkg = packages[wsKey!];
    expect(pkg.licenses).toBe('MIT');
    expect(pkg.name).toBe('webpack-sources');
  });

  it('detects typescript license', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT });
    const tsKey = Object.keys(packages).find((k) => k.startsWith('typescript@'));
    expect(tsKey).toBeDefined();
    const pkg = packages[tsKey!];
    expect(pkg.licenses).toBe('Apache-2.0');
    expect(pkg.name).toBe('typescript');
  });

  it('detects multiple known packages', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT });
    const keys = Object.keys(packages);
    expect(keys.length).toBeGreaterThan(10);

    const known = ['lodash', 'webpack', 'typescript', 'jest'];
    for (const name of known) {
      expect(keys.some((k) => k.startsWith(`${name}@`))).toBe(true);
    }
  });

  it('extracts repository URL for lodash', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT });
    const lodashKey = Object.keys(packages).find((k) => k.startsWith('lodash@'));
    expect(lodashKey).toBeDefined();
    const pkg = packages[lodashKey!];
    expect(pkg.repository).toContain('lodash/lodash');
  });

  it('extracts copyright for lodash from license file', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT, customFormat: { licenseText: true } });
    const lodashKey = Object.keys(packages).find((k) => k.startsWith('lodash@'));
    expect(lodashKey).toBeDefined();
    const pkg = packages[lodashKey!];
    expect(pkg.licenseText).toBeDefined();
    expect(pkg.licenseText).toContain('Copyright OpenJS Foundation');
  });

  it('does not produce errors for real project node_modules', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT });
    expect(Object.keys(packages).length).toBeGreaterThan(0);
  });

  it('excludes nothing when excludePrivatePackages is false', async () => {
    const packages = await builtInLicenseChecker({ start: PROJECT_ROOT, excludePrivatePackages: false });
    expect(Object.keys(packages).length).toBeGreaterThan(0);
  });
});
