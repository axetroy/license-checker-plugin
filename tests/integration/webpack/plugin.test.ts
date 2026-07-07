import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';
import { LicenseWebpackPlugin } from '../../../dist/LicenseWebpackPlugin';

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
const CORE_UTIL_IS_DIR = path.join(WORKSPACE_ROOT, 'node_modules', 'core-util-is');

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
    fs.rmSync(path.resolve(__dirname, 'output', 'core-util-is-txt'), { recursive: true, force: true });
    fs.rmSync(CORE_UTIL_IS_DIR, { recursive: true, force: true });
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

  it('generates txt output snapshot for core-util-is package', async () => {
    fs.mkdirSync(path.join(CORE_UTIL_IS_DIR, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(CORE_UTIL_IS_DIR, 'package.json'), JSON.stringify({
      name: 'core-util-is',
      version: '1.0.3',
      license: 'MIT',
      main: 'lib/util.js',
    }));
    fs.writeFileSync(
      path.join(CORE_UTIL_IS_DIR, 'lib', 'util.js'),
      [
        'function isArray(arg) { return Array.isArray(arg); }',
        'exports.isArray = isArray;',
        '',
      ].join('\n')
    );
    fs.writeFileSync(
      path.join(CORE_UTIL_IS_DIR, 'LICENSE'),
      [
        'Copyright Node.js contributors. All rights reserved.',
        '',
        'Permission is hereby granted, free of charge, to any person obtaining a copy',
        'of this software and associated documentation files (the "Software"), to',
        'deal in the Software without restriction, including without limitation the',
        'rights to use, copy, modify, merge, publish, distribute, sublicense, and/or',
        'sell copies of the Software, and to permit persons to whom the Software is',
        'furnished to do so, subject to the following conditions:',
        '',
        'The above copyright notice and this permission notice shall be included in',
        'all copies or substantial portions of the Software.',
        '',
        'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
        'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
        'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
        'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
        'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING',
        'FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS',
        'IN THE SOFTWARE.',
        '',
      ].join('\n')
    );

    const outputPath = prepareOutputDir('core-util-is-txt');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, '../fixtures/entry-core-util-is.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          includeAuthor: false,
          includeHomepage: false,
          includeRepository: false,
          includeLicenseText: true,
          workspaceRoot: WORKSPACE_ROOT,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    expect(content).toMatchSnapshot();
  });
});
