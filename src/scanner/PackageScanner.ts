import type { Chunk, Compilation, Module } from 'webpack';
import { PackageInfo } from '../model/PackageInfo.js';
import { PackageResolver } from './PackageResolver.js';

interface NormalModuleShape {
  resource?: string;
  userRequest?: string;
  rootModule?: { resource?: string; userRequest?: string };
}

function isNormalModuleShape(module: Module): module is Module & NormalModuleShape {
  return 'resource' in module || 'userRequest' in module;
}

export class PackageScanner {
  private readonly resolver: PackageResolver;

  constructor() {
    this.resolver = new PackageResolver();
  }

  setProjectRoot(projectRoot: string): void {
    this.resolver.setProjectRoot(projectRoot);
  }

  scan(compilation: Compilation): Map<string, PackageInfo> {
    const packages = new Map<string, PackageInfo>();

    for (const chunk of compilation.chunks) {
      const chunkName = chunk.name || String(chunk.id ?? 'unknown');

      for (const module of this.getChunkModules(compilation, chunk)) {
        const resource = this.getModuleResource(module);
        if (!resource) {
          continue;
        }

        const pkgInfo = this.resolver.resolve(resource, chunkName);
        if (!pkgInfo) {
          continue;
        }

        const key = `${pkgInfo.name}@${pkgInfo.version}`;
        const existing = packages.get(key);

        if (existing) {
          if (!existing.chunks.includes(chunkName)) {
            existing.chunks.push(chunkName);
          }
          if (!existing.modules.includes(resource)) {
            existing.modules.push(resource);
          }
        } else {
          packages.set(key, pkgInfo);
        }
      }
    }

    return packages;
  }

  private getChunkModules(compilation: Compilation, chunk: Chunk): Iterable<Module> {
    return compilation.chunkGraph.getChunkModulesIterable(chunk);
  }

  private getModuleResource(module: Module): string | null {
    if (!isNormalModuleShape(module)) return null;
    return (
      module.resource ||
      module.userRequest ||
      module.rootModule?.resource ||
      module.rootModule?.userRequest ||
      null
    );
  }
}
