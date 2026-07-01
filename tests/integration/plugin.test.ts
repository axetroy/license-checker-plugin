import * as fs from 'fs';
import * as path from 'path';
import webpack = require('webpack');
import { LicenseWebpackPlugin } from '../../dist/LicenseWebpackPlugin';
import { LicenseBuildReport } from '../../dist/model/BuildReport';

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

  it('emits a structured JSON report in report-only mode', async () => {
    const outputPath = prepareOutputDir('report-only');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          outputMode: 'report-only',
          reportFile: 'license-report.json',
          buildName: 'client',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const reportFile = path.join(outputPath, 'license-report.json');
    expect(fs.existsSync(reportFile)).toBe(true);
    expect(fs.existsSync(path.join(outputPath, 'licenses.txt'))).toBe(false);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as LicenseBuildReport;
    expect(report.buildName).toBe('client');
    expect(typeof report.generatedAt).toBe('string');
    expect(Array.isArray(report.packages)).toBe(true);
    expect(report.packages.some((p) => p.name === 'lodash')).toBe(true);
  });

  it('emits a JSON report with aggregateKey in aggregate mode', async () => {
    const outputPath = prepareOutputDir('aggregate');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          outputMode: 'aggregate',
          reportFile: 'license-report.json',
          buildName: 'server',
          aggregateKey: 'my-app',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const reportFile = path.join(outputPath, 'license-report.json');
    expect(fs.existsSync(reportFile)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as LicenseBuildReport;
    expect(report.buildName).toBe('server');
    expect(report.aggregateKey).toBe('my-app');
  });

  it('mergeReports merges multiple build reports into OutputItem[]', async () => {
    const reportA: LicenseBuildReport = {
      project: '/workspace',
      buildName: 'client',
      generatedAt: new Date().toISOString(),
      packages: [
        { name: 'lodash', version: '4.17.21', chunks: ['main'], license: { license: 'MIT' } },
        { name: 'react', version: '18.0.0', chunks: ['main'], license: { license: 'MIT' } },
      ],
    };
    const reportB: LicenseBuildReport = {
      project: '/workspace',
      buildName: 'server',
      generatedAt: new Date().toISOString(),
      packages: [
        { name: 'lodash', version: '4.17.21', chunks: ['server'], license: { license: 'MIT' } },
        { name: 'express', version: '4.18.0', chunks: ['server'], license: { license: 'MIT' } },
      ],
    };

    const merged = LicenseWebpackPlugin.mergeReports([reportA, reportB], { deduplicate: true });
    expect(Array.isArray(merged)).toBe(true);
    const items = merged as Array<{ package: { name: string } }>;
    const names = items.map((i) => i.package.name);
    expect(names).toContain('lodash');
    expect(names).toContain('react');
    expect(names).toContain('express');
    expect(names.filter((n) => n === 'lodash').length).toBe(1);
  });

  it('mergeReports formats multiple reports as txt string', () => {
    const report: LicenseBuildReport = {
      project: '/workspace',
      generatedAt: new Date().toISOString(),
      packages: [{ name: 'lodash', version: '4.17.21', chunks: ['main'], license: { license: 'MIT' } }],
    };

    const result = LicenseWebpackPlugin.mergeReports([report], { format: 'txt', includeLicenseText: false });
    expect(typeof result).toBe('string');
    expect(result).toContain('# THIRD-PARTY LICENSES');
    expect(result).toContain('lodash');
  });
});

