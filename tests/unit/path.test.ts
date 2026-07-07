import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { findPackageRoot, isNodeModule, getNodeModuleName } from '../utils/path.js';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('findPackageRoot', () => {
  it('returns package root for a module inside node_modules', () => {
    const pkgDir = path.join(tempDir, 'node_modules', 'lodash');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'lodash', version: '1.0.0' }));
    const modulePath = path.join(pkgDir, 'index.js');
    expect(findPackageRoot(modulePath)).toBe(pkgDir);
  });

  it('returns null for path outside node_modules', () => {
    expect(findPackageRoot(path.join(tempDir, 'src', 'app.ts'))).toBeNull();
  });

  it('returns null when package.json does not exist', () => {
    const dir = path.join(tempDir, 'node_modules', 'missing-pkg', 'index.js');
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    expect(findPackageRoot(dir)).toBeNull();
  });
});

describe('isNodeModule', () => {
  it('returns true for path containing node_modules', () => {
    expect(isNodeModule('/project/node_modules/lodash/index.js')).toBe(true);
  });

  it('returns false for path without node_modules', () => {
    expect(isNodeModule('/project/src/app.ts')).toBe(false);
  });
});

describe('getNodeModuleName', () => {
  it('extracts name from normal package path', () => {
    expect(getNodeModuleName('/project/node_modules/lodash/index.js')).toBe('lodash');
  });

  it('extracts name from scoped package path', () => {
    expect(getNodeModuleName('/project/node_modules/@scope/name/index.js')).toBe('@scope/name');
  });

  it('returns null when no node_modules segment', () => {
    expect(getNodeModuleName('/project/src/app.ts')).toBeNull();
  });

  it('handles Windows backslash paths', () => {
    expect(getNodeModuleName('C:\\project\\node_modules\\lodash\\index.js')).toBe('lodash');
  });

  it('handles scoped package with backslash paths', () => {
    const result = getNodeModuleName('C:\\project\\node_modules\\@scope\\name\\index.js');
    expect(result).toMatch(/^@scope[\\/]name$/);
  });
});
