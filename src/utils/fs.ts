import * as fs from 'fs';
import * as path from 'path';

export function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function findFileInDir(dir: string, filename: string): string | null {
  const filePath = path.join(dir, filename);
  return fs.existsSync(filePath) ? filePath : null;
}
