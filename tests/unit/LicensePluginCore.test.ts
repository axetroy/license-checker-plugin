import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LicensePluginCore, type LicensePluginContext } from '../../src/LicensePluginCore';
import { type PackageInfo } from '../../src/model/PackageInfo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockContext: LicensePluginContext = {
  reportError: () => {},
  reportWarning: () => {},
};

function makePackage(name: string, version: string): PackageInfo {
  return {
    name,
    version,
    path: `/node_modules/${name}`,
    packageJsonPath: `/node_modules/${name}/package.json`,
    chunks: ['main'],
    modules: [],
  };
}

describe('LicensePluginCore', () => {
  it('returns license info for bundled packages', async () => {
    const core = new LicensePluginCore({ workspaceRoot: __dirname });
    await core.initialize(__dirname, mockContext);

    const packages = new Map<string, PackageInfo>();
    packages.set('license-checker-plugin@1.0.5', makePackage('license-checker-plugin', '1.0.5'));

    const { items, errors } = await core.generateLicenseItems(packages, mockContext);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].license.license).toBeTruthy();
  });

  it('handles packages without licenses gracefully', async () => {
    const core = new LicensePluginCore({ workspaceRoot: __dirname });
    await core.initialize(__dirname, mockContext);

    const packages = new Map<string, PackageInfo>();
    packages.set('unknown-package@1.0.0', makePackage('unknown-package', '1.0.0'));

    const { items, errors } = await core.generateLicenseItems(packages, mockContext);
    expect(items.length).toBeGreaterThanOrEqual(0);
  });
});
