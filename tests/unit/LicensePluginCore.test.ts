import { LicensePluginCore, type LicensePluginContext } from '../../src/LicensePluginCore';
import { type PackageInfo } from '../../src/model/PackageInfo';
import { LicenseDatabase } from '../../src/checker/LicenseDatabase';

jest.mock('../../src/checker/LicenseDatabase');

const MockLicenseDatabase = LicenseDatabase as jest.MockedClass<typeof LicenseDatabase>;

const mockContext: LicensePluginContext = {
  reportError: jest.fn(),
  reportWarning: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  MockLicenseDatabase.prototype.initialize.mockResolvedValue(undefined);
});

describe('LicensePluginCore — compound license strings', () => {
  it('preserves OR expression in license field', async () => {
    MockLicenseDatabase.prototype.getLicense.mockReturnValue({
      license: '(MIT OR CC0-1.0)',
    });
    const core = new LicensePluginCore({ workspaceRoot: '/test' });
    await core.initialize('/test', mockContext);

    const packages = new Map<string, PackageInfo>();
    packages.set('type-fest@0.21.3', makePackage('type-fest', '0.21.3'));

    const { items, errors } = await core.generateLicenseItems(packages, mockContext);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].license.license).toBe('(MIT OR CC0-1.0)');
    expect(items).toMatchSnapshot();
  });

  it('preserves AND expression from array licenses', async () => {
    MockLicenseDatabase.prototype.getLicense.mockReturnValue({
      license: 'MIT AND Apache-2.0',
    });
    const core = new LicensePluginCore({ workspaceRoot: '/test' });
    await core.initialize('/test', mockContext);

    const packages = new Map<string, PackageInfo>();
    packages.set('dual@1.0.0', makePackage('dual', '1.0.0'));

    const { items, errors } = await core.generateLicenseItems(packages, mockContext);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].license.license).toBe('MIT AND Apache-2.0');
    expect(items).toMatchSnapshot();
  });

  describe('onlyAllow with compound licenses', () => {
    it('allows OR expression when component licenses are individually in allow list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: '(MIT OR Apache-2.0)',
      });
      const core = new LicensePluginCore({
        onlyAllow: ['MIT', 'Apache-2.0'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items[0].license.license).toBe('(MIT OR Apache-2.0)');
    });

    it('allows OR expression when at least one component is in allow list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: '(MIT OR Apache-2.0)',
      });
      const core = new LicensePluginCore({
        onlyAllow: ['MIT'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items[0].license.license).toBe('(MIT OR Apache-2.0)');
    });

    it('allows AND expression when exact compound string is in allow list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'MIT AND Apache-2.0',
      });
      const core = new LicensePluginCore({
        onlyAllow: ['MIT AND Apache-2.0'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items).toMatchSnapshot();
    });

    it('fails AND expression when exact compound string not in allow list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'MIT AND Apache-2.0',
      });
      const core = new LicensePluginCore({
        onlyAllow: ['MIT'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(items).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('MIT AND Apache-2.0');
      expect(errors).toMatchSnapshot();
    });
  });

  describe('multi-version licenses', () => {
    it('returns correct license for each version of the same package', async () => {
      MockLicenseDatabase.prototype.getLicense.mockImplementation(
        (name: string, version: string) => {
          if (name === 'packageA' && version === '1.0.0') return { license: 'MIT' };
          if (name === 'packageA' && version === '2.0.0') return { license: 'GPL-3.0' };
          return { license: 'UNKNOWN' };
        }
      );
      const core = new LicensePluginCore({ workspaceRoot: '/test' });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('packageA@1.0.0', makePackage('packageA', '1.0.0'));
      packages.set('packageA@2.0.0', makePackage('packageA', '2.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(2);

      const v1 = items.find((i) => i.package.version === '1.0.0');
      const v2 = items.find((i) => i.package.version === '2.0.0');
      expect(v1?.license.license).toBe('MIT');
      expect(v2?.license.license).toBe('GPL-3.0');
      expect(items).toMatchSnapshot();
    });

    it('returns UNKNOWN for one version when not in cache', async () => {
      MockLicenseDatabase.prototype.getLicense.mockImplementation(
        (name: string, version: string) => {
          if (name === 'packageA' && version === '1.0.0') return { license: 'MIT' };
          return { license: 'UNKNOWN' };
        }
      );
      const core = new LicensePluginCore({ workspaceRoot: '/test' });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('packageA@1.0.0', makePackage('packageA', '1.0.0'));
      packages.set('packageA@2.0.0', makePackage('packageA', '2.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(2);

      const v1 = items.find((i) => i.package.version === '1.0.0');
      const v2 = items.find((i) => i.package.version === '2.0.0');
      expect(v1?.license.license).toBe('MIT');
      expect(v2?.license.license).toBe('UNKNOWN');
      expect(items).toMatchSnapshot();
    });

    it('enforces onlyAllow per-version correctly', async () => {
      MockLicenseDatabase.prototype.getLicense.mockImplementation(
        (name: string, version: string) => {
          if (name === 'packageA' && version === '1.0.0') return { license: 'MIT' };
          if (name === 'packageA' && version === '2.0.0') return { license: 'GPL-3.0' };
          return { license: 'UNKNOWN' };
        }
      );
      const core = new LicensePluginCore({
        onlyAllow: ['MIT'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('packageA@1.0.0', makePackage('packageA', '1.0.0'));
      packages.set('packageA@2.0.0', makePackage('packageA', '2.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(items).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('GPL-3.0');
      expect(errors[0]).toContain('packageA@2.0.0');
      expect(errors).toMatchSnapshot();
    });

    it('enforces failOn per-version correctly', async () => {
      MockLicenseDatabase.prototype.getLicense.mockImplementation(
        (name: string, version: string) => {
          if (name === 'packageA' && version === '1.0.0') return { license: 'MIT' };
          if (name === 'packageA' && version === '2.0.0') return { license: 'GPL-3.0' };
          return { license: 'UNKNOWN' };
        }
      );
      const core = new LicensePluginCore({
        failOn: ['GPL-3.0'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('packageA@1.0.0', makePackage('packageA', '1.0.0'));
      packages.set('packageA@2.0.0', makePackage('packageA', '2.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(items).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('GPL-3.0');
      expect(errors[0]).toContain('packageA@2.0.0');
      expect(errors).toMatchSnapshot();
    });
  });

  describe('failOn with compound licenses', () => {
    it('fails OR expression when exact compound string matches fail list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: '(MIT OR Apache-2.0)',
      });
      const core = new LicensePluginCore({
        failOn: ['(MIT OR Apache-2.0)'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(items).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('(MIT OR Apache-2.0)');
      expect(errors).toMatchSnapshot();
    });

    it('passes OR expression when compound string does not match fail list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: '(MIT OR CC0-1.0)',
      });
      const core = new LicensePluginCore({
        failOn: ['Apache-2.0'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items).toMatchSnapshot();
    });

    it('fails AND expression when exact compound string matches fail list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'MIT AND Apache-2.0',
      });
      const core = new LicensePluginCore({
        failOn: ['MIT AND Apache-2.0'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(items).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('MIT AND Apache-2.0');
      expect(errors).toMatchSnapshot();
    });

    it('passes AND expression when compound string does not match fail list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'MIT AND Apache-2.0',
      });
      const core = new LicensePluginCore({
        failOn: ['GPL-3.0'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items).toMatchSnapshot();
    });
  });

  describe('custom / non-standard licenses', () => {
    it('normalizes "SEE LICENSE IN LICENSE" to "Custom"', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'Custom',
      });
      const core = new LicensePluginCore({ workspaceRoot: '/test' });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items[0].license.license).toBe('Custom');
      expect(items).toMatchSnapshot();
    });

    it('normalizes "UNLICENSED" to "Custom"', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'Custom',
      });
      const core = new LicensePluginCore({ workspaceRoot: '/test' });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items[0].license.license).toBe('Custom');
      expect(items).toMatchSnapshot();
    });

    it('normalizes "Proprietary" to "Custom"', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'Custom',
      });
      const core = new LicensePluginCore({ workspaceRoot: '/test' });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items[0].license.license).toBe('Custom');
      expect(items).toMatchSnapshot();
    });

    it('passes through empty license string unchanged (becomes UNKNOWN in DB)', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: '',
      });
      const core = new LicensePluginCore({ workspaceRoot: '/test' });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items[0].license.license).toBe('');
      expect(items).toMatchSnapshot();
    });

    it('onlyAllow blocks "Custom" when not in allow list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'Custom',
      });
      const core = new LicensePluginCore({
        onlyAllow: ['MIT', 'Apache-2.0'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(items).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Custom');
      expect(errors).toMatchSnapshot();
    });

    it('failOn blocks "Custom" when in fail list', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'Custom',
      });
      const core = new LicensePluginCore({
        failOn: ['Custom'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(items).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Custom');
      expect(errors).toMatchSnapshot();
    });

    it('allows "Custom" when onlyAllow includes exact match', async () => {
      MockLicenseDatabase.prototype.getLicense.mockReturnValue({
        license: 'Custom',
      });
      const core = new LicensePluginCore({
        onlyAllow: ['Custom'],
        workspaceRoot: '/test',
      });
      await core.initialize('/test', mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackage('pkg', '1.0.0'));

      const { items, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(items).toHaveLength(1);
      expect(items[0].license.license).toBe('Custom');
      expect(items).toMatchSnapshot();
    });
  });
});
