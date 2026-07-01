import { Chunk, Compilation, Module } from 'webpack';
import { PackageInfo } from '../model/PackageInfo';
import { PackageResolver } from './PackageResolver';

type ResourceModule = Module & {
  resource?: string;
  userRequest?: string;
  rootModule?: { resource?: string; userRequest?: string };
};

export class PackageScanner {
  private readonly resolver: PackageResolver;

  constructor() {
    this.resolver = new PackageResolver();
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
    const resourceModule = module as ResourceModule;
    return (
      resourceModule.resource ||
      resourceModule.userRequest ||
      resourceModule.rootModule?.resource ||
      resourceModule.rootModule?.userRequest ||
      null
    );
  }
}
