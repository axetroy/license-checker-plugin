import { LicenseInfo } from '../model/LicenseInfo.js';

export class LicenseCache {
  private readonly cache = new Map<string, LicenseInfo>();

  set(packageKey: string, info: LicenseInfo): void {
    this.cache.set(packageKey, info);
  }

  get(packageKey: string): LicenseInfo | undefined {
    return this.cache.get(packageKey);
  }

  has(packageKey: string): boolean {
    return this.cache.has(packageKey);
  }

  getAll(): Map<string, LicenseInfo> {
    return new Map(this.cache);
  }

  clear(): void {
    this.cache.clear();
  }
}
