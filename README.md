# license-webpack-plugin

A webpack 5 plugin that generates third-party license notices for packages that are actually bundled into your final build.

## Features

- Scans the final webpack module graph for used npm packages
- Reads license metadata with `license-checker-rseidelsohn`
- Emits TXT, JSON, Markdown, or HTML assets at build time
- Supports compliance rules with `onlyAllow` and `failOn`
- Works with webpack 5 `processAssets`

## Installation

```bash
npm install license-webpack-plugin webpack
```

## Usage

```js
const { LicenseWebpackPlugin } = require('license-webpack-plugin');

module.exports = {
  mode: 'production',
  plugins: [
    new LicenseWebpackPlugin({
      filename: 'third-party-licenses.txt',
      format: 'txt',
      includeLicenseText: true,
      onlyAllow: ['MIT', 'Apache-2.0', 'BSD-3-Clause'],
    }),
  ],
};
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `filename` | `string` | `licenses.txt` | Output asset name |
| `format` | `'txt' \| 'json' \| 'markdown' \| 'html'` | `txt` | Output format |
| `includeLicenseText` | `boolean` | `true` | Include license text when supported |
| `includeRepository` | `boolean` | `true` | Include repository URLs |
| `includeHomepage` | `boolean` | `true` | Include homepage URLs |
| `includeAuthor` | `boolean` | `true` | Include author/publisher details |
| `includePackages` | `string[]` | `[]` | Only include listed packages |
| `excludePackages` | `string[]` | `[]` | Exclude listed packages |
| `includeLicenses` | `string[]` | `[]` | Only include listed licenses |
| `excludeLicenses` | `string[]` | `[]` | Exclude listed licenses |
| `onlyAllow` | `string[]` | `[]` | Fail build when a used license is not allowed |
| `failOn` | `string[]` | `[]` | Fail build when a used license matches the list |
| `includeChunks` | `string[]` | `[]` | Only include packages used by specific chunks |
| `sort` | `boolean` | `true` | Sort packages by name |
| `deduplicateLicense` | `boolean` | `true` | Suppress repeated license text bodies |
| `cache` | `boolean` | `true` | Reuse the in-memory license database |
| `workspaceRoot` | `string` | `compiler.context` | Root path passed to license-checker |
| `recorder` | `Recorder` | — | External recorder shared across compiler instances (see [Multi-compiler usage](#multi-compiler-usage)) |
| `recordOnly` | `boolean` | `false` | Record findings into `recorder` but do not emit a license asset |
| `waitForRecorderCount` | `number` | — | Wait for this many reports in `recorder` before merging all reports and emitting the combined asset |

## Output formats

### TXT
Human-readable notice file for app distribution.

### JSON
Machine-readable output for CI, audits, and internal tooling.

### Markdown
Useful for GitHub releases or repository documentation.

### HTML
Useful for Electron about pages and in-app license views.

## Compliance examples

```js
new LicenseWebpackPlugin({
  onlyAllow: ['MIT', 'Apache-2.0'],
});

new LicenseWebpackPlugin({
  failOn: ['GPL-3.0', 'AGPL-3.0'],
});
```

## Multi-compiler usage

When using webpack's [multi-compiler](https://webpack.js.org/configuration/configuration-types/#exporting-multiple-configurations) mode (an array of configurations) each compiler runs independently. The `recorder` option lets all instances share a single `DefaultRecorder` so that one primary instance can merge all their findings and emit a single combined license file.

```js
const { LicenseWebpackPlugin, DefaultRecorder } = require('license-webpack-plugin');

// Create a shared recorder before the webpack configs are built.
const sharedRecorder = new DefaultRecorder();

module.exports = [
  // Secondary compiler – records its findings but does not emit a file.
  {
    name: 'renderer',
    entry: './src/renderer/index.js',
    plugins: [
      new LicenseWebpackPlugin({
        recorder: sharedRecorder,
        recordOnly: true,
      }),
    ],
  },

  // Primary compiler – records its own findings, then waits for both reports
  // (one from itself, one from the renderer) and emits the merged file.
  {
    name: 'main',
    entry: './src/main/index.js',
    plugins: [
      new LicenseWebpackPlugin({
        filename: 'third-party-licenses.txt',
        recorder: sharedRecorder,
        waitForRecorderCount: 2, // total number of compiler instances
      }),
    ],
  },
];
```

### `Recorder` interface

You can supply a custom recorder by implementing the `Recorder` interface:

```ts
export interface Recorder {
  record(report: LicenseBuildReport): void;
  getReports(): LicenseBuildReport[];
  waitForReports(expectedCount?: number, timeoutMs?: number): Promise<LicenseBuildReport[]>;
}
```

`DefaultRecorder` is the built-in implementation. It stores reports in memory and resolves `waitForReports` as soon as the expected count is reached (polling every 100 ms, timing out after 30 s by default).

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
