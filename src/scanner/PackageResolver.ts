import * as fs from 'fs';
import * as path from 'path';
import { PackageInfo } from '../model/PackageInfo';

export class PackageResolver {
  resolve(modulePath: string, chunkName: string): PackageInfo | null {
    if (!modulePath || !modulePath.includes('node_modules')) {
      return null;
    }

    const normalizedPath = modulePath.replace(/\\/g, '/');
    const nodeModulesIdx = normalizedPath.lastIndexOf('/node_modules/');
    if (nodeModulesIdx === -1) {
      return null;
    }

    const afterNodeModules = normalizedPath.slice(nodeModulesIdx + '/node_modules/'.length);

    let packageName: string;
    if (afterNodeModules.startsWith('@')) {
      const parts = afterNodeModules.split('/');
      if (parts.length < 2) {
        return null;
      }
      packageName = `${parts[0]}/${parts[1]}`;
    } else {
      const [name] = afterNodeModules.split('/');
      if (!name) {
        return null;
      }
      packageName = name;
    }

    const packageRoot = path.join(
      normalizedPath.slice(0, nodeModulesIdx + '/node_modules/'.length).replace(/\//g, path.sep),
      packageName.replace(/\//g, path.sep)
    );
    const packageJsonPath = path.join(packageRoot, 'package.json');

    try {
      const rawContent = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(rawContent) as { name?: string; version?: string };

      return {
        name: pkg.name || packageName,
        version: pkg.version || 'unknown',
        path: packageRoot,
        packageJsonPath,
        chunks: [chunkName],
        modules: [modulePath],
      };
    } catch {
      return null;
    }
  }
}
