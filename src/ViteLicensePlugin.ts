import { LicensePluginCore } from './LicensePluginCore';
import type { LicensePluginOptions } from './LicensePluginCore';
import { PackageResolver } from './scanner/PackageResolver';
import type { PackageInfo } from './model/PackageInfo';

const PLUGIN_NAME = 'vite-license-plugin';

// Minimal Plugin interface so Vite is not needed at compile time.
interface VitePlugin {
  name: string;
  enforce?: 'pre' | 'post';
  buildStart?: () => void | Promise<void>;
  transform?: (code: string, id: string) => string | null | undefined | void;
  generateBundle?: (this: { emitFile: (opts: { type: string; fileName: string; source: string }) => void }, opts: unknown, bundle: unknown) => void | Promise<void>;
}

export function viteLicensePlugin(options: LicensePluginOptions = {}): VitePlugin {
  const core = new LicensePluginCore(options);
  const resolver = new PackageResolver();
  const resolvedPackages = new Map<string, PackageInfo>();

  return {
    name: PLUGIN_NAME,

    enforce: 'post',

    async buildStart() {
      const root = options.workspaceRoot || process.cwd();
      const context = {
        reportError: (msg: string) => { throw new Error(msg); },
        reportWarning: (msg: string) => console.warn(`[${PLUGIN_NAME}] ${msg}`),
      };
      await core.initialize(root, context);
    },

    transform(_code: string, id: string) {
      if (!id.includes('node_modules')) return null;

      const pkgInfo = resolver.resolve(id, 'main');
      if (pkgInfo) {
        const key = `${pkgInfo.name}@${pkgInfo.version}`;
        if (!resolvedPackages.has(key)) {
          resolvedPackages.set(key, pkgInfo);
        }
      }
      return null;
    },

    async generateBundle(this: { emitFile: (opts: { type: string; fileName: string; source: string }) => void }, _opts: unknown, _bundle: unknown) {
      if (resolvedPackages.size === 0) return;

      const warnings: string[] = [];
      const errors: string[] = [];
      const context = {
        reportError: (msg: string) => { errors.push(msg); },
        reportWarning: (msg: string) => warnings.push(msg),
      };

      const { items, errors: returnedErrors } = await core.generateLicenseItems(resolvedPackages, context);
      const allErrors = errors.concat(returnedErrors);
      if (allErrors.length > 0) {
        throw new Error(allErrors.join('\n'));
      }

      const source = core.format(items);

      this.emitFile({
        type: 'asset',
        fileName: core.options.filename,
        source,
      });

      for (const w of warnings) {
        console.warn(`[${PLUGIN_NAME}] ${w}`);
      }
    },
  };
}
