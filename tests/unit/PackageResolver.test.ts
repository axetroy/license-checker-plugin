import { PackageResolver } from '../../src/scanner/PackageResolver';

describe('PackageResolver', () => {
  it('returns null for non-node_module paths', () => {
    const resolver = new PackageResolver();
    expect(resolver.resolve('/src/app.ts', 'main')).toBeNull();
  });

  it('returns null for undefined path', () => {
    const resolver = new PackageResolver();
    expect(resolver.resolve('', 'main')).toBeNull();
  });
});
