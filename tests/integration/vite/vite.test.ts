import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT = path.resolve(__dirname, 'vite-integration.mjs');

it('Vite E2E integration', () => {
  // Use the locally installed tsx (pinned in devDependencies) instead of
  // `npx tsx`, which would download tsx from the registry at test time and
  // make CI runs depend on the network.
  const tsxCli = path.resolve(__dirname, '../../../node_modules/tsx/dist/cli.mjs');
  const result = execSync(`${process.execPath} "${tsxCli}" "${SCRIPT}"`, {
    cwd: path.resolve(__dirname, '../../..'),
    encoding: 'utf-8',
    timeout: 120000,
  });
  expect(result).toContain('ALL TESTS PASSED');
});
