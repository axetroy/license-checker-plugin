import { Compilation, Compiler, WebpackPluginInstance, sources } from 'webpack';
import { LicenseDatabase } from './checker/LicenseDatabase';
import { Formatter } from './formatter/Formatter';
import { HtmlFormatter } from './formatter/HtmlFormatter';
import { JsonFormatter } from './formatter/JsonFormatter';
import { MarkdownFormatter } from './formatter/MarkdownFormatter';
import { ReportFormatter } from './formatter/ReportFormatter';
import { TxtFormatter } from './formatter/TxtFormatter';
import { LicenseBuildReport } from './model/BuildReport';
import { LicenseInfo, OutputItem } from './model/LicenseInfo';
import { PackageScanner } from './scanner/PackageScanner';

export type OutputFormat = 'txt' | 'json' | 'markdown' | 'html';
export type OutputMode = 'per-compilation' | 'report-only' | 'aggregate';

export interface MergeReportsOptions {
  deduplicate?: boolean;
  format?: OutputFormat;
  includeLicenseText?: boolean;
}

export interface LicenseWebpackPluginOptions {
  filename?: string;
  format?: OutputFormat;
  includeLicenseText?: boolean;
  includeRepository?: boolean;
  includeHomepage?: boolean;
  includeAuthor?: boolean;
  includePackages?: string[];
  excludePackages?: string[];
  includeLicenses?: string[];
  excludeLicenses?: string[];
  onlyAllow?: string[];
  failOn?: string[];
  includeChunks?: string[];
  sort?: boolean;
  deduplicateLicense?: boolean;
  cache?: boolean;
  workspaceRoot?: string;
  buildName?: string;
  outputMode?: OutputMode;
  reportFile?: string;
  aggregateKey?: string;
  emitMergedAsset?: boolean;
}

const PLUGIN_NAME = 'LicenseWebpackPlugin';

export class LicenseWebpackPlugin implements WebpackPluginInstance {
  private readonly options: Required<LicenseWebpackPluginOptions>;
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
      buildName: options.buildName || '',
      outputMode: options.outputMode || 'per-compilation',
      reportFile: options.reportFile || 'license-report.json',
      aggregateKey: options.aggregateKey || '',
      emitMergedAsset: options.emitMergedAsset || false,
    };
    this.db = new LicenseDatabase();
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        async () => {
          try {
            await this.generateLicenses(compiler, compilation);
          } catch (error) {
            compilation.errors.push(error as Error);
          }
        }
      );
    });
  }

  private async generateLicenses(compiler: Compiler, compilation: Compilation): Promise<void> {
    const startPath = this.options.workspaceRoot || compiler.context;

    if (!this.options.cache) {
      this.db = new LicenseDatabase();
    }

    try {
      await this.db.initialize(startPath);
    } catch (error) {
      compilation.warnings.push(
        new Error(`LicenseWebpackPlugin: Failed to initialize license database: ${String(error)}`)
      );
      return;
    }

    const scanner = new PackageScanner();
    const packages = scanner.scan(compilation);
    let items: OutputItem[] = [];
    const seenLicenseTexts = new Set<string>();

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
        throw new Error(
          `LicenseWebpackPlugin: License "${licenseInfo.license}" for package "${pkgInfo.name}@${pkgInfo.version}" is not in the allowed list: ${this.options.onlyAllow.join(', ')}`
        );
      }

      if (this.options.failOn.length > 0 && this.options.failOn.includes(licenseInfo.license)) {
        throw new Error(
          `LicenseWebpackPlugin: License "${licenseInfo.license}" for package "${pkgInfo.name}@${pkgInfo.version}" is in the fail list`
        );
      }

      const normalizedLicense = { ...licenseInfo };
      if (this.options.deduplicateLicense && normalizedLicense.licenseText) {
        if (seenLicenseTexts.has(normalizedLicense.licenseText)) {
          normalizedLicense.licenseText = undefined;
        } else {
          seenLicenseTexts.add(normalizedLicense.licenseText);
        }
      }

      items.push({ package: pkgInfo, license: normalizedLicense });
    }

    if (this.options.sort) {
      items = items.sort((a, b) => a.package.name.localeCompare(b.package.name));
    }

    const { outputMode } = this.options;

    if (outputMode === 'per-compilation') {
      const formatter = this.createFormatter();
      compilation.emitAsset(this.options.filename, new sources.RawSource(formatter.generate(items)));
    } else if (outputMode === 'report-only' || outputMode === 'aggregate') {
      const report = this.buildReport(compiler, items);
      compilation.emitAsset(this.options.reportFile, new sources.RawSource(JSON.stringify(report, null, 2)));
    }
  }

  private buildReport(compiler: Compiler, items: OutputItem[]): LicenseBuildReport {
    const project = this.options.workspaceRoot || compiler.context;
    const buildName = this.options.buildName || undefined;
    const aggregateKey = this.options.aggregateKey || undefined;
    return {
      project,
      buildName,
      aggregateKey,
      generatedAt: new Date().toISOString(),
      packages: items.map((item) => ({
        name: item.package.name,
        version: item.package.version,
        chunks: item.package.chunks,
        buildName,
        license: item.license,
      })),
    };
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

  static mergeReports(reports: LicenseBuildReport[], options: MergeReportsOptions = {}): OutputItem[] | string {
    const mergedItems: OutputItem[] = [];
    const seenKeys = new Set<string>();

    for (const report of reports) {
      for (const pkg of report.packages) {
        const key = `${pkg.name}@${pkg.version}`;
        if (options.deduplicate && seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
        mergedItems.push({
          package: {
            name: pkg.name,
            version: pkg.version,
            path: '',
            packageJsonPath: '',
            chunks: pkg.chunks,
            modules: [],
          },
          license: pkg.license,
        });
      }
    }

    if (options.format) {
      let formatter: Formatter;
      switch (options.format) {
        case 'json':
          formatter = new JsonFormatter();
          break;
        case 'markdown':
          formatter = new MarkdownFormatter();
          break;
        case 'html':
          formatter = new HtmlFormatter();
          break;
        case 'txt':
        default:
          formatter = new TxtFormatter({ includeLicenseText: options.includeLicenseText });
          break;
      }
      return formatter.generate(mergedItems);
    }

    return mergedItems;
  }
}
