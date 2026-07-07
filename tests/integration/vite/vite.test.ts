import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT = path.resolve(__dirname, 'vite-integration.mjs');

it('Vite E2E integration', () => {
  const result = execSync(`npx tsx "${SCRIPT}"`, {
    cwd: path.resolve(__dirname, '../../..'),
    encoding: 'utf-8',
    timeout: 120000,
  });
  expect(result).toContain('ALL TESTS PASSED');
});
