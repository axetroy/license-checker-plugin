import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import spdxExpressionParse from 'spdx-expression-parse';
import { LicenseDatabase } from './checker/LicenseDatabase';
import { normalizeLicense } from './checker/BuiltInLicenseChecker';
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
  /**
   * Include additional packages that are not bundled but should appear in
   * the license output (e.g., Electron for Electron apps where the runtime
   * is not bundled but needs to be documented).
   * Can be a list of package names, or a predicate function
   * `(packageName: string) => boolean`.
   */
  includePackages?: (string | ((name: string) => boolean))[];
  /**
   * Exclude specific packages from the output.
   * Can be a list of package names, or a predicate function
   * `(packageName: string) => boolean`.
   */
  excludePackages?: (string | ((name: string) => boolean))[];
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
      includePackages: options.includePackages || [],
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
      await this.db.initialize(startPath, this.options.includeLicenseText);
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
    
    // Add packages from includePackages that are not already in entries
    if (this.options.includePackages.length > 0) {
      const includedPackages = this.resolveIncludedPackages();
      for (const included of includedPackages) {
        // Skip if already included via bundled packages
        if (entries.some((e) => e.info.name === included.info.name && e.info.version === included.info.version)) {
          continue;
        }
        entries.push(included);
      }
    }
    
    const errors = this.checkCompliance(entries);

    let items: OutputItem[];
    if (errors.length > 0) {
      for (const err of errors) context.reportError(err);
      this.recordReport([]);
      return { items: [], errors };
    }

    items = this.buildOutputItems(entries);
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
      if (this.options.excludePackages.some((e) => (typeof e === 'function' ? e(pkgInfo.name) : e === pkgInfo.name))) continue;

      let licenseInfo = this.db.getLicense(pkgInfo.name, pkgInfo.version);

      if (licenseInfo.license === 'UNKNOWN') {
        if (pkgInfo.license) {
          licenseInfo = { license: pkgInfo.license };
        } else {
          licenseInfo = this.readLicenseFromPackage(pkgInfo);
        }
      }

      entries.push({
        info: pkgInfo,
        licenseInfo: this.filterLicenseFields(licenseInfo),
      });
    }
    return entries;
  }

  private resolveIncludedPackages(): Array<{ info: PackageInfo; licenseInfo: LicenseInfo }> {
    const entries: Array<{ info: PackageInfo; licenseInfo: LicenseInfo }> = [];
    const seen = new Set<string>();
    
    for (const pkgPattern of this.options.includePackages) {
      // Get all packages from the database that match the pattern
      const allLicenses = this.db.getAllLicenses();
      for (const [key, licenseInfo] of allLicenses) {
        // Parse package name and version from key (format: "name@version" or "@scope/name@version")
        let name: string;
        let version: string;
        
        if (key.startsWith('@')) {
          // Scoped package: @scope/name@version
          const parts = key.split('@');
          if (parts.length < 3) continue;
          name = `${parts[0]}@${parts[1]}`;
          version = parts[2];
        } else {
          // Regular package: name@version
          const atIndex = key.indexOf('@');
          if (atIndex === -1) continue;
          name = key.substring(0, atIndex);
          version = key.substring(atIndex + 1);
        }
        
        // Check if this package matches the pattern
        const isWildcard = pkgPattern === '*';
        const isFunction = typeof pkgPattern === 'function';
        const isMatch = isWildcard || (isFunction && pkgPattern(name)) || (!isFunction && name === pkgPattern);
        
        if (!isMatch) continue;
        
        // Skip if this package is already added
        if (seen.has(name)) continue;
        seen.add(name);
        
        // Skip if this package is in excludePackages
        if (this.options.excludePackages.some((e) => (typeof e === 'function' ? e(name) : e === name))) {
          continue;
        }
        
        // Build PackageInfo for this package
        const info: PackageInfo = {
          name,
          version,
          path: '',
          packageJsonPath: '',
          chunks: [],
          modules: [],
          license: licenseInfo.license,
        };
        
        entries.push({
          info,
          licenseInfo: this.filterLicenseFields(licenseInfo),
        });
      }
    }
    
    return entries;
  }

  private checkCompliance(
    entries: Array<{ info: PackageInfo; licenseInfo: LicenseInfo }>
  ): string[] {
    const errors: string[] = [];
    for (const { info, licenseInfo } of entries) {
      if (this.options.onlyAllow.length > 0 && !this.isAllowed(licenseInfo.license)) {
        errors.push(
          `LicensePlugin: License "${licenseInfo.license}" for package "${info.name}@${info.version}" is not in the allowed list: ${this.options.onlyAllow.join(', ')}`
        );
      }
      if (this.options.failOn.length > 0 && this.isFailed(licenseInfo.license)) {
        errors.push(
          `LicensePlugin: License "${licenseInfo.license}" for package "${info.name}@${info.version}" is in the fail list`
        );
      }
    }
    return errors;
  }

  private isAllowed(license: string): boolean {
    if (this.options.onlyAllow.includes(license)) return true;
    const ids = this.parseSpdxIdentifiers(license);
    if (!ids) return false;
    if (ids.conjunction === 'and') return ids.identifiers.every((id) => this.options.onlyAllow.includes(id));
    if (ids.conjunction === 'or') return ids.identifiers.some((id) => this.options.onlyAllow.includes(id));
    return false;
  }

  private isFailed(license: string): boolean {
    if (this.options.failOn.includes(license)) return true;
    const ids = this.parseSpdxIdentifiers(license);
    if (!ids) return false;
    if (ids.conjunction === 'or') return ids.identifiers.every((id) => this.options.failOn.includes(id));
    return ids.identifiers.some((id) => this.options.failOn.includes(id));
  }

  private parseSpdxIdentifiers(
    license: string
  ): { identifiers: string[]; conjunction: 'and' | 'or' } | null {
    try {
      const node = spdxExpressionParse(license);
      const identifiers: string[] = [];
      let conjunction: 'and' | 'or' | null = null;
      const walk = (n: typeof node): void => {
        if ('license' in n) {
          identifiers.push((n as { license: string }).license);
        } else {
          const expr = n as { left: typeof node; right: typeof node; conjunction: string };
          if (!conjunction) conjunction = expr.conjunction as 'and' | 'or';
          walk(expr.left);
          walk(expr.right);
        }
      };
      walk(node);
      if (!conjunction) return null;
      return { identifiers, conjunction };
    } catch {
      return null;
    }
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

  private readLicenseFromPackage(pkgInfo: PackageInfo): LicenseInfo {
    try {
      const raw = readFileSync(pkgInfo.packageJsonPath, 'utf-8');
      const pkg = JSON.parse(raw) as {
        license?: string | { type?: string };
        licenses?: Array<{ type?: string }>;
      };

      let licenseStr: string | undefined;
      if (pkg.license) {
        licenseStr = typeof pkg.license === 'string' ? pkg.license : (pkg.license as { type?: string }).type;
      } else if (Array.isArray(pkg.licenses)) {
        licenseStr = pkg.licenses.map((l) => l.type || 'UNKNOWN').join(' AND ');
      }

      if (!licenseStr) return { license: 'UNKNOWN' };
      licenseStr = normalizeLicense(licenseStr);

      const result: LicenseInfo = { license: licenseStr };

      if (this.options.includeLicenseText) {
        const licenseText = this.readLicenseFileText(pkgInfo.path);
        if (licenseText) {
          result.licenseText = licenseText;
        }
      }

      return result;
    } catch {
      return { license: 'UNKNOWN' };
    }
  }

  private readLicenseFileText(packageDir: string): string | undefined {
    const basenames = [
      /^LICENSE$/i, /^LICENSE\-\w+$/i, /^LICENCE$/i, /^LICENCE\-\w+$/i,
      /^MIT-LICENSE$/i, /^COPYING$/i, /^COPYRIGHT$/i,
    ];
    try {
      const files = readdirSync(packageDir);
      const candidates: Array<{ file: string; order: number }> = [];
      for (const file of files) {
        const fullPath = join(packageDir, file);
        try {
          if (!statSync(fullPath).isFile()) continue;
        } catch {
          continue;
        }
        for (let i = 0; i < basenames.length; i++) {
          if (basenames[i].test(file)) {
            candidates.push({ file: fullPath, order: i });
            break;
          }
        }
      }
      candidates.sort((a, b) => a.order - b.order);
      if (candidates.length > 0) {
        return readFileSync(candidates[0].file, 'utf-8');
      }
    } catch {
      // ignore
    }
    return undefined;
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
