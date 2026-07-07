/**
 * Integration test for LicenseWebpackPlugin with Rspack.
 *
 * Verifies that when the plugin is used inside an Rspack build, it correctly
 * collects third-party license information and emits the license asset.
 *
 * The plugin must NOT import webpack directly; it obtains the bundler namespace
 * (sources, Compilation constants, etc.) from compiler.webpack at runtime.
 * Rspack exposes the same interface on compiler.webpack, which this test
 * exercises end-to-end.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// Import Rspack types without importing webpack so that the test itself
// demonstrates the bundler-agnostic pattern.
import type { Configuration, Stats } from '@rspack/core';
import { rspack } from '@rspack/core';
import { LicenseWebpackPlugin } from '../../../dist/LicenseWebpackPlugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runRspack(config: Configuration): Promise<Stats> {
  return new Promise((resolve, reject) => {
    const compiler = rspack(config);
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      if (!stats) {
        reject(new Error('No stats returned from Rspack'));
        return;
      }
      resolve(stats);
    });
  });
}

function prepareOutputDir(name: string): string {
  const outputPath = path.resolve(__dirname, 'output', 'rspack', name);
  fs.rmSync(outputPath, { recursive: true, force: true });
  fs.mkdirSync(outputPath, { recursive: true });
  return outputPath;
}

describe('LicenseWebpackPlugin – Rspack integration', () => {
  afterAll(() => {
    fs.rmSync(path.resolve(__dirname, 'output', 'rspack'), { recursive: true, force: true });
  });

  it('emits third-party-licenses.txt when building with Rspack', async () => {
    const outputPath = prepareOutputDir('txt');

    const stats = await runRspack({
      mode: 'production',
      entry: path.resolve(__dirname, '../fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'third-party-licenses.txt',
          format: 'txt',
          workspaceRoot: path.resolve(__dirname, '../../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);

    const licenseFile = path.join(outputPath, 'third-party-licenses.txt');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);

    const content = fs.readFileSync(licenseFile, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('# THIRD-PARTY LICENSES');
    // lodash is used by the test fixture and must appear in the output.
    expect(content).toContain('lodash');
  });

  it('emits licenses.json with json format when building with Rspack', async () => {
    const outputPath = prepareOutputDir('json');

    const stats = await runRspack({
      mode: 'production',
      entry: path.resolve(__dirname, '../fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.json',
          format: 'json',
          workspaceRoot: path.resolve(__dirname, '../../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);

    const licenseFile = path.join(outputPath, 'licenses.json');
    expect(fs.existsSync(licenseFile)).toBe(true);

    const content = fs.readFileSync(licenseFile, 'utf-8');
    const parsed = JSON.parse(content) as Array<{ name: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((item) => item.name === 'lodash')).toBe(true);
  });
});
