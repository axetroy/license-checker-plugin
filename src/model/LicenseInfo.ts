import { PackageInfo } from './PackageInfo';

export interface LicenseInfo {
  license: string;
  licenseFile?: string;
  licenseText?: string;
  repository?: string;
  homepage?: string;
  author?: string;
  publisher?: string;
  private?: boolean;
  packageJson?: Record<string, unknown>;
}

export interface OutputItem {
  package: PackageInfo;
  license: LicenseInfo;
}
