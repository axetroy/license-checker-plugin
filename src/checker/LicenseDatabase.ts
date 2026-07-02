import { builtInLicenseChecker, type PackageLicenseInfo } from './BuiltInLicenseChecker';
import { LicenseInfo } from '../model/LicenseInfo';
import { LicenseCache } from './LicenseCache';

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
      // licenses can be string or string[]
      let licenseStr = 'UNKNOWN';
      if (info.licenses) {
        if (Array.isArray(info.licenses)) {
          licenseStr = info.licenses.join(' AND ');
        } else {
          licenseStr = info.licenses;
        }
      }

      // licenseText can be non-string in edge cases; only store valid strings
      const licenseText =
        typeof info.licenseText === 'string' && info.licenseText.length > 0 ? info.licenseText : undefined;

      const licenseInfo: LicenseInfo = {
        license: licenseStr,
        licenseFile: info.licenseFile,
        licenseText,
        repository: info.repository,
        homepage: info.url,
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

  private loadPackages(startPath: string): Promise<Record<string, PackageLicenseInfo>> {
    return new Promise((resolve, reject) => {
      builtInLicenseChecker(
        {
          start: startPath,
          excludePrivatePackages: false,
          customFormat: {
            licenseText: true,
          },
        },
        (err, packages) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(packages);
        }
      );
    });
  }
}
