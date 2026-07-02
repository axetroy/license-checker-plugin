import type { Compilation, Compiler, WebpackPluginInstance } from 'webpack';
import { LicensePluginCore } from './LicensePluginCore';
import type { LicensePluginOptions, OutputFormat } from './LicensePluginCore';
import { PackageScanner } from './scanner/PackageScanner';

export type { LicensePluginOptions, OutputFormat };
/** @deprecated Use `LicensePluginOptions` instead. */
export type LicenseWebpackPluginOptions = LicensePluginOptions;

const PLUGIN_NAME = 'LicenseWebpackPlugin';
const DEFAULT_PROCESS_ASSETS_STAGE_REPORT = 5000;

interface CompilerWithWebpack {
  webpack?: {
    Compilation: { PROCESS_ASSETS_STAGE_REPORT: number };
    sources: { RawSource: new (source: string | Buffer) => import('webpack').sources.Source };
  };
}

export class LicenseWebpackPlugin implements WebpackPluginInstance {
  private readonly core: LicensePluginCore;

  constructor(options: LicensePluginOptions = {}) {
    this.core = new LicensePluginCore(options);
  }

  apply(compiler: Compiler): void {
    const wp = (compiler as CompilerWithWebpack).webpack;
    const processAssetsStageReport =
      wp?.Compilation?.PROCESS_ASSETS_STAGE_REPORT ?? DEFAULT_PROCESS_ASSETS_STAGE_REPORT;

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: processAssetsStageReport,
        },
        async () => {
          try {
            await this.generateLicenses(compiler, compilation, wp);
          } catch (error) {
            compilation.errors.push(error as Error);
          }
        }
      );
    });
  }

  private async generateLicenses(
    compiler: Compiler,
    compilation: Compilation,
    wp: CompilerWithWebpack['webpack']
  ): Promise<void> {
    const startPath = this.core.options.workspaceRoot || compiler.context;

    const context = {
      reportError: (msg: string) => compilation.errors.push(new Error(msg)),
      reportWarning: (msg: string) => compilation.warnings.push(new Error(msg)),
    };

    const initialized = this.core.initialize(startPath, context);
    if (!initialized) return;

    const scanner = new PackageScanner();
    const packages = scanner.scan(compilation);

    const { items, errors } = await this.core.generateLicenseItems(packages, context);
    if (errors.length > 0) return;

    const sourcesApi = wp?.sources;
    if (!sourcesApi) {
      compilation.warnings.push(
        new Error(
          'LicenseWebpackPlugin: bundler sources API not available on compiler.webpack; ' +
            'license asset will not be emitted. Ensure you are using webpack 5 or Rspack.'
        )
      );
      return;
    }
    compilation.emitAsset(this.core.options.filename, new sourcesApi.RawSource(this.core.format(items)));
  }
}
