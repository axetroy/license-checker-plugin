export interface PackageInfo {
  name: string;
  version: string;
  path: string;
  packageJsonPath: string;
  chunks: string[];
  modules: string[];
  repository?: string;
  homepage?: string;
  author?: string;
  publisher?: string;
  private?: boolean;
  license?: string;
  /** Whether this package is a direct dependency of the project (listed in package.json dependencies or devDependencies). */
  direct?: boolean;
}
