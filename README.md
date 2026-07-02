# license-checker-plugin

A bundler-agnostic plugin that generates third-party license notices for packages actually bundled into your final build. Supports **webpack 5**, **Rspack**, and **Vite**.

## Features

- Scans the bundler's module graph for used npm packages
- Reads license metadata using the built-in license checker (zero external dependencies)
- Emits TXT, JSON, Markdown, or HTML assets at build time
- Supports compliance rules with `onlyAllow` and `failOn`
- Filter by package name and/or license type
- Deduplicates repeated license text
- Works with webpack 5, Rspack, and Vite

## Installation

```bash
npm install license-checker-plugin
```

For webpack/Rspack projects, ensure `webpack` is installed (peer dependency).
For Vite projects, ensure `vite` is installed (peer dependency).

## Usage

### webpack / Rspack

```js
const { LicenseWebpackPlugin } = require('license-checker-plugin');

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

### Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { viteLicensePlugin } from 'license-checker-plugin';

export default defineConfig({
  plugins: [
    viteLicensePlugin({
      filename: 'third-party-licenses.json',
      format: 'json',
      includeLicenseText: true,
    }),
  ],
});
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
| `excludePackages` | `string[]` | `[]` | Exclude listed packages from output |
| `onlyAllow` | `string[]` | `[]` | Fail build when a used license is not allowed |
| `failOn` | `string[]` | `[]` | Fail build when a used license matches the list |
| `cache` | `boolean` | `true` | Reuse the in-memory license database |
| `workspaceRoot` | `string` | Bundler's root context | Root path for license scanning |
| `recorder` | `Recorder` | — | External recorder shared across compiler instances (webpack only) |
| `recordOnly` | `boolean` | `false` | Record findings without emitting (webpack multi-compiler only) |
| `waitForRecorderCount` | `number` | — | Wait for N reports before emitting combined asset (webpack only) |

> **Note:** `includeChunks`, `recorder`, `recordOnly`, and `waitForRecorderCount` are webpack-only options and are not available in the Vite plugin.

## How it works

The plugin uses a **two-phase** architecture:

1. **Database phase**: Scans `node_modules` with the built-in license checker to build a comprehensive cache of all package license information.
2. **Scan phase**: Inspects the bundler's module graph to find which packages are actually used in the final bundle.

Only packages that appear in the bundler's output are included in the license asset. DevDependencies that are never imported will not appear.

## Filtering dependencies by package or license

The plugin starts with the set of dependency entries detected from the bundler's module graph, resolves license metadata for those entries, and then applies the configured filters. Package names and license names are matched with exact, case-sensitive string comparison.

### Filter options

- `excludePackages`: remove entries whose package name is listed.
- `onlyAllow`: fail the build if a package license is not in the allowed list.
- `failOn`: fail the build if a package license matches the list.

### Evaluation order

1. `excludePackages`
2. `onlyAllow`
3. `failOn`

All bundled packages are included by default. `excludePackages` removes unwanted entries first, then `onlyAllow` and `failOn` enforce license policies — generating build errors and stopping output when violated.

### Transitive dependency behavior

`excludePackages` is entry-based. Excluding `foo` removes the `foo` entry itself, but it does not automatically remove every dependency that `foo` depends on.

### Combined filter example

```js
new LicenseWebpackPlugin({
  excludePackages: ['react-dom'],
  onlyAllow: ['MIT'],
  failOn: ['MIT-0'],
});
```

With this configuration:

- all bundled packages are included by default
- `react-dom` is removed from output
- it fails the build if any remaining package does not have an MIT license
- it fails the build if any remaining package has an MIT-0 license

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

## Multi-compiler usage (webpack only)

When using webpack's [multi-compiler](https://webpack.js.org/configuration/configuration-types/#exporting-multiple-configurations) mode (an array of configurations) each compiler runs independently. The `recorder` option lets all instances share a single `DefaultRecorder` so that one primary instance can merge all their findings and emit a single combined license file.

```js
const { LicenseWebpackPlugin, DefaultRecorder } = require('license-checker-plugin');

const sharedRecorder = new DefaultRecorder();

module.exports = [
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
  {
    name: 'main',
    entry: './src/main/index.js',
    plugins: [
      new LicenseWebpackPlugin({
        filename: 'third-party-licenses.txt',
        recorder: sharedRecorder,
        waitForRecorderCount: 2,
      }),
    ],
  },
];
```

### `Recorder` interface

```ts
export interface Recorder {
  record(report: LicenseBuildReport): void;
  getReports(): LicenseBuildReport[];
  waitForReports(expectedCount?: number, timeoutMs?: number): Promise<LicenseBuildReport[]>;
}
```

`DefaultRecorder` is the built-in implementation. It stores reports in memory and resolves `waitForReports` as soon as the expected count is reached.

## API

### `LicenseWebpackPlugin`

webpack/Rspack plugin (class, use with `new`).

### `viteLicensePlugin(options)`

Vite plugin (function, returns a plugin object).

```ts
import { viteLicensePlugin } from 'license-checker-plugin';
```

### `LicensePluginCore`

Framework-agnostic core that can be used to build adapters for other bundlers.

```ts
import { LicensePluginCore } from 'license-checker-plugin';
```

### `DefaultRecorder`

Built-in recorder implementation for multi-compiler scenarios.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
