/**
 * Integration tests for the shared-recorder / multi-instance scenario.
 *
 * These tests verify that:
 * 1. Multiple LicenseWebpackPlugin instances that share a single DefaultRecorder
 *    each call recorder.record() with their own findings.
 * 2. Secondary instances (recordOnly: true) do NOT emit a license asset.
 * 3. The primary instance waits for the expected number of reports via
 *    waitForRecorderCount, merges them (with deduplication), and emits a
 *    single combined license asset.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';
import { LicenseWebpackPlugin } from '../../../dist/LicenseWebpackPlugin';
import { DefaultRecorder } from '../../../dist/Recorder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runWebpack(config: webpack.Configuration): Promise<webpack.Stats> {
  return new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      if (!stats) {
        reject(new Error('No stats'));
        return;
      }
      resolve(stats);
    });
  });
}

function prepareOutputDir(name: string): string {
  const outputPath = path.resolve(__dirname, 'output', name);
  fs.rmSync(outputPath, { recursive: true, force: true });
  fs.mkdirSync(outputPath, { recursive: true });
  return outputPath;
}

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const ENTRY = path.resolve(__dirname, '../fixtures/entry.js');
const ENTRY2 = path.resolve(__dirname, '../fixtures/entry2.js');

afterAll(() => {
  fs.rmSync(path.resolve(__dirname, 'output', 'shared-recorder'), {
    recursive: true,
    force: true,
  });
});

describe('shared recorder – multi-instance', () => {
  it('three instances share a recorder: secondaries record-only, primary merges and emits', async () => {
    const sharedRecorder = new DefaultRecorder();

    const outputA = prepareOutputDir('shared-recorder/three-a');
    const outputB = prepareOutputDir('shared-recorder/three-b');
    const outputC = prepareOutputDir('shared-recorder/three-c');

    // Run all three compilers concurrently.  The primary waits (via
    // waitForRecorderCount) until the two secondaries have also called
    // recorder.record(), so all three must be in-flight at the same time.
    const [statsA, statsB, statsC] = await Promise.all([
      runWebpack({
        name: 'secondary-a',
        mode: 'development',
        entry: ENTRY,
        output: { path: outputA, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            recorder: sharedRecorder,
            recordOnly: true,
            workspaceRoot: WORKSPACE_ROOT,
          }),
        ],
      }),
      runWebpack({
        name: 'secondary-b',
        mode: 'development',
        entry: ENTRY,
        output: { path: outputB, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            recorder: sharedRecorder,
            recordOnly: true,
            workspaceRoot: WORKSPACE_ROOT,
          }),
        ],
      }),
      runWebpack({
        name: 'primary',
        mode: 'development',
        entry: ENTRY,
        output: { path: outputC, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            filename: 'licenses.json',
            format: 'json',
            recorder: sharedRecorder,
            waitForRecorderCount: 3,
            workspaceRoot: WORKSPACE_ROOT,
          }),
        ],
      }),
    ]);

    // ── No compilation errors ──────────────────────────────────────────────
    expect(statsA.hasErrors()).toBe(false);
    expect(statsB.hasErrors()).toBe(false);
    expect(statsC.hasErrors()).toBe(false);

    // ── Shared recorder accumulated exactly three reports ──────────────────
    const allReports = sharedRecorder.getReports();
    expect(allReports).toHaveLength(3);

    // Every individual report must contain the package found by entry.js.
    for (const report of allReports) {
      expect(report.items.some((item) => item.package.name === 'lodash')).toBe(true);
    }

    // ── Secondary instances must NOT emit any license asset ────────────────
    expect(fs.existsSync(path.join(outputA, 'licenses.json'))).toBe(false);
    expect(fs.existsSync(path.join(outputB, 'licenses.json'))).toBe(false);

    // ── Primary instance emits the combined, deduplicated asset ───────────
    const licenseFile = path.join(outputC, 'licenses.json');
    expect(fs.existsSync(licenseFile)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8')) as Array<{ name: string }>;
    expect(Array.isArray(parsed)).toBe(true);

    // lodash appeared in all three reports but must be deduplicated to one entry.
    const lodashEntries = parsed.filter((item) => item.name === 'lodash');
    expect(lodashEntries).toHaveLength(1);
  });

  it('two instances with distinct entries: primary output contains packages from both compilers', async () => {
    const sharedRecorder = new DefaultRecorder();

    const outputA = prepareOutputDir('shared-recorder/distinct-a');
    const outputB = prepareOutputDir('shared-recorder/distinct-b');

    const [statsA, statsB] = await Promise.all([
      // Secondary: uses entry.js → discovers lodash
      runWebpack({
        name: 'secondary-distinct',
        mode: 'development',
        entry: ENTRY,
        output: { path: outputA, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            recorder: sharedRecorder,
            recordOnly: true,
            workspaceRoot: WORKSPACE_ROOT,
          }),
        ],
      }),
      // Primary: uses entry2.js → discovers webpack-sources; merges both reports
      runWebpack({
        name: 'primary-distinct',
        mode: 'development',
        entry: ENTRY2,
        output: { path: outputB, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            filename: 'licenses.json',
            format: 'json',
            recorder: sharedRecorder,
            waitForRecorderCount: 2,
            workspaceRoot: WORKSPACE_ROOT,
          }),
        ],
      }),
    ]);

    // ── No compilation errors ──────────────────────────────────────────────
    expect(statsA.hasErrors()).toBe(false);
    expect(statsB.hasErrors()).toBe(false);

    // ── Shared recorder accumulated exactly two reports ────────────────────
    expect(sharedRecorder.getReports()).toHaveLength(2);

    // Secondary must NOT emit any license asset.
    expect(fs.existsSync(path.join(outputA, 'licenses.json'))).toBe(false);

    // ── Primary emits a combined asset that includes both packages ─────────
    const licenseFile = path.join(outputB, 'licenses.json');
    expect(fs.existsSync(licenseFile)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8')) as Array<{ name: string }>;
    expect(Array.isArray(parsed)).toBe(true);

    const packageNames = parsed.map((item) => item.name);

    // Package discovered by secondary (entry.js)
    expect(packageNames).toContain('lodash');
    // Package discovered by primary (entry2.js)
    expect(packageNames).toContain('webpack-sources');

    // No duplicate package entries in the merged output.
    expect(packageNames.length).toBe(new Set(packageNames).size);
  });
});
