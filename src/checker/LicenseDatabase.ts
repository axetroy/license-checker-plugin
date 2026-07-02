import { execFile } from 'child_process';
import { LicenseInfo } from '../model/LicenseInfo';
import { LicenseCache } from './LicenseCache';

type LicenseCheckerEntry = {
  licenses?: string | string[];
  repository?: string;
  publisher?: string;
  email?: string;
  url?: string;
  path?: string;
  licenseFile?: string;
  licenseText?: string;
  homepage?: string;
  private?: boolean;
  name?: string;
  version?: string;
};

type LicenseCheckerResult = Record<string, LicenseCheckerEntry>;
type LicenseCheckerModule = {
  init(
    options: Record<string, unknown>,
    callback: (err: Error | null, packages: LicenseCheckerResult) => void
  ): void;
};

export class LicenseDatabase {
  private readonly cache = new LicenseCache();
  private initialized = false;
  private initializedPath: string | null = null;

  async initialize(startPath: string): Promise<void> {
    if (this.initialized && this.initializedPath === startPath) {
      return;
    }

    // Clear cached data when switching to a different workspace path.
    this.cache.clear();
    this.initialized = false;

    const packages = await this.loadPackages(startPath);

    for (const [key, info] of Object.entries(packages ?? {})) {
      // license-checker can return licenses as string or string[]
      let licenseStr = 'UNKNOWN';
      if (info.licenses) {
        if (Array.isArray(info.licenses)) {
          licenseStr = info.licenses.join(' AND ');
        } else {
          licenseStr = info.licenses;
        }
      }

      // licenseText can be boolean (true) from license-checker if file is unreadable
      // Only store valid string license texts
      const licenseText =
        typeof info.licenseText === 'string' && info.licenseText.length > 0 ? info.licenseText : undefined;

      const licenseInfo: LicenseInfo = {
        license: licenseStr,
        licenseFile: info.licenseFile,
        licenseText,
        repository: info.repository,
        homepage: info.homepage || info.url,
        author: info.publisher
          ? info.email
            ? `${info.publisher} <${info.email}>`
            : info.publisher
          : undefined,
        publisher: info.publisher,
        private: info.private,
      };

      this.cache.set(key, licenseInfo);
    }

    this.initialized = true;
    this.initializedPath = startPath;
  }

  getLicense(packageName: string, packageVersion: string): LicenseInfo {
    return this.cache.get(`${packageName}@${packageVersion}`) || { license: 'UNKNOWN' };
  }

  getCache(): LicenseCache {
    return this.cache;
  }

  private async loadPackages(startPath: string): Promise<LicenseCheckerResult> {
    try {
      const licenseChecker = require('license-checker-rseidelsohn') as LicenseCheckerModule;
      return await this.runLicenseChecker(licenseChecker, startPath);
    } catch {
      return this.runLicenseCheckerInSubprocess(startPath);
    }
  }

  private runLicenseChecker(
    licenseChecker: LicenseCheckerModule,
    startPath: string
  ): Promise<LicenseCheckerResult> {
    return new Promise((resolve, reject) => {
      licenseChecker.init(
        {
          start: startPath,
          excludePrivatePackages: false,
          production: false,
          includeLicenseText: true,
          customFormat: {
            licenseText: true,
          },
        },
        (err, packages) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(packages ?? {});
        }
      );
    });
  }

  private runLicenseCheckerInSubprocess(startPath: string): Promise<LicenseCheckerResult> {
    const script = [
      "import { init } from 'license-checker-rseidelsohn';",
      'const options = JSON.parse(process.argv[1]);',
      'init(options, (err, packages) => {',
      '  if (err) {',
      '    console.error(err instanceof Error ? err.message : String(err));',
      '    process.exit(1);',
      '    return;',
      '  }',
      '  process.stdout.write(JSON.stringify(packages || {}));',
      '});',
    ].join('\n');

    const options = JSON.stringify({
      start: startPath,
      excludePrivatePackages: false,
      production: false,
      includeLicenseText: true,
      customFormat: {
        licenseText: true,
      },
    });

    return new Promise((resolve, reject) => {
      execFile(process.execPath, ['--input-type=module', '-e', script, options], { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }

        try {
          resolve(JSON.parse(stdout) as LicenseCheckerResult);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }
}
