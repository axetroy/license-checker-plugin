import { describe, it, expect, beforeEach } from '@jest/globals';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LicenseDatabase } from '../../src/checker/LicenseDatabase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('LicenseDatabase', () => {
  let db: LicenseDatabase;

  beforeEach(() => {
    db = new LicenseDatabase();
  });

  describe('initialize', () => {
    it('initializes without error', async () => {
      await expect(db.initialize(__dirname)).resolves.not.toThrow();
    });
  });

  describe('getLicense', () => {
    it('returns UNKNOWN for uninitialized database', () => {
      const info = db.getLicense('any-package', '1.0.0');
      expect(info).toBeDefined();
      expect(info?.license).toBe('UNKNOWN');
    });
  });

  describe('getAllLicenses', () => {
    it('returns empty map for uninitialized database', async () => {
      const licenses = db.getAllLicenses();
      expect(licenses.size).toBe(0);
    });
  });
});
