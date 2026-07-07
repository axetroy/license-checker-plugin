import { PackageInfo } from './PackageInfo.js';

/** License metadata for a single package. */
export interface LicenseInfo {
  /** SPDX license identifier(s) joined by ` AND ` for multiple licenses. */
  license: string;
  /** Path to the license file on disk, if found. */
  licenseFile?: string;
  /** Full license text content, if available and requested. */
  licenseText?: string;
}

/** A single entry in the final license report. */
export interface OutputItem {
  /** Package identity and metadata discovered by the bundler scanner. */
  package: PackageInfo;
  /** License information resolved from the package's `node_modules` entry. */
  license: LicenseInfo;
}
