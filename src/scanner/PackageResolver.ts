import * as fs from 'fs';
import * as path from 'path';
import { PackageInfo } from '../model/PackageInfo';
import { normalizeRepositoryUrl, parseAuthor } from '../checker/BuiltInLicenseChecker';

interface ProjectPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class PackageResolver {
  private readonly cache = new Map<string, PackageInfo>();
  private projectDependencies: Set<string> | null = null;
  private projectRoot: string = '';

  /**
   * Set the project root path to load package.json and detect direct dependencies.
   * Should be called before resolve() when used in a scanner context.
   */
  setProjectRoot(projectRoot: string): void {
    this.projectDependencies = null;
    this.projectRoot = projectRoot;
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg: ProjectPackageJson = JSON.parse(content);
        const deps = new Set<string>();
        if (pkg.dependencies) {
          Object.keys(pkg.dependencies).forEach((key) => deps.add(key));
        }
        if (pkg.devDependencies) {
          Object.keys(pkg.devDependencies).forEach((key) => deps.add(key));
        }
        this.projectDependencies = deps;
      }
    } catch {
      // Ignore errors loading package.json
    }
  }

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

      // Check if this package is listed in the project's dependencies or devDependencies
      const isDirect = this.projectDependencies?.has(packageName) ?? false;

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
        direct: isDirect,
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
