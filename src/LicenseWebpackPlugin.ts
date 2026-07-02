// Type-only import: webpack is a peer dependency used only for TypeScript types.
// At runtime, webpack (or any compatible bundler such as Rspack) is obtained
// from compiler.webpack inside apply() to avoid hard-coding a runtime dependency
// on the webpack package.
import type { Compilation, Compiler, WebpackPluginInstance } from 'webpack';
import { LicenseDatabase } from './checker/LicenseDatabase';
import { Formatter } from './formatter/Formatter';
import { HtmlFormatter } from './formatter/HtmlFormatter';
import { JsonFormatter } from './formatter/JsonFormatter';
import { MarkdownFormatter } from './formatter/MarkdownFormatter';
import { TxtFormatter } from './formatter/TxtFormatter';
import { LicenseInfo, OutputItem } from './model/LicenseInfo';
import { LicenseBuildReport } from './model/LicenseBuildReport';
import { Recorder } from './Recorder';
import { PackageScanner } from './scanner/PackageScanner';

export type OutputFormat = 'txt' | 'json' | 'markdown' | 'html';

export interface LicenseWebpackPluginOptions {
  filename?: string;
  format?: OutputFormat;
  includeLicenseText?: boolean;
  includeRepository?: boolean;
  includeHomepage?: boolean;
  includeAuthor?: boolean;
  /**
   * Only include dependency entries whose package name exactly matches one of
   * the provided values. Matching is case-sensitive. When combined with
   * `includeLicenses`, a dependency must satisfy both include filters to remain
   * in the result set.
   */
  includePackages?: string[];
  /**
   * Exclude dependency entries whose package name exactly matches one of the
   * provided values. Matching is case-sensitive. This runs after
   * `includePackages`, so matching entries are removed even if they were
   * previously included. Exclusion is entry-based and does not automatically
   * remove transitive dependencies unless those entries also match an exclusion
   * rule.
   */
  excludePackages?: string[];
  /**
   * Only include dependency entries whose resolved license exactly matches one
   * of the provided values. Matching is case-sensitive. This runs after the
   * package filters, so it further narrows the remaining result set.
   */
  includeLicenses?: string[];
  /**
   * Exclude dependency entries whose resolved license exactly matches one of
   * the provided values. Matching is case-sensitive. This runs after
   * `includeLicenses`, so matching entries are removed even if they were
   * previously included by package name or license.
   */
  excludeLicenses?: string[];
  onlyAllow?: string[];
  failOn?: string[];
  includeChunks?: string[];
  sort?: boolean;
  deduplicateLicense?: boolean;
  cache?: boolean;
  workspaceRoot?: string;
  /**
   * When false (default), initialization errors are re-thrown and cause the build to fail.
   * Set to true to emit a warning instead and allow the build to continue.
   */
  dangerouslyAllowFailingBuild?: boolean;
  /** External recorder shared across multiple compiler instances. */
  recorder?: Recorder;
  /**
   * When true the plugin records its findings into `recorder` but does not
   * emit a license asset.  Use this on every secondary compiler instance.
   */
  recordOnly?: boolean;
  /**
   * When set (and `recorder` is provided) the plugin waits until the recorder
   * has collected this many reports before merging all of them and emitting
   * the combined license asset.  Use this on the single primary compiler
   * instance that is responsible for producing the final file.
   */
  waitForRecorderCount?: number;
}

const PLUGIN_NAME = 'LicenseWebpackPlugin';

/**
 * Fallback stage value for processAssets used when compiler.webpack is not
 * available.  Matches Compilation.PROCESS_ASSETS_STAGE_REPORT in webpack 5
 * and Rspack (both define this constant as 5000).
 */
const DEFAULT_PROCESS_ASSETS_STAGE_REPORT = 5000;

export class LicenseWebpackPlugin implements WebpackPluginInstance {
  private readonly options: Required<
    Omit<LicenseWebpackPluginOptions, 'recorder' | 'waitForRecorderCount' | 'dangerouslyAllowFailingBuild'>
  > & {
    recorder: Recorder | undefined;
    waitForRecorderCount: number | undefined;
    dangerouslyAllowFailingBuild: boolean;
  };
  private db: LicenseDatabase;

  constructor(options: LicenseWebpackPluginOptions = {}) {
    this.options = {
      filename: options.filename || 'licenses.txt',
      format: options.format || 'txt',
      includeLicenseText: options.includeLicenseText !== false,
      includeRepository: options.includeRepository !== false,
      includeHomepage: options.includeHomepage !== false,
      includeAuthor: options.includeAuthor !== false,
      includePackages: options.includePackages || [],
      excludePackages: options.excludePackages || [],
      includeLicenses: options.includeLicenses || [],
      excludeLicenses: options.excludeLicenses || [],
      onlyAllow: options.onlyAllow || [],
      failOn: options.failOn || [],
      includeChunks: options.includeChunks || [],
      sort: options.sort !== false,
      deduplicateLicense: options.deduplicateLicense !== false,
      cache: options.cache !== false,
      workspaceRoot: options.workspaceRoot || '',
      dangerouslyAllowFailingBuild: options.dangerouslyAllowFailingBuild === true,
      recorder: options.recorder,
      recordOnly: options.recordOnly === true,
      waitForRecorderCount: options.waitForRecorderCount,
    };
    this.db = new LicenseDatabase();
  }

  apply(compiler: Compiler): void {
    // Obtain webpack (or the host bundler such as Rspack) from the compiler
    // object rather than importing it directly.  Both webpack 5 and Rspack
    // expose the bundler namespace as compiler.webpack, which provides
    // Compilation constants and the sources API needed by this plugin.
    const wp = (compiler as { webpack?: typeof import('webpack') }).webpack;

    // PROCESS_ASSETS_STAGE_REPORT is 5000 in webpack 5 and Rspack.
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
    wp: typeof import('webpack') | undefined
  ): Promise<void> {
    const startPath = this.options.workspaceRoot || compiler.context;

    if (!this.options.cache) {
      this.db = new LicenseDatabase();
    }

    try {
      await this.db.initialize(startPath);
    } catch (error) {
      const errorMessage = `LicenseWebpackPlugin: Failed to initialize license database: ${String(error)}`;
      if (this.options.dangerouslyAllowFailingBuild) {
        compilation.warnings.push(new Error(errorMessage));
        return;
      } else {
        compilation.errors.push(new Error(errorMessage));
        return;
      }
    }

    const scanner = new PackageScanner();
    const packages = scanner.scan(compilation);
    let items: OutputItem[] = [];
    const seenLicenseTexts = new Set<string>();
    const licenseErrors: string[] = [];

    for (const pkgInfo of packages.values()) {
      if (this.options.includeChunks.length > 0) {
        const hasIncludedChunk = pkgInfo.chunks.some((chunk) => this.options.includeChunks.includes(chunk));
        if (!hasIncludedChunk) {
          continue;
        }
      }

      if (this.options.includePackages.length > 0 && !this.options.includePackages.includes(pkgInfo.name)) {
        continue;
      }
      if (this.options.excludePackages.includes(pkgInfo.name)) {
        continue;
      }

      const licenseInfo = this.filterLicenseFields(this.db.getLicense(pkgInfo.name, pkgInfo.version));

      if (this.options.includeLicenses.length > 0 && !this.options.includeLicenses.includes(licenseInfo.license)) {
        continue;
      }
      if (this.options.excludeLicenses.includes(licenseInfo.license)) {
        continue;
      }

      if (this.options.onlyAllow.length > 0 && !this.options.onlyAllow.includes(licenseInfo.license)) {
        licenseErrors.push(
          `LicenseWebpackPlugin: License "${licenseInfo.license}" for package "${pkgInfo.name}@${pkgInfo.version}" is not in the allowed list: ${this.options.onlyAllow.join(', ')}`
        );
        continue;
      }

      if (this.options.failOn.length > 0 && this.options.failOn.includes(licenseInfo.license)) {
        licenseErrors.push(
          `LicenseWebpackPlugin: License "${licenseInfo.license}" for package "${pkgInfo.name}@${pkgInfo.version}" is in the fail list`
        );
        continue;
      }

      const normalizedLicense = { ...licenseInfo };
      if (this.options.deduplicateLicense && normalizedLicense.licenseText) {
        const text = normalizedLicense.licenseText;
        if (seenLicenseTexts.has(text)) {
          normalizedLicense.licenseText = undefined;
        } else {
          seenLicenseTexts.add(text);
        }
      }

      items.push({ package: pkgInfo, license: normalizedLicense });
    }

    // Record this compilation's findings if a recorder is provided.
    if (this.options.recorder) {
      const report: LicenseBuildReport = { items };
      this.options.recorder.record(report);
    }

    // Report all license violations and skip asset emission.
    if (licenseErrors.length > 0) {
      for (const errMsg of licenseErrors) {
        compilation.errors.push(new Error(errMsg));
      }
      return;
    }

    // In record-only mode, skip emitting the asset.
    if (this.options.recordOnly) {
      return;
    }

    // If a recorder is provided and a count is expected, wait for all reports
    // and merge them before emitting the combined asset.
    if (this.options.recorder && this.options.waitForRecorderCount !== undefined) {
      let allReports: LicenseBuildReport[];
      try {
        allReports = await this.options.recorder.waitForReports(this.options.waitForRecorderCount);
      } catch (error) {
        compilation.errors.push(error as Error);
        return;
      }

      // Merge items from all reports and deduplicate by package name+version.
      const seen = new Set<string>();
      const mergedItems: OutputItem[] = [];
      for (const report of allReports) {
        for (const item of report.items) {
          const key = `${item.package.name}@${item.package.version}`;
          if (!seen.has(key)) {
            seen.add(key);
            mergedItems.push(item);
          }
        }
      }
      items = mergedItems;
    }

    if (this.options.sort) {
      items = items.sort((a, b) => a.package.name.localeCompare(b.package.name));
    }

    const formatter = this.createFormatter();

    // Use the sources API from the bundler namespace obtained in apply().
    // If it is not available, emit a warning and skip asset generation rather
    // than throwing, so the build does not fail unexpectedly.
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
    compilation.emitAsset(this.options.filename, new sourcesApi.RawSource(formatter.generate(items)));
  }

  private filterLicenseFields(licenseInfo: LicenseInfo): LicenseInfo {
    return {
      ...licenseInfo,
      repository: this.options.includeRepository ? licenseInfo.repository : undefined,
      homepage: this.options.includeHomepage ? licenseInfo.homepage : undefined,
      author: this.options.includeAuthor ? licenseInfo.author : undefined,
      licenseText: this.options.includeLicenseText ? licenseInfo.licenseText : undefined,
    };
  }

  private createFormatter(): Formatter {
    switch (this.options.format) {
      case 'json':
        return new JsonFormatter();
      case 'markdown':
        return new MarkdownFormatter();
      case 'html':
        return new HtmlFormatter();
      case 'txt':
      default:
        return new TxtFormatter({ includeLicenseText: this.options.includeLicenseText });
    }
  }
}
