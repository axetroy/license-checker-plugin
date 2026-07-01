import * as fs from 'fs';
import * as path from 'path';
import webpack = require('webpack');
import { LicenseWebpackPlugin } from '../../dist/LicenseWebpackPlugin';

jest.setTimeout(60000);

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

describe('LicenseWebpackPlugin integration', () => {
  afterAll(() => {
    fs.rmSync(path.resolve(__dirname, 'output'), { recursive: true, force: true });
  });

  it('generates a licenses.txt file with txt format', async () => {
    const outputPath = prepareOutputDir('txt');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    expect(content).toContain('# THIRD-PARTY LICENSES');
    expect(content).toContain('lodash');
  });

  it('generates licenses.json with json format', async () => {
    const outputPath = prepareOutputDir('json');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.json',
          format: 'json',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.json');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    const parsed = JSON.parse(content) as Array<{ name: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((item) => item.name === 'lodash')).toBe(true);
  });

  it('includes dependency license text when includeLicenseText is true', async () => {
    const fixtureRoot = path.resolve(__dirname, 'fixtures/include-license-text');
    const outputPath = prepareOutputDir('include-license-text-true');

    const stats = await runWebpack({
      context: fixtureRoot,
      mode: 'development',
      entry: path.join(fixtureRoot, 'entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      resolve: {
        modules: [path.join(fixtureRoot, 'node_modules'), 'node_modules'],
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          includeLicenseText: true,
          workspaceRoot: fixtureRoot,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    expect(content).toContain('dep-a');
    expect(content).toContain('License Text:');
    expect(content).toContain('MIT License\nCopyright (c) 2026 Dep A');
  });

  it('omits dependency license text when includeLicenseText is false', async () => {
    const fixtureRoot = path.resolve(__dirname, 'fixtures/include-license-text');
    const outputPath = prepareOutputDir('include-license-text-false');

    const stats = await runWebpack({
      context: fixtureRoot,
      mode: 'development',
      entry: path.join(fixtureRoot, 'entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      resolve: {
        modules: [path.join(fixtureRoot, 'node_modules'), 'node_modules'],
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          includeLicenseText: false,
          workspaceRoot: fixtureRoot,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    expect(content).toContain('dep-a');
    expect(content).not.toContain('License Text:');
    expect(content).not.toContain('MIT License\nCopyright (c) 2026 Dep A');
  });
});
