import * as fs from 'fs';
import * as path from 'path';
import webpack from 'webpack';
import { LicenseWebpackPlugin } from '../../../dist/LicenseWebpackPlugin';

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
    fs.rmSync(path.resolve(__dirname, 'output', 'txt'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'json'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'include-license-text-true'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'include-license-text-false'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'production-only'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'only-allow-pass'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'only-allow-fail'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'fail-on-fail'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'fail-on-pass'), { recursive: true, force: true });
  });

  it('generates a licenses.txt file with txt format', async () => {
    const outputPath = prepareOutputDir('txt');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, '../fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          workspaceRoot: path.resolve(__dirname, '../../..'),
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
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    const parsed = JSON.parse(content) as Array<{ name: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((item) => item.name === 'lodash')).toBe(true);
  });

  // The two tests below exercise includeLicenseText using lodash, a real open-source
  // package already present in the repository's devDependencies.  lodash has a
  // well-known MIT license whose text begins with "Copyright OpenJS Foundation".
  it('includes dependency license text when includeLicenseText is true', async () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const outputPath = prepareOutputDir('include-license-text-true');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, '../fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          includeLicenseText: true,
          workspaceRoot,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    expect(content).toContain('lodash');
    expect(content).toContain('License Text:');
    // Stable prefix from lodash's LICENSE file
    expect(content).toContain('Copyright OpenJS Foundation');
  });

  it('only includes packages that are actually bundled (not all devDependencies)', async () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const outputPath = prepareOutputDir('production-only');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, '../fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.json',
          format: 'json',
          workspaceRoot,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.json');
    expect(fs.existsSync(licenseFile)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8')) as Array<{ name: string }>;
    const packageNames = parsed.map((item) => item.name);

    // entry.js imports lodash → lodash must be in the output
    expect(packageNames).toContain('lodash');

    // packages that exist in node_modules but are NOT imported by the entry
    // should NOT appear in the license output.
    // typescript is a devDependency but is never imported by entry.js → not bundled.
    expect(packageNames).not.toContain('typescript');
  });

  it('omits dependency license text when includeLicenseText is false', async () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const outputPath = prepareOutputDir('include-license-text-false');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, '../fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          includeLicenseText: false,
          workspaceRoot,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    expect(content).toContain('lodash');
    expect(content).not.toContain('License Text:');
    expect(content).not.toContain('Copyright OpenJS Foundation');
  });

  describe('onlyAllow', () => {
    it('passes when all bundled packages have an allowed license', async () => {
      const outputPath = prepareOutputDir('only-allow-pass');

      const stats = await runWebpack({
        mode: 'development',
        entry: path.resolve(__dirname, '../fixtures/entry.js'),
        output: { path: outputPath, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            filename: 'licenses.json',
            format: 'json',
            onlyAllow: ['MIT'],
            workspaceRoot: path.resolve(__dirname, '../../..'),
          }),
        ],
      });

      expect(stats.hasErrors()).toBe(false);
      const licenseFile = path.join(outputPath, 'licenses.json');
      expect(fs.existsSync(licenseFile)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8')) as Array<{ name: string }>;
      expect(parsed.some((item) => item.name === 'lodash')).toBe(true);
    });

    it('fails when a bundled package license is not in the allow list', async () => {
      const outputPath = prepareOutputDir('only-allow-fail');

      const stats = await runWebpack({
        mode: 'development',
        entry: path.resolve(__dirname, '../fixtures/entry.js'),
        output: { path: outputPath, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            filename: 'licenses.json',
            format: 'json',
            onlyAllow: ['Apache-2.0'],
            workspaceRoot: path.resolve(__dirname, '../../..'),
          }),
        ],
      });

      expect(stats.hasErrors()).toBe(true);
      expect(fs.existsSync(path.join(outputPath, 'licenses.json'))).toBe(false);
    });
  });

  describe('failOn', () => {
    it('fails when a bundled package license matches the fail list', async () => {
      const outputPath = prepareOutputDir('fail-on-fail');

      const stats = await runWebpack({
        mode: 'development',
        entry: path.resolve(__dirname, '../fixtures/entry.js'),
        output: { path: outputPath, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            filename: 'licenses.json',
            format: 'json',
            failOn: ['MIT'],
            workspaceRoot: path.resolve(__dirname, '../../..'),
          }),
        ],
      });

      expect(stats.hasErrors()).toBe(true);
      expect(fs.existsSync(path.join(outputPath, 'licenses.json'))).toBe(false);
    });

    it('passes when no bundled package license matches the fail list', async () => {
      const outputPath = prepareOutputDir('fail-on-pass');

      const stats = await runWebpack({
        mode: 'development',
        entry: path.resolve(__dirname, '../fixtures/entry.js'),
        output: { path: outputPath, filename: 'bundle.js' },
        plugins: [
          new LicenseWebpackPlugin({
            filename: 'licenses.json',
            format: 'json',
            failOn: ['Apache-2.0'],
            workspaceRoot: path.resolve(__dirname, '../../..'),
          }),
        ],
      });

      expect(stats.hasErrors()).toBe(false);
      const licenseFile = path.join(outputPath, 'licenses.json');
      expect(fs.existsSync(licenseFile)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf-8')) as Array<{ name: string }>;
      expect(parsed.some((item) => item.name === 'lodash')).toBe(true);
    });
  });
});
