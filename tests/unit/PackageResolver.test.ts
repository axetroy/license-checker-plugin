import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PackageResolver } from '../../src/scanner/PackageResolver';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function createPackage(name: string, version: string, overrides: Record<string, unknown> = {}): string {
  const pkgDir = path.join(tempDir, 'node_modules', name);
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name, version, ...overrides }));
  return pkgDir;
}

describe('PackageResolver', () => {
  it('returns null for non-node_module paths', () => {
    const resolver = new PackageResolver();
    expect(resolver.resolve('/src/app.ts', 'main')).toBeNull();
  });

  it('returns null for empty path', () => {
    const resolver = new PackageResolver();
    expect(resolver.resolve('', 'main')).toBeNull();
  });

  it('resolves a normal package from node_modules', () => {
    const pkgDir = createPackage('lodash', '4.17.21');
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('lodash');
    expect(result!.version).toBe('4.17.21');
    expect(result!.path).toBe(pkgDir);
    expect(result!.chunks).toEqual(['main']);
    expect(result!.modules).toEqual([modulePath]);
  });

  it('resolves a scoped package (@scope/name)', () => {
    const pkgDir = createPackage('@scope/name', '2.0.0');
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'vendor');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('@scope/name');
    expect(result!.version).toBe('2.0.0');
    expect(result!.chunks).toEqual(['vendor']);
  });

  it('uses package name from package.json if available', () => {
    const pkgDir = createPackage('wrong-name', '1.0.0', { name: 'correct-name' });
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result!.name).toBe('correct-name');
  });

  it('falls back to directory name if package.json has no name', () => {
    const pkgDir = path.join(tempDir, 'node_modules', 'fallback-pkg');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result!.name).toBe('fallback-pkg');
  });

  it('uses "unknown" version when package.json has no version', () => {
    const pkgDir = path.join(tempDir, 'node_modules', 'noversion');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'noversion' }));
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result!.version).toBe('unknown');
  });

  it('returns null if package.json cannot be read', () => {
    const pkgDir = path.join(tempDir, 'node_modules', 'broken');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), 'not valid json');
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    expect(resolver.resolve(modulePath, 'main')).toBeNull();
  });

  it('returns null if package.json does not exist', () => {
    const pkgDir = path.join(tempDir, 'node_modules', 'empty-dir');
    fs.mkdirSync(pkgDir, { recursive: true });
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    expect(resolver.resolve(modulePath, 'main')).toBeNull();
  });

  it('normalizes Windows backslash paths', () => {
    const pkgDir = createPackage('win-pkg', '1.0.0');
    const modulePath = pkgDir + '\\index.js';
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('win-pkg');
  });

  it('caches results and returns same PackageInfo for same package root', () => {
    const pkgDir = createPackage('cached-pkg', '1.0.0', { license: 'MIT' });
    const module1 = path.join(pkgDir, 'index.js');
    const module2 = path.join(pkgDir, 'utils.js');
    const resolver = new PackageResolver();

    const result1 = resolver.resolve(module1, 'main');
    const result2 = resolver.resolve(module2, 'vendor');

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1).toBe(result2);
    expect(result1!.name).toBe('cached-pkg');
    expect(result1!.version).toBe('1.0.0');
    expect(result1!.license).toBe('MIT');
    expect(result1!.chunks).toEqual(['main', 'vendor']);
    expect(result1!.modules).toEqual([module1, module2]);
  });

  it('returns license string from package.json', () => {
    const pkgDir = createPackage('licensed-pkg', '2.0.0', { license: 'Apache-2.0' });
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result!.license).toBe('Apache-2.0');
  });

  it('handles licenses array in package.json', () => {
    const pkgDir = createPackage('multi-license-pkg', '1.0.0', { licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] });
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result!.license).toBe('MIT AND Apache-2.0');
  });

  it('returns undefined license when package.json has no license field', () => {
    const pkgDir = createPackage('no-license-pkg', '1.0.0', {});
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result!.license).toBeUndefined();
  });

  it('handles license object syntax { type }', () => {
    const pkgDir = createPackage('obj-license-pkg', '1.0.0', { license: { type: 'MIT' } });
    const modulePath = path.join(pkgDir, 'index.js');
    const resolver = new PackageResolver();
    const result = resolver.resolve(modulePath, 'main');
    expect(result!.license).toBe('MIT');
  });
});
