import { LicenseInfo } from '../model/LicenseInfo';
import { hashString } from '../utils/hash';

export class LicenseCache {
  private readonly cache = new Map<string, LicenseInfo>();
  private readonly textHashToPackages = new Map<string, string[]>();

  set(packageKey: string, info: LicenseInfo): void {
    this.cache.set(packageKey, info);

    // licenseText can be a boolean (true) from license-checker if file is unreadable
    if (typeof info.licenseText === 'string' && info.licenseText.length > 0) {
      const hash = hashString(info.licenseText);
      if (hash) {
        const packages = this.textHashToPackages.get(hash) ?? [];
        if (!packages.includes(packageKey)) {
          packages.push(packageKey);
        }
        this.textHashToPackages.set(hash, packages);
      }
    }
  }

  get(packageKey: string): LicenseInfo | undefined {
    return this.cache.get(packageKey);
  }

  has(packageKey: string): boolean {
    return this.cache.has(packageKey);
  }

  getAll(): Map<string, LicenseInfo> {
    return this.cache;
  }

  clear(): void {
    this.cache.clear();
    this.textHashToPackages.clear();
  }

  getDuplicateGroups(): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const [hash, packages] of this.textHashToPackages) {
      if (packages.length > 1) {
        result.set(hash, [...packages]);
      }
    }

    return result;
  }
}
