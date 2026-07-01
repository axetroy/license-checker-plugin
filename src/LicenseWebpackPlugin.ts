import { Compilation, Compiler, MultiCompiler, WebpackPluginInstance, sources } from 'webpack';
import { LicenseDatabase } from './checker/LicenseDatabase';
import { Formatter } from './formatter/Formatter';
import { HtmlFormatter } from './formatter/HtmlFormatter';
import { JsonFormatter } from './formatter/JsonFormatter';
import { MarkdownFormatter } from './formatter/MarkdownFormatter';
import { TxtFormatter } from './formatter/TxtFormatter';
import { LicenseInfo, OutputItem } from './model/LicenseInfo';
import { LicenseBuildReport } from './model/LicenseBuildReport';
import { PackageScanner } from './scanner/PackageScanner';

export type OutputFormat = 'txt' | 'json' | 'markdown' | 'html';

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
  mergeAcrossCompilers?: boolean;
  mergeKey?: string;
  mergeWhenAllCompilersDone?: boolean;
  mergedFilename?: string;
}

const PLUGIN_NAME = 'LicenseWebpackPlugin';
const compilerIds = new WeakMap<Compiler, number>();
let compilerIdCounter = 0;

interface CompilerMergeState {
  expectedCount?: number;
  reports: Map<number, LicenseBuildReport>;
  knownCompilers: Set<number>;
  completedCompilers: Set<number>;
  startedAt: number;
  lastCompilation?: Compilation;
  emitted: boolean;
}

export class LicenseWebpackPlugin implements WebpackPluginInstance {
  private readonly options: Required<LicenseWebpackPluginOptions>;
  private db: LicenseDatabase;
  private static readonly mergeStates = new Map<string, CompilerMergeState>();

  constructor(options: LicenseWebpackPluginOptions = {}) {
    const mergeAcrossCompilers = options.mergeAcrossCompilers === true;
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
      mergeAcrossCompilers,
      mergeKey: options.mergeKey || '',
      mergeWhenAllCompilersDone: options.mergeWhenAllCompilersDone ?? mergeAcrossCompilers,
      mergedFilename: options.mergedFilename || '',
    };
    this.db = new LicenseDatabase();
  }

  static mergeReports(
    reports: LicenseBuildReport[],
    options: Pick<LicenseWebpackPluginOptions, 'sort' | 'deduplicateLicense'> = {}
  ): LicenseBuildReport {
    let items: OutputItem[] = [];
    const seenPackages = new Set<string>();

    for (const report of reports) {
      for (const item of report.items) {
        const key = `${item.package.name}@${item.package.version}`;
        if (seenPackages.has(key)) {
          continue;
        }
        seenPackages.add(key);
        items.push({
          package: { ...item.package },
          license: { ...item.license },
        });
      }
    }

    if (options.sort !== false) {
      items = items.sort((a, b) => a.package.name.localeCompare(b.package.name));
    }

    if (options.deduplicateLicense !== false) {
      const seenLicenseTexts = new Set<string>();
      items = items.map((item) => {
        const nextItem = {
          package: { ...item.package },
          license: { ...item.license },
        };
        if (nextItem.license.licenseText) {
          if (seenLicenseTexts.has(nextItem.license.licenseText)) {
            nextItem.license.licenseText = undefined;
          } else {
            seenLicenseTexts.add(nextItem.license.licenseText);
          }
        }
        return nextItem;
      });
    }

    return {
      items,
      generatedAt: Date.now(),
    };
  }

  apply(compiler: Compiler | MultiCompiler): void {
    const multiCompiler = compiler as MultiCompiler & { compilers?: Compiler[] };
    if (Array.isArray(multiCompiler.compilers)) {
      for (const childCompiler of multiCompiler.compilers) {
        this.apply(childCompiler);
      }
      return;
    }

    const webpackCompiler = compiler as Compiler;
    const mergeKey = this.resolveMergeKey(webpackCompiler);
    const compilerId = this.getCompilerId(webpackCompiler);
    const mergeState = this.options.mergeAcrossCompilers
      ? this.getOrCreateMergeState(mergeKey, compilerId)
      : undefined;

    webpackCompiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        async () => {
          try {
            const report = await this.generateLicenses(webpackCompiler, compilation);
            if (!report) {
              return;
            }

            if (!mergeState) {
              this.emitReport(compilation, report, this.options.filename);
              return;
            }

            mergeState.reports.set(compilerId, report);
            mergeState.lastCompilation = compilation;
            if (this.shouldEmitMergedReport(mergeState)) {
              this.emitMergedReport(mergeKey, mergeState);
            }
          } catch (error) {
            compilation.errors.push(error as Error);
          }
        }
      );
    });

    if (mergeState) {
      webpackCompiler.hooks.done.tap(PLUGIN_NAME, () => {
        mergeState.completedCompilers.add(compilerId);
        if (
          typeof mergeState.expectedCount === 'number' &&
          mergeState.completedCompilers.size >= mergeState.expectedCount &&
          !mergeState.emitted
        ) {
          LicenseWebpackPlugin.mergeStates.delete(mergeKey);
        }
      });
    }
  }

  private async generateLicenses(compiler: Compiler, compilation: Compilation): Promise<LicenseBuildReport | null> {
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
      return null;
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

    return {
      items,
      generatedAt: Date.now(),
      compilerName: compiler.options.name || compilation.name,
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

  private emitReport(compilation: Compilation, report: LicenseBuildReport, filename: string): void {
    const formatter = this.createFormatter();
    compilation.emitAsset(filename, new sources.RawSource(formatter.generate(report.items)));
  }

  private shouldEmitMergedReport(mergeState: CompilerMergeState): boolean {
    if (mergeState.emitted) {
      return false;
    }
    if (typeof mergeState.expectedCount === 'number') {
      return mergeState.reports.size >= mergeState.expectedCount;
    }
    return false;
  }

  private emitMergedReport(mergeKey: string, mergeState: CompilerMergeState): void {
    if (!mergeState.lastCompilation) {
      return;
    }
    const mergedReport = LicenseWebpackPlugin.mergeReports(Array.from(mergeState.reports.values()), {
      sort: this.options.sort,
      deduplicateLicense: this.options.deduplicateLicense,
    });
    this.emitReport(mergeState.lastCompilation, mergedReport, this.resolveMergedFilename());
    mergeState.emitted = true;
    LicenseWebpackPlugin.mergeStates.delete(mergeKey);
  }

  private resolveMergedFilename(): string {
    const mergedFilename = this.options.mergedFilename.trim();
    if (mergedFilename.length > 0) {
      return mergedFilename;
    }
    const filename = this.options.filename.trim();
    if (filename.length > 0) {
      return filename;
    }
    return 'licenses.txt';
  }

  private resolveMergeKey(compiler: Compiler): string {
    if (this.options.mergeKey.trim().length > 0) {
      return this.options.mergeKey;
    }
    if (this.options.workspaceRoot.trim().length > 0) {
      return this.options.workspaceRoot;
    }
    return compiler.context;
  }

  private getOrCreateMergeState(mergeKey: string, compilerId?: number): CompilerMergeState {
    let mergeState = LicenseWebpackPlugin.mergeStates.get(mergeKey);
    if (!mergeState) {
      mergeState = {
        expectedCount: undefined,
        reports: new Map<number, LicenseBuildReport>(),
        knownCompilers: new Set<number>(),
        completedCompilers: new Set<number>(),
        startedAt: Date.now(),
        emitted: false,
      };
      LicenseWebpackPlugin.mergeStates.set(mergeKey, mergeState);
    }
    if (typeof compilerId === 'number') {
      mergeState.knownCompilers.add(compilerId);
      mergeState.expectedCount = Math.max(mergeState.expectedCount ?? 0, mergeState.knownCompilers.size);
    }
    return mergeState;
  }

  private getCompilerId(compiler: Compiler): number {
    const currentId = compilerIds.get(compiler);
    if (typeof currentId === 'number') {
      return currentId;
    }
    compilerIdCounter += 1;
    compilerIds.set(compiler, compilerIdCounter);
    return compilerIdCounter;
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
