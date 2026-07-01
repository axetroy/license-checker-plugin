import { LicenseInfo } from './LicenseInfo';

export interface LicenseBuildPackageRecord {
  name: string;
  version: string;
  chunks: string[];
  buildName?: string;
  license: LicenseInfo;
}

export interface LicenseBuildReport {
  project: string;
  buildName?: string;
  aggregateKey?: string;
  generatedAt: string;
  packages: LicenseBuildPackageRecord[];
}
