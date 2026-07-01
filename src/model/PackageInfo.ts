export interface PackageInfo {
  name: string;
  version: string;
  path: string;
  packageJsonPath: string;
  chunks: string[];
  modules: string[];
}
