import { LicenseDatabase } from './checker/LicenseDatabase';
import { Formatter } from './formatter/Formatter';
import { HtmlFormatter } from './formatter/HtmlFormatter';
import { JsonFormatter } from './formatter/JsonFormatter';
import { MarkdownFormatter } from './formatter/MarkdownFormatter';
import { TxtFormatter } from './formatter/TxtFormatter';
import { LicenseInfo, OutputItem } from './model/LicenseInfo';
import { LicenseBuildReport } from './model/LicenseBuildReport';
import { PackageInfo } from './model/PackageInfo';
import { Recorder } from './Recorder';

export type OutputFormat = 'txt' | 'json' | 'markdown' | 'html';

export interface LicensePluginOptions {
  /** Output file name (e.g. `licenses.txt`, `third-party-licenses.json`). */
  filename?: string;
  /** Output format. */
  format?: OutputFormat;
  /** Include the full license text in the output. */
  includeLicenseText?: boolean;
  /** Include the repository URL in each entry. */
  includeRepository?: boolean;
  /** Include the homepage URL in each entry. */
  includeHomepage?: boolean;
  /** Include the author/publisher in each entry. */
  includeAuthor?: boolean;
  /** Exclude specific packages from the output by name. */
  excludePackages?: string[];
  /**
   * Allow only these licenses. When set, the build fails if any bundled
   * package has a license not in this list.
   */
  onlyAllow?: string[];
  /**
   * Fail the build when a bundled package license matches this list.
   * Evaluated after `onlyAllow`.
   */
  failOn?: string[];
  /**
   * Reuse the in-memory license database across multiple plugin instances
   * (e.g. in multi-compiler setups). Set to `false` to force a fresh scan
   * each time.
   */
  cache?: boolean;
  /**
   * Root path for scanning `node_modules`. Defaults to the bundler's root
   * context (project root).
   */
  workspaceRoot?: string;
  /**
   * External recorder for sharing findings across compiler instances
   * (webpack multi-compiler only).
   * @see DefaultRecorder
   */
  recorder?: Recorder;
  /**
   * When `true`, only record findings via `recorder` without emitting a
   * license asset. Use together with `recorder` and `waitForRecorderCount`
   * (webpack multi-compiler only).
   */
  recordOnly?: boolean;
  /**
   * Wait for this many reports from the shared recorder before emitting
   * the combined, deduplicated license asset.
   * Requires `recorder` to be set (webpack multi-compiler only).
   */
  waitForRecorderCount?: number;
}

export interface LicensePluginContext {
  reportError(msg: string): void;
  reportWarning(msg: string): void;
}

export class LicensePluginCore {
  readonly options: Required<
    Omit<LicensePluginOptions, 'recorder' | 'waitForRecorderCount'>
  > & {
    recorder: Recorder | undefined;
    waitForRecorderCount: number | undefined;
  };
  private db: LicenseDatabase;

  constructor(options: LicensePluginOptions = {}) {
    this.options = {
      filename: options.filename || 'licenses.txt',
      format: options.format || 'txt',
      includeLicenseText: options.includeLicenseText !== false,
      includeRepository: options.includeRepository !== false,
      includeHomepage: options.includeHomepage !== false,
      includeAuthor: options.includeAuthor !== false,
      excludePackages: options.excludePackages || [],
      onlyAllow: options.onlyAllow || [],
      failOn: options.failOn || [],
      cache: options.cache !== false,
      workspaceRoot: options.workspaceRoot || '',
      recorder: options.recorder,
      recordOnly: options.recordOnly === true,
      waitForRecorderCount: options.waitForRecorderCount,
    };
    this.db = new LicenseDatabase();
  }

  async initialize(startPath: string, context: LicensePluginContext): Promise<boolean> {
    if (!this.options.cache) {
      this.db = new LicenseDatabase();
    }

    try {
      await this.db.initialize(startPath);
      return true;
    } catch (error) {
      context.reportError(`LicensePlugin: Failed to initialize license database: ${String(error)}`);
      return false;
    }
  }

  async generateLicenseItems(
    packages: Map<string, PackageInfo>,
    context: LicensePluginContext
  ): Promise<{ items: OutputItem[]; errors: string[] }> {
    let items: OutputItem[] = [];
    const licenseErrors: string[] = [];

    for (const pkgInfo of packages.values()) {
      if (this.options.excludePackages.includes(pkgInfo.name)) {
        continue;
      }

      const licenseInfo = this.filterLicenseFields(this.db.getLicense(pkgInfo.name, pkgInfo.version));

      if (this.options.onlyAllow.length > 0 && !this.options.onlyAllow.includes(licenseInfo.license)) {
        licenseErrors.push(
          `LicensePlugin: License "${licenseInfo.license}" for package "${pkgInfo.name}@${pkgInfo.version}" is not in the allowed list: ${this.options.onlyAllow.join(', ')}`
        );
        continue;
      }

      if (this.options.failOn.length > 0 && this.options.failOn.includes(licenseInfo.license)) {
        licenseErrors.push(
          `LicensePlugin: License "${licenseInfo.license}" for package "${pkgInfo.name}@${pkgInfo.version}" is in the fail list`
        );
        continue;
      }

      items.push({ package: pkgInfo, license: { ...licenseInfo } });
    }

    if (this.options.recorder) {
      const report: LicenseBuildReport = { items };
      this.options.recorder.record(report);
    }

    if (licenseErrors.length > 0) {
      for (const errMsg of licenseErrors) {
        context.reportError(errMsg);
      }
      return { items: [], errors: licenseErrors };
    }

    if (this.options.recordOnly) {
      return { items: [], errors: [] };
    }

    if (this.options.recorder && this.options.waitForRecorderCount !== undefined) {
      let allReports: LicenseBuildReport[];
      try {
        allReports = await this.options.recorder.waitForReports(this.options.waitForRecorderCount);
      } catch (error) {
        context.reportError(String(error));
        return { items: [], errors: [String(error)] };
      }

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

    items.sort((a, b) => a.package.name.localeCompare(b.package.name));

    return { items, errors: [] };
  }

  format(items: OutputItem[]): string {
    return this.createFormatter().generate(items);
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
