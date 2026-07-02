import { createHash } from 'crypto';

export function hashString(str: unknown): string | undefined {
  if (typeof str !== 'string') {
    return undefined;
  }
  return createHash('md5').update(str).digest('hex');
}
