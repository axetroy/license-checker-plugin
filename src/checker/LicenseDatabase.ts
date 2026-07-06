import { builtInLicenseChecker, normalizeLicense } from './BuiltInLicenseChecker';
import { LicenseInfo } from '../model/LicenseInfo';
import { LicenseCache } from './LicenseCache';

export class LicenseDatabase {
  private readonly cache = new LicenseCache();
  private initialized = false;
  private initializedPath: string | null = null;

  async initialize(startPath: string, includeLicenseText?: boolean): Promise<void> {
    if (this.initialized && this.initializedPath === startPath) {
      return;
    }

    this.cache.clear();
    this.initialized = false;

    const packages = await builtInLicenseChecker({
      start: startPath,
      excludePrivatePackages: false,
      customFormat: {
        licenseText: includeLicenseText !== false,
      },
    });

    for (const [key, info] of Object.entries(packages ?? {})) {
      let licenseStr = 'UNKNOWN';
      if (info.licenses) {
        if (Array.isArray(info.licenses)) {
          const joined = info.licenses.join(' AND ');
          licenseStr = normalizeLicense(joined);
        } else {
          licenseStr = info.licenses;
          if (licenseStr !== 'UNKNOWN') {
            licenseStr = normalizeLicense(licenseStr);
          }
        }
      }

      const licenseText =
        typeof info.licenseText === 'string' && info.licenseText.length > 0 ? info.licenseText : undefined;

      const licenseInfo: LicenseInfo = {
        license: licenseStr,
        licenseFile: info.licenseFile,
        licenseText,
      };

      this.cache.set(key, licenseInfo);
    }

    this.initialized = true;
    this.initializedPath = startPath;
  }

  getLicense(packageName: string, packageVersion: string): LicenseInfo {
    return this.cache.get(`${packageName}@${packageVersion}`) || { license: 'UNKNOWN' };
  }

  getAllLicenses(): Map<string, LicenseInfo> {
    return this.cache.getAll();
  }
}
