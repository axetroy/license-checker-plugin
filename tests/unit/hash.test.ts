import { hashString } from '../utils/hash.js';

describe('hashString', () => {
  it('returns md5 hex for a string', () => {
    expect(hashString('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('returns undefined for non-string input (number)', () => {
    expect(hashString(42)).toBeUndefined();
  });

  it('returns undefined for non-string input (object)', () => {
    expect(hashString({})).toBeUndefined();
  });

  it('returns undefined for non-string input (array)', () => {
    expect(hashString(['a'])).toBeUndefined();
  });

  it('returns undefined for non-string input (null)', () => {
    expect(hashString(null)).toBeUndefined();
  });

  it('returns undefined for non-string input (undefined)', () => {
    expect(hashString(undefined)).toBeUndefined();
  });

  it('returns undefined for non-string input (boolean)', () => {
    expect(hashString(true)).toBeUndefined();
  });

  it('returns valid hash for empty string', () => {
    expect(hashString('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('is deterministic - same input produces same hash', () => {
    expect(hashString('test-value')).toBe(hashString('test-value'));
  });

  it('produces different hashes for different strings', () => {
    expect(hashString('abc')).not.toBe(hashString('xyz'));
  });
});
