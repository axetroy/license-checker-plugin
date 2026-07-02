/**
 * Standalone E2E test for viteLicensePlugin.
 *
 * Runs outside Jest because Vite 8+ is ESM-only and can't be
 * require()'d from a CommonJS Jest environment.
 *
 * Usage: node --experimental-vm-modules tests/integration/vite-integration.mjs
 */
import { build } from 'vite';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load our plugin via createRequire (it's compiled to CommonJS)
const require = createRequire(import.meta.url);
const { viteLicensePlugin } = require('../../../src/ViteLicensePlugin');

const FIXTURES = path.resolve(__dirname, 'fixtures');
const OUTPUT = path.resolve(__dirname, 'output', 'vite-e2e');

function prepareOutputDir(name) {
  const dir = path.join(OUTPUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  } else {
    console.log(`PASS: ${message}`);
  }
}

async function run() {
  // Clean all
  fs.rmSync(OUTPUT, { recursive: true, force: true });

  // 1) TXT format
  {
    const outDir = prepareOutputDir('txt');
    await build({
      root: FIXTURES,
      logLevel: 'silent',
      build: {
        outDir,
        lib: {
          entry: path.resolve(FIXTURES, 'vite-entry.js'),
          formats: ['es'],
          fileName: 'bundle',
        },
        rollupOptions: {
          plugins: [
            viteLicensePlugin({
              filename: 'licenses.txt',
              format: 'txt',
              workspaceRoot: path.resolve(__dirname, '../../..'),
            }),
          ],
        },
      },
    });

    const licenseFile = path.join(outDir, 'licenses.txt');
    assert(fs.existsSync(licenseFile), 'licenses.txt exists');
    const content = fs.readFileSync(licenseFile, 'utf-8');
    assert(content.includes('# THIRD-PARTY LICENSES'), 'licenses.txt contains header');
    assert(content.includes('lodash'), 'licenses.txt contains lodash');
  }

  // 2) JSON format
  {
    const outDir = prepareOutputDir('json');
    await build({
      root: FIXTURES,
      logLevel: 'silent',
      build: {
        outDir,
        lib: {
          entry: path.resolve(FIXTURES, 'vite-entry.js'),
          formats: ['es'],
          fileName: 'bundle',
        },
        rollupOptions: {
          plugins: [
            viteLicensePlugin({
              filename: 'licenses.json',
              format: 'json',
              workspaceRoot: path.resolve(__dirname, '../../..'),
            }),
          ],
        },
      },
    });

    const licenseFile = path.join(outDir, 'licenses.json');
    assert(fs.existsSync(licenseFile), 'licenses.json exists');
    const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8'));
    assert(Array.isArray(parsed), 'licenses.json is an array');
    assert(parsed.some(item => item.name === 'lodash'), 'licenses.json contains lodash');
  }

  // 3) License text
  {
    const outDir = prepareOutputDir('with-text');
    await build({
      root: FIXTURES,
      logLevel: 'silent',
      build: {
        outDir,
        lib: {
          entry: path.resolve(FIXTURES, 'vite-entry.js'),
          formats: ['es'],
          fileName: 'bundle',
        },
        rollupOptions: {
          plugins: [
            viteLicensePlugin({
              filename: 'licenses.txt',
              format: 'txt',
              includeLicenseText: true,
              workspaceRoot: path.resolve(__dirname, '../../..'),
            }),
          ],
        },
      },
    });

    const licenseFile = path.join(outDir, 'licenses.txt');
    assert(fs.existsSync(licenseFile), 'licenses.txt (with text) exists');
    const content = fs.readFileSync(licenseFile, 'utf-8');
    assert(content.includes('lodash'), 'with-text: contains lodash');
    assert(content.includes('License Text:'), 'with-text: contains license text');
    assert(content.includes('Copyright OpenJS Foundation'), 'with-text: contains copyright');
  }

  // 4) Only bundled packages
  {
    const outDir = prepareOutputDir('production-only');
    await build({
      root: FIXTURES,
      logLevel: 'silent',
      build: {
        outDir,
        lib: {
          entry: path.resolve(FIXTURES, 'vite-entry.js'),
          formats: ['es'],
          fileName: 'bundle',
        },
        rollupOptions: {
          plugins: [
            viteLicensePlugin({
              filename: 'licenses.json',
              format: 'json',
              workspaceRoot: path.resolve(__dirname, '../../..'),
            }),
          ],
        },
      },
    });

    const licenseFile = path.join(outDir, 'licenses.json');
    assert(fs.existsSync(licenseFile), 'licenses.json (production-only) exists');
    const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8'));
    const packageNames = parsed.map(item => item.name);
    assert(packageNames.includes('lodash'), 'production-only: contains lodash');
    assert(!packageNames.includes('typescript'), 'production-only: does not contain typescript');
  }

  // 5) excludePackages filter
  {
    const outDir = prepareOutputDir('exclude-pkg');
    await build({
      root: FIXTURES,
      logLevel: 'silent',
      build: {
        outDir,
        lib: {
          entry: path.resolve(FIXTURES, 'vite-entry.js'),
          formats: ['es'],
          fileName: 'bundle',
        },
        rollupOptions: {
          plugins: [
            viteLicensePlugin({
              filename: 'licenses.json',
              format: 'json',
              excludePackages: ['lodash'],
              workspaceRoot: path.resolve(__dirname, '../../..'),
            }),
          ],
        },
      },
    });

    const licenseFile = path.join(outDir, 'licenses.json');
    assert(fs.existsSync(licenseFile), 'licenses.json (exclude-pkg) exists');
    const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8'));
    const packageNames = parsed.map(item => item.name);
    assert(!packageNames.includes('lodash'), 'exclude-pkg: lodash excluded');
  }

  // 6) excludePackages filter
  {
    const outDir = prepareOutputDir('exclude-filter');
    await build({
      root: FIXTURES,
      logLevel: 'silent',
      build: {
        outDir,
        lib: {
          entry: path.resolve(FIXTURES, 'vite-entry.js'),
          formats: ['es'],
          fileName: 'bundle',
        },
        rollupOptions: {
          plugins: [
            viteLicensePlugin({
              filename: 'licenses.json',
              format: 'json',
              excludePackages: ['lodash'],
              workspaceRoot: path.resolve(__dirname, '../../..'),
            }),
          ],
        },
      },
    });

    const licenseFile = path.join(outDir, 'licenses.json');
    assert(fs.existsSync(licenseFile), 'licenses.json (exclude) exists');
    const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8'));
    const packageNames = parsed.map(item => item.name);
    assert(!packageNames.includes('lodash'), 'exclude-filter: does not contain lodash');
  }

  // Cleanup
  fs.rmSync(OUTPUT, { recursive: true, force: true });

  console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`}`);
  process.exit(failures > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
