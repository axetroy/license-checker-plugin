import * as fs from 'fs';
import * as path from 'path';
import webpack = require('webpack');
import { LicenseWebpackPlugin } from '../../dist/LicenseWebpackPlugin';

jest.setTimeout(60000);

function runWebpack(config: webpack.Configuration | webpack.Configuration[]): Promise<webpack.Stats | webpack.MultiStats> {
  return new Promise((resolve, reject) => {
    let compiler: webpack.Compiler | webpack.MultiCompiler;
    if (Array.isArray(config)) {
      compiler = webpack(config);
    } else {
      compiler = webpack(config);
    }
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

  it('merges license output across multi-compiler builds into one file', async () => {
    const outputPath = prepareOutputDir('multi-compiler');

    const stats = await runWebpack([
      {
        name: 'client',
        mode: 'development',
        entry: path.resolve(__dirname, 'fixtures/entry.js'),
        output: {
          path: outputPath,
          filename: 'client.bundle.js',
        },
        plugins: [
          new LicenseWebpackPlugin({
            filename: 'client-licenses.txt',
            mergedFilename: 'licenses-merged.txt',
            format: 'txt',
            mergeAcrossCompilers: true,
            mergeKey: 'integration-test-merge',
            workspaceRoot: path.resolve(__dirname, '../..'),
          }),
        ],
      },
      {
        name: 'server',
        mode: 'development',
        entry: path.resolve(__dirname, 'fixtures/entry.js'),
        output: {
          path: outputPath,
          filename: 'server.bundle.js',
        },
        plugins: [
          new LicenseWebpackPlugin({
            filename: 'server-licenses.txt',
            mergedFilename: 'licenses-merged.txt',
            format: 'txt',
            mergeAcrossCompilers: true,
            mergeKey: 'integration-test-merge',
            workspaceRoot: path.resolve(__dirname, '../..'),
          }),
        ],
      },
    ]);

    expect(stats.hasErrors()).toBe(false);
    const mergedFile = path.join(outputPath, 'licenses-merged.txt');
    expect(fs.existsSync(path.join(outputPath, 'client.bundle.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputPath, 'server.bundle.js'))).toBe(true);
    expect(fs.existsSync(mergedFile)).toBe(true);
    expect(fs.existsSync(path.join(outputPath, 'client-licenses.txt'))).toBe(false);
    expect(fs.existsSync(path.join(outputPath, 'server-licenses.txt'))).toBe(false);
    const content = fs.readFileSync(mergedFile, 'utf-8');
    expect(content).toContain('# THIRD-PARTY LICENSES');
    expect(content).toContain('lodash');
  });
});
