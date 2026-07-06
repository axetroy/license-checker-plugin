import * as fs from 'fs';
import * as path from 'path';
import { PackageInfo } from '../model/PackageInfo';
import { normalizeRepositoryUrl, parseAuthor } from '../checker/BuiltInLicenseChecker';

interface ProjectPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageMeta {
  name: string;
  version: string;
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

      // Build dependency path
      const dependencyPath = this.buildDependencyPath(normalizedPath, nodeModulesIdx);

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
        dependencyPath,
      };

      this.cache.set(packageRoot, info);
      return info;
    } catch {
      return null;
    }
  }

  /**
   * Build the dependency path from project root to the target package.
   * Returns "/" for direct dependencies, or "/parent@version/..." for indirect dependencies.
   */
  private buildDependencyPath(modulePath: string, nodeModulesIdx: number): string {
    // Get the prefix before this node_modules (everything from project root to this node_modules parent)
    const beforeNodeModules = modulePath.slice(0, nodeModulesIdx);
    
    // Extract what comes after node_modules (target package and its subpath)
    const afterNodeModules = modulePath.slice(nodeModulesIdx + '/node_modules/'.length);
    
    // Parse the chain of parent packages from beforeNodeModules
    const packages = this.parseDependencyChain(beforeNodeModules);
    
    // Build path like "/packageA@1.0.0/packageB@2.0.0"
    if (packages.length === 0) {
      return '/';
    }
    
    return '/' + packages.map(p => `${p.name}@${p.version}`).join('/');
  }
  
  /**
   * Parse the dependency chain from the path segment.
   * Returns array of {name, version} for each parent package.
   */
  private parseDependencyChain(pathSegment: string): PackageMeta[] {
    const packages: PackageMeta[] = [];
    
    // Build the dependency chain by walking through the path
    // Looking for node_modules directories and extracting package info
    
    // Use a regex to find all /node_modules/ occurrences and extract what follows
    const regex = /\/node_modules\/((?:@[^/]+\/)?[^/]+)/g;
    let match;
    
    while ((match = regex.exec(pathSegment)) !== null) {
      const packageDirName = match[1]; // e.g., "pkgA" or "@scope/pkgA"
      
      if (!packageDirName) continue;
      
      // Find where this package's directory starts in the path
      const packagePathMatch = pathSegment.indexOf(`/node_modules/${packageDirName}`);
      if (packagePathMatch === -1) continue;
      
      // The package path is everything up to and including node_modules/packageDirName
      const packagePath = pathSegment.slice(0, packagePathMatch + `/node_modules/${packageDirName}`.length);
      const packageJsonPath = path.join(packagePath.replace(/\//g, path.sep), 'package.json');
      
      try {
        const pkgContent = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(pkgContent) as { name?: string; version?: string };
        packages.push({
          name: pkg.name || packageDirName,
          version: pkg.version || 'unknown',
        });
      } catch {
        packages.push({
          name: packageDirName,
          version: 'unknown',
        });
      }
    }
    
    return packages;
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
