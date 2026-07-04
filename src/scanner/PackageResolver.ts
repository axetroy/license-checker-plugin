import * as fs from 'fs';
import * as path from 'path';
import { PackageInfo } from '../model/PackageInfo';
import { normalizeRepositoryUrl, parseAuthor } from '../checker/BuiltInLicenseChecker';

export class PackageResolver {
  private readonly cache = new Map<string, PackageInfo>();

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

    const cached = this.cache.get(packageRoot);
    if (cached) {
      return this.mergeModuleInfo(cached, chunkName, modulePath);
    }

    const packageJsonPath = path.join(packageRoot, 'package.json');

    try {
      const rawContent = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(rawContent) as {
        name?: string;
        version?: string;
        license?: string | { type?: string };
        licenses?: Array<{ type?: string }>;
        repository?: string | { url?: string; type?: string };
        homepage?: string;
        author?: string | { name?: string; email?: string };
        private?: boolean;
      };

      let repository: string | undefined;
      if (pkg.repository) {
        if (typeof pkg.repository === 'string') {
          repository = normalizeRepositoryUrl(pkg.repository);
        } else if (typeof pkg.repository === 'object' && pkg.repository.url) {
          repository = normalizeRepositoryUrl(pkg.repository.url);
        }
      }

      const parsed = parseAuthor(pkg.author);
      const publisher = parsed.name;
      const author = parsed.email ? `${parsed.name || ''} <${parsed.email}>`.trim() : parsed.name;

      let license: string | undefined;
      if (pkg.license) {
        license = typeof pkg.license === 'string' ? pkg.license : (pkg.license as { type?: string }).type;
      } else if (Array.isArray(pkg.licenses)) {
        license = pkg.licenses.map((l) => l.type || 'UNKNOWN').join(' AND ');
      }

      const info: PackageInfo = {
        name: pkg.name || packageName,
        version: pkg.version || 'unknown',
        path: packageRoot,
        packageJsonPath,
        chunks: [chunkName],
        modules: [modulePath],
        repository,
        homepage: pkg.homepage,
        author,
        publisher,
        private: pkg.private === true,
        license,
      };

      this.cache.set(packageRoot, info);
      return info;
    } catch {
      return null;
    }
  }

  private mergeModuleInfo(existing: PackageInfo, chunkName: string, modulePath: string): PackageInfo {
    if (!existing.chunks.includes(chunkName)) {
      existing.chunks.push(chunkName);
    }
    if (!existing.modules.includes(modulePath)) {
      existing.modules.push(modulePath);
    }
    return existing;
  }
}
