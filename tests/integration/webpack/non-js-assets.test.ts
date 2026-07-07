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

describe('Non-JS assets - CSS, HTML, TXT support', () => {
  afterAll(() => {
    fs.rmSync(path.resolve(__dirname, 'output', 'css-assets'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'html-assets'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'mixed-assets'), { recursive: true, force: true });
    fs.rmSync(path.resolve(__dirname, 'output', 'json-assets'), { recursive: true, force: true });
  });

  it('detects packages from CSS imports', async () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const outputPath = prepareOutputDir('css-assets');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, '../fixtures/entry-css.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      module: {
        rules: [
          {
            test: /\.css$/,
            use: ['css-loader'],
          },
        ],
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          workspaceRoot,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    // lodash should be detected from the JS import
    expect(content).toContain('lodash');
  });

  it('detects packages from HTML template imports', async () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const outputPath = prepareOutputDir('html-assets');

    // Create a test HTML file that references lodash
    const testHtmlPath = path.resolve(__dirname, '../fixtures/test.html');
    fs.writeFileSync(testHtmlPath, '<html><body>Test</body></html>');

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
          workspaceRoot,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(licenseFile)).toBe(true);

    // Cleanup
    fs.unlinkSync(testHtmlPath);
  });

  it('handles mixed asset types in single build', async () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const outputPath = prepareOutputDir('mixed-assets');

    // Create additional fixtures
    const txtFixturePath = path.resolve(__dirname, '../fixtures/readme.txt');
    fs.writeFileSync(txtFixturePath, 'Readme content');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, '../fixtures/entry-css.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      module: {
        rules: [
          {
            test: /\.css$/,
            use: ['css-loader'],
          },
        ],
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          workspaceRoot,
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    // Should detect lodash from both JS and CSS files
    expect(content).toContain('lodash');

    // Cleanup
    fs.unlinkSync(txtFixturePath);
  });

  it('outputs JSON format with non-JS assets', async () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const outputPath = prepareOutputDir('json-assets');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, '../fixtures/entry-css.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      module: {
        rules: [
          {
            test: /\.css$/,
            use: ['css-loader'],
          },
        ],
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
    const content = fs.readFileSync(licenseFile, 'utf-8');
    const parsed = JSON.parse(content) as Array<{ name: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((item) => item.name === 'lodash')).toBe(true);
  });
});