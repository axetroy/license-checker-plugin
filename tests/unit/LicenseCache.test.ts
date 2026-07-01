import { LicenseCache } from '../../src/checker/LicenseCache';

describe('LicenseCache', () => {
  it('stores and retrieves license info', () => {
    const cache = new LicenseCache();
    cache.set('react@18.0.0', { license: 'MIT', licenseText: 'MIT License' });
    const info = cache.get('react@18.0.0');
    expect(info).toBeDefined();
    expect(info!.license).toBe('MIT');
  });

  it('detects duplicate license texts', () => {
    const cache = new LicenseCache();
    cache.set('react@18.0.0', { license: 'MIT', licenseText: 'MIT License' });
    cache.set('scheduler@0.23.0', { license: 'MIT', licenseText: 'MIT License' });
    const groups = cache.getDuplicateGroups();
    expect(groups.size).toBe(1);
    const [packages] = [...groups.values()];
    expect(packages).toContain('react@18.0.0');
    expect(packages).toContain('scheduler@0.23.0');
  });
});
