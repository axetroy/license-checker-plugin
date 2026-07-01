import * as path from 'path';
import { readJsonFile } from './fs';

export function findPackageRoot(modulePath: string): string | null {
  let dir = path.dirname(modulePath);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const pkgJsonPath = path.join(dir, 'package.json');
    const pkg = readJsonFile(pkgJsonPath);

    if (pkg && typeof pkg.name === 'string' && dir.includes('node_modules')) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}

export function isNodeModule(filePath: string): boolean {
  return filePath.includes('node_modules');
}

export function getNodeModuleName(filePath: string): string | null {
  const match = filePath.match(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/);
  return match ? match[1] : null;
}
