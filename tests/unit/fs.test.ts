import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readFileIfExists, readJsonFile, findFileInDir } from '../utils/fs.js';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('readFileIfExists', () => {
  it('reads existing file', () => {
    const file = path.join(tempDir, 'test.txt');
    fs.writeFileSync(file, 'hello world');
    expect(readFileIfExists(file)).toBe('hello world');
  });

  it('returns null for non-existent file', () => {
    expect(readFileIfExists(path.join(tempDir, 'nonexistent.txt'))).toBeNull();
  });

  it('returns null when path is a directory', () => {
    expect(readFileIfExists(tempDir)).toBeNull();
  });

  it('returns empty string for empty file', () => {
    const file = path.join(tempDir, 'empty.txt');
    fs.writeFileSync(file, '');
    expect(readFileIfExists(file)).toBe('');
  });
});

describe('readJsonFile', () => {
  it('parses valid JSON object', () => {
    const file = path.join(tempDir, 'pkg.json');
    fs.writeFileSync(file, JSON.stringify({ name: 'test', version: '1.0.0' }));
    const result = readJsonFile(file);
    expect(result).toEqual({ name: 'test', version: '1.0.0' });
  });

  it('returns null for malformed JSON', () => {
    const file = path.join(tempDir, 'bad.json');
    fs.writeFileSync(file, 'not json');
    expect(readJsonFile(file)).toBeNull();
  });

  it('returns null for non-existent file', () => {
    expect(readJsonFile(path.join(tempDir, 'nonexistent.json'))).toBeNull();
  });

  it('returns null for empty file', () => {
    const file = path.join(tempDir, 'empty.json');
    fs.writeFileSync(file, '');
    expect(readJsonFile(file)).toBeNull();
  });
});

describe('findFileInDir', () => {
  it('returns path when file exists', () => {
    const filePath = path.join(tempDir, 'LICENSE');
    fs.writeFileSync(filePath, 'MIT');
    expect(findFileInDir(tempDir, 'LICENSE')).toBe(filePath);
  });

  it('returns null when file does not exist', () => {
    expect(findFileInDir(tempDir, 'MISSING')).toBeNull();
  });

  it('returns null when directory does not exist', () => {
    expect(findFileInDir(path.join(tempDir, 'subdir'), 'LICENSE')).toBeNull();
  });
});
