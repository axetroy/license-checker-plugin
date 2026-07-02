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

  initialize(startPath: string, context: LicensePluginContext): boolean {
    if (!this.options.cache) {
      this.db = new LicenseDatabase();
    }

    try {
      this.db.initialize(startPath);
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
    const entries = this.resolveLicenseEntries(packages);
    const errors = this.checkCompliance(entries);
    if (errors.length > 0) {
      for (const err of errors) context.reportError(err);
      return { items: [], errors };
    }

    let items = this.buildOutputItems(entries);
    this.recordReport(items);
    if (this.options.recordOnly) return { items: [], errors: [] };

    if (this.options.recorder && this.options.waitForRecorderCount !== undefined) {
      try {
        items = this.mergeReports(items, await this.options.recorder.waitForReports(this.options.waitForRecorderCount));
      } catch (error) {
        context.reportError(String(error));
        return { items: [], errors: [String(error)] };
      }
    }

    items.sort((a, b) => a.package.name.localeCompare(b.package.name));
    return { items, errors: [] };
  }

  private resolveLicenseEntries(
    packages: Map<string, PackageInfo>
  ): Array<{ info: PackageInfo; licenseInfo: LicenseInfo }> {
    const entries: Array<{ info: PackageInfo; licenseInfo: LicenseInfo }> = [];
    for (const pkgInfo of packages.values()) {
      if (this.options.excludePackages.includes(pkgInfo.name)) continue;
      entries.push({
        info: pkgInfo,
        licenseInfo: this.filterLicenseFields(this.db.getLicense(pkgInfo.name, pkgInfo.version)),
      });
    }
    return entries;
  }

  private checkCompliance(
    entries: Array<{ info: PackageInfo; licenseInfo: LicenseInfo }>
  ): string[] {
    const errors: string[] = [];
    for (const { info, licenseInfo } of entries) {
      if (this.options.onlyAllow.length > 0 && !this.options.onlyAllow.includes(licenseInfo.license)) {
        errors.push(
          `LicensePlugin: License "${licenseInfo.license}" for package "${info.name}@${info.version}" is not in the allowed list: ${this.options.onlyAllow.join(', ')}`
        );
      } else if (this.options.failOn.length > 0 && this.options.failOn.includes(licenseInfo.license)) {
        errors.push(
          `LicensePlugin: License "${licenseInfo.license}" for package "${info.name}@${info.version}" is in the fail list`
        );
      }
    }
    return errors;
  }

  private buildOutputItems(
    entries: Array<{ info: PackageInfo; licenseInfo: LicenseInfo }>
  ): OutputItem[] {
    return entries.map(({ info, licenseInfo }) => ({
      package: {
        ...info,
        repository: this.options.includeRepository ? info.repository : undefined,
        homepage: this.options.includeHomepage ? info.homepage : undefined,
        author: this.options.includeAuthor ? info.author : undefined,
      },
      license: { ...licenseInfo },
    }));
  }

  private recordReport(items: OutputItem[]): void {
    if (this.options.recorder) {
      this.options.recorder.record({ items });
    }
  }

  private mergeReports(items: OutputItem[], allReports: LicenseBuildReport[]): OutputItem[] {
    const seen = new Set<string>();
    const merged: OutputItem[] = [];
    for (const report of allReports) {
      for (const item of report.items) {
        const key = `${item.package.name}@${item.package.version}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
    }
    return merged;
  }

  format(items: OutputItem[]): string {
    return this.createFormatter().generate(items);
  }

  private filterLicenseFields(licenseInfo: LicenseInfo): LicenseInfo {
    const result: LicenseInfo = { license: licenseInfo.license };
    if (licenseInfo.licenseFile) result.licenseFile = licenseInfo.licenseFile;
    if (this.options.includeLicenseText && licenseInfo.licenseText) {
      result.licenseText = licenseInfo.licenseText;
    }
    return result;
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
