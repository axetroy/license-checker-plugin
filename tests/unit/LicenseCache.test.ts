import { LicenseCache } from '../../src/checker/LicenseCache.js';

describe('LicenseCache', () => {
  it('stores and retrieves license info', () => {
    const cache = new LicenseCache();
    cache.set('react@18.0.0', { license: 'MIT', licenseText: 'MIT License' });
    const info = cache.get('react@18.0.0');
    expect(info).toBeDefined();
    expect(info!.license).toBe('MIT');
  });

  it('returns undefined for missing key', () => {
    const cache = new LicenseCache();
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('has returns true for existing key', () => {
    const cache = new LicenseCache();
    cache.set('pkg@1.0.0', { license: 'MIT' });
    expect(cache.has('pkg@1.0.0')).toBe(true);
  });

  it('has returns false for missing key', () => {
    const cache = new LicenseCache();
    expect(cache.has('missing')).toBe(false);
  });

  it('getAll returns all entries', () => {
    const cache = new LicenseCache();
    cache.set('a@1.0.0', { license: 'MIT' });
    cache.set('b@2.0.0', { license: 'Apache-2.0' });
    expect(cache.getAll().size).toBe(2);
  });

  it('clear removes all entries', () => {
    const cache = new LicenseCache();
    cache.set('a@1.0.0', { license: 'MIT' });
    cache.clear();
    expect(cache.getAll().size).toBe(0);
    expect(cache.has('a@1.0.0')).toBe(false);
  });

  it('handles non-string licenseText when setting', () => {
    const cache = new LicenseCache();
    cache.set('pkg@1.0.0', { license: 'MIT', licenseText: true as any });
    expect(cache.get('pkg@1.0.0')!.licenseText).toBe(true as any);
  });
});
