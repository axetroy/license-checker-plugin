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

  describe('direct field', () => {
    it('marks package as direct when listed in project dependencies', () => {
      // Create project package.json
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        dependencies: { 'direct-dep': '^1.0.0' }
      }));

      const pkgDir = path.join(tempDir, 'node_modules', 'direct-dep');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'direct-dep', version: '1.0.0' }));
      const modulePath = path.join(pkgDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.direct).toBe(true);
    });

    it('marks package as direct when listed in project devDependencies', () => {
      // Create project package.json
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        devDependencies: { 'direct-dev-dep': '^2.0.0' }
      }));

      const pkgDir = path.join(tempDir, 'node_modules', 'direct-dev-dep');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'direct-dev-dep', version: '2.0.0' }));
      const modulePath = path.join(pkgDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.direct).toBe(true);
    });

    it('marks package as indirect when not listed in project dependencies', () => {
      // Create project package.json without the dependency
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        dependencies: { 'other-dep': '^1.0.0' }
      }));

      const pkgDir = path.join(tempDir, 'node_modules', 'indirect-dep');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'indirect-dep', version: '2.0.0' }));
      const modulePath = path.join(pkgDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.direct).toBe(false);
    });

    it('marks scoped package as direct when listed in project dependencies', () => {
      // Create project package.json
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        dependencies: { '@scope/direct': '^1.0.0' }
      }));

      const pkgDir = path.join(tempDir, 'node_modules', '@scope', 'direct');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: '@scope/direct', version: '1.0.0' }));
      const modulePath = path.join(pkgDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.direct).toBe(true);
    });

    it('marks nested package as direct when listed in project dependencies', () => {
      // Even if package is nested, if it's declared in project's package.json, it's a direct dependency
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        dependencies: { 'nested-dep': '^1.0.0' }
      }));

      const pkgDir = path.join(tempDir, 'node_modules', 'parent', 'node_modules', 'nested-dep');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'nested-dep', version: '2.0.0' }));
      const modulePath = path.join(pkgDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      // Package is in package.json dependencies, so it's direct
      expect(result!.direct).toBe(true);
    });

    it('defaults to false when project package.json does not exist', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'some-dep');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'some-dep', version: '1.0.0' }));
      const modulePath = path.join(pkgDir, 'index.js');
      const resolver = new PackageResolver();
      // Don't call setProjectRoot
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.direct).toBe(false);
    });
  });

  describe('dependencyPath field', () => {
    it('returns "/" for direct dependencies', () => {
      const pkgDir = path.join(tempDir, 'node_modules', 'direct-dep');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'direct-dep', version: '1.0.0' }));
      const modulePath = path.join(pkgDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/');
    });

    it('returns dependency path for indirect dependencies', () => {
      // Create parent package
      const parentDir = path.join(tempDir, 'node_modules', 'parent');
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(path.join(parentDir, 'package.json'), JSON.stringify({ name: 'parent', version: '2.0.0' }));
      
      // Create nested package
      const nestedDir = path.join(parentDir, 'node_modules', 'nested-dep');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'package.json'), JSON.stringify({ name: 'nested-dep', version: '1.0.0' }));
      
      const modulePath = path.join(nestedDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/parent@2.0.0');
    });

    it('returns full dependency path for deeply nested packages', () => {
      // Create level1 package
      const level1Dir = path.join(tempDir, 'node_modules', 'level1');
      fs.mkdirSync(level1Dir, { recursive: true });
      fs.writeFileSync(path.join(level1Dir, 'package.json'), JSON.stringify({ name: 'level1', version: '1.0.0' }));
      
      // Create level2 package
      const level2Dir = path.join(level1Dir, 'node_modules', 'level2');
      fs.mkdirSync(level2Dir, { recursive: true });
      fs.writeFileSync(path.join(level2Dir, 'package.json'), JSON.stringify({ name: 'level2', version: '2.0.0' }));
      
      // Create target package
      const targetDir = path.join(level2Dir, 'node_modules', 'target');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({ name: 'target', version: '3.0.0' }));
      
      const modulePath = path.join(targetDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/level1@1.0.0/level2@2.0.0');
    });

    it('handles scoped packages in dependency path', () => {
      // Create scoped parent package
      const parentDir = path.join(tempDir, 'node_modules', '@scope', 'parent');
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(path.join(parentDir, 'package.json'), JSON.stringify({ name: '@scope/parent', version: '1.0.0' }));
      
      // Create nested package
      const nestedDir = path.join(parentDir, 'node_modules', 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'package.json'), JSON.stringify({ name: 'nested', version: '2.0.0' }));
      
      const modulePath = path.join(nestedDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/@scope/parent@1.0.0');
    });

    it('handles package with subpath in path', () => {
      // Create parent package
      const parentDir = path.join(tempDir, 'node_modules', 'parent');
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(path.join(parentDir, 'package.json'), JSON.stringify({ name: 'parent', version: '1.0.0' }));
      
      // Create nested package directly (standard npm structure)
      const nestedDir = path.join(parentDir, 'node_modules', 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'package.json'), JSON.stringify({ name: 'nested', version: '2.0.0' }));
      
      // Module path has subpath (lib/index.js)
      const modulePath = path.join(nestedDir, 'lib', 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/parent@1.0.0');
    });

    it('uses directory name when package.json has no version', () => {
      // Create parent package without version in package.json
      const parentDir = path.join(tempDir, 'node_modules', 'parent');
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(path.join(parentDir, 'package.json'), JSON.stringify({ name: 'parent' }));
      
      // Create nested package
      const nestedDir = path.join(parentDir, 'node_modules', 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'package.json'), JSON.stringify({ name: 'nested', version: '1.0.0' }));
      
      const modulePath = path.join(nestedDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/parent@unknown');
    });

    it('uses directory name when package.json read fails', () => {
      // Create parent package directory but no package.json
      const parentDir = path.join(tempDir, 'node_modules', 'parent');
      fs.mkdirSync(parentDir, { recursive: true });
      // Don't create package.json
      
      // Create nested package
      const nestedDir = path.join(parentDir, 'node_modules', 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'package.json'), JSON.stringify({ name: 'nested', version: '1.0.0' }));
      
      const modulePath = path.join(nestedDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/parent@unknown');
    });

    it('handles deeply nested scoped packages', () => {
      // Create scoped parent package
      const parentDir = path.join(tempDir, 'node_modules', '@org', 'parent');
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(path.join(parentDir, 'package.json'), JSON.stringify({ name: '@org/parent', version: '1.0.0' }));
      
      // Create scoped child package
      const childDir = path.join(parentDir, 'node_modules', '@org', 'child');
      fs.mkdirSync(childDir, { recursive: true });
      fs.writeFileSync(path.join(childDir, 'package.json'), JSON.stringify({ name: '@org/child', version: '2.0.0' }));
      
      // Create target package
      const targetDir = path.join(childDir, 'node_modules', 'target');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({ name: 'target', version: '3.0.0' }));
      
      const modulePath = path.join(targetDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/@org/parent@1.0.0/@org/child@2.0.0');
    });

    it('handles Windows-style backslash paths', () => {
      // Create parent package
      const parentDir = path.join(tempDir, 'node_modules', 'parent');
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(path.join(parentDir, 'package.json'), JSON.stringify({ name: 'parent', version: '1.0.0' }));
      
      // Create nested package
      const nestedDir = path.join(parentDir, 'node_modules', 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'package.json'), JSON.stringify({ name: 'nested', version: '2.0.0' }));
      
      // Use Windows-style path (backslashes)
      const modulePath = nestedDir + '\\index.js';
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/parent@1.0.0');
    });

    it('handles package with different name in package.json', () => {
      // Create parent package where directory name differs from package.json name
      const parentDir = path.join(tempDir, 'node_modules', 'pkg-dir-name');
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(path.join(parentDir, 'package.json'), JSON.stringify({ name: 'actual-package-name', version: '1.0.0' }));
      
      // Create nested package
      const nestedDir = path.join(parentDir, 'node_modules', 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'package.json'), JSON.stringify({ name: 'nested', version: '2.0.0' }));
      
      const modulePath = path.join(nestedDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      // Should use name from package.json
      expect(result!.dependencyPath).toBe('/actual-package-name@1.0.0');
    });

    it('handles five levels of nesting', () => {
      // Create chain: level1 > level2 > level3 > level4 > target
      const level1Dir = path.join(tempDir, 'node_modules', 'level1');
      fs.mkdirSync(level1Dir, { recursive: true });
      fs.writeFileSync(path.join(level1Dir, 'package.json'), JSON.stringify({ name: 'level1', version: '1.0.0' }));
      
      const level2Dir = path.join(level1Dir, 'node_modules', 'level2');
      fs.mkdirSync(level2Dir, { recursive: true });
      fs.writeFileSync(path.join(level2Dir, 'package.json'), JSON.stringify({ name: 'level2', version: '2.0.0' }));
      
      const level3Dir = path.join(level2Dir, 'node_modules', 'level3');
      fs.mkdirSync(level3Dir, { recursive: true });
      fs.writeFileSync(path.join(level3Dir, 'package.json'), JSON.stringify({ name: 'level3', version: '3.0.0' }));
      
      const level4Dir = path.join(level3Dir, 'node_modules', 'level4');
      fs.mkdirSync(level4Dir, { recursive: true });
      fs.writeFileSync(path.join(level4Dir, 'package.json'), JSON.stringify({ name: 'level4', version: '4.0.0' }));
      
      const targetDir = path.join(level4Dir, 'node_modules', 'target');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({ name: 'target', version: '5.0.0' }));
      
      const modulePath = path.join(targetDir, 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/level1@1.0.0/level2@2.0.0/level3@3.0.0/level4@4.0.0');
    });

    it('returns "/" when package is at project root node_modules', () => {
      // Package directly in project's node_modules
      const pkgDir = path.join(tempDir, 'node_modules', 'single-dep');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'single-dep', version: '1.0.0' }));
      
      const modulePath = path.join(pkgDir, 'lib', 'index.js');
      const resolver = new PackageResolver();
      resolver.setProjectRoot(tempDir);
      const result = resolver.resolve(modulePath, 'main');
      expect(result!.dependencyPath).toBe('/');
    });
  });
});
