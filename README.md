# license-checker-plugin

A bundler-agnostic plugin that generates third-party license notices for packages actually bundled into your final build. Supports **webpack 5**, **Rspack**, and **Vite**.

## Features

- Scans the bundler's module graph for used npm packages
- Reads license metadata using the built-in license checker (zero external dependencies)
- Emits TXT, JSON, Markdown, or HTML assets at build time
- Supports compliance rules with built-in presets (`commercial`, `permissive`, `enterprise`, `oss`, `strict`, `none`)
- Custom policy with `allow`, `review`, `deny` lists
- Configurable severity for unknown/missing licenses
- Respects SPDX License Expressions (`MIT OR GPL-2.0`, `MIT AND Apache-2.0`)
- Filter by package name and/or license type
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
const { LicenseWebpackPlugin } = require("license-checker-plugin");

module.exports = {
  mode: "production",
  plugins: [
    new LicenseWebpackPlugin({
      filename: "third-party-licenses.txt",
      format: "txt",
      includeLicenseText: true,
      policy: { preset: "commercial" },
    }),
  ],
};
```

### Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { viteLicensePlugin } from "license-checker-plugin";

export default defineConfig({
  plugins: [
    viteLicensePlugin({
      filename: "third-party-licenses.json",
      format: "json",
      includeLicenseText: true,
    }),
  ],
});
```

## Options

| Option                 | Type                                      | Default                    | Description                                                       |
| ---------------------- | ----------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `filename`             | `string`                                  | `licenses.txt`             | Output asset name                                                 |
| `format`               | `'txt' \| 'json' \| 'markdown' \| 'html'` | `txt`                      | Output format                                                     |
| `includeLicenseText`   | `boolean`                                 | `true`                     | Include license text when supported                               |
| `includeRepository`    | `boolean`                                 | `true`                     | Include repository URLs                                           |
| `includeHomepage`      | `boolean`                                 | `true`                     | Include homepage URLs                                             |
| `includeAuthor`        | `boolean`                                 | `true`                     | Include author/publisher details                                  |
| `excludePackages`      | `(string \| Function)[]`                  | `[]`                       | Exclude listed packages from output                               |
| `policy`               | `Policy \| string`                        | `{ preset: "commercial" }` | License compliance policy                                         |
| `unknownLicense`       | `'ignore' \| 'warn' \| 'error'`           | `'warn'`                   | How to handle UNKNOWN licenses                                    |
| `missingLicense`       | `'ignore' \| 'warn' \| 'error'`           | `'warn'`                   | How to handle packages with no license info                       |
| `cache`                | `boolean`                                 | `true`                     | Reuse the in-memory license database                              |
| `workspaceRoot`        | `string`                                  | Bundler's root context     | Root path for license scanning                                    |
| `recorder`             | `Recorder`                                | —                          | External recorder shared across compiler instances (webpack only) |
| `recordOnly`           | `boolean`                                 | `false`                    | Record findings without emitting (webpack multi-compiler only)    |
| `waitForRecorderCount` | `number`                                  | —                          | Wait for N reports before emitting combined asset (webpack only)  |

> **Note:** `recorder`, `recordOnly`, and `waitForRecorderCount` are webpack-only options and are not available in the Vite plugin.

## How it works

The plugin uses a **two-phase** architecture:

1. **Database phase**: Scans `node_modules` with the built-in license checker to build a comprehensive cache of all package license information.
2. **Scan phase**: Inspects the bundler's module graph to find which packages are actually used in the final bundle.

Only packages that appear in the bundler's output are included in the license asset. DevDependencies that are never imported will not appear.

## Filtering dependencies by package name

The plugin starts with the set of dependency entries detected from the bundler's module graph, resolves license metadata for those entries, and then applies `excludePackages`. Package names are matched with exact, case-sensitive string comparison, or via a predicate function.

### Transitive dependency behavior

`excludePackages` is entry-based. Excluding `foo` removes the `foo` entry itself, but it does not automatically remove every dependency that `foo` depends on.

### Example

```js
new LicenseWebpackPlugin({
  excludePackages: ["react-dom"],
});
```

## Output formats

### TXT

Human-readable notice file for app distribution.

### JSON

Machine-readable output for CI, audits, and internal tooling.

### Markdown

Useful for GitHub releases or repository documentation.

### HTML

Useful for Electron about pages and in-app license views.

## License Compliance

The plugin includes a built-in compliance engine that evaluates each bundled package's license against a configurable **Policy**. Each package gets one of three statuses:

| Status   | Description                  |
| -------- | ---------------------------- |
| `PASS`   | License satisfies the policy |
| `REVIEW` | Requires manual review       |
| `FAIL`   | License does not comply      |

The overall build result follows the worst status: any `FAIL` stops the build; `REVIEW` packages produce warnings (but do not fail).

### Policy

A `Policy` can reference a built-in preset, or define custom `allow`/`review`/`deny` lists. Custom lists override the preset when both are given.

```ts
interface Policy {
  preset?: Preset;
  allow?: string[]; // licenses that always PASS
  review?: string[]; // licenses flagged for manual review
  deny?: string[]; // licenses that FAIL
}
```

#### Built-in presets

| Preset       | Description                                                              |
| ------------ | ------------------------------------------------------------------------ |
| `commercial` | Default. Permissive + weak copyleft allowed; strong copyleft denied      |
| `permissive` | Only permissive licenses allowed; everything else requires review        |
| `enterprise` | Only permissive licenses allowed; all copyleft denied (strong + weak)    |
| `oss`        | All licenses allowed (no restrictions)                                   |
| `strict`     | Whitelist mode. Only `allow`-listed licenses pass; everything else fails |
| `none`       | No compliance checks (all packages pass)                                 |

#### Preset license categories

| Category            | Licenses                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Permissive**      | MIT, MIT-0, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, CC0-1.0, Unlicense, 0BSD, BSL-1.0, Zlib, Artistic-2.0, Python-2.0, WTFPL, CC-BY-4.0, BlueOak-1.0.0, Unicode-DFS-2015, NCSA |
| **Weak copyleft**   | LGPL-2.1\*, LGPL-3.0\*, MPL-2.0, EPL-1.0, EPL-2.0, CDDL-1.0, EUPL-1.2, PostgreSQL                                                                                                   |
| **Strong copyleft** | GPL-2.0\*, GPL-3.0\*, AGPL-1.0, AGPL-3.0\*, SSPL-1.0, OSL-3.0, RPL-1.5                                                                                                              |

> \* Licenses marked with `*` also include their `-only` and `-or-later` SPDX variants (e.g. `GPL-3.0-only`, `AGPL-3.0-or-later`).

### Examples

```js
// Use a preset
new LicenseWebpackPlugin({
  policy: { preset: "commercial" },
});

// Custom allow/deny lists
new LicenseWebpackPlugin({
  policy: {
    allow: ["MIT", "Apache-2.0"],
    deny: ["GPL-3.0", "AGPL-3.0"],
  },
});

// Override preset with custom lists
new LicenseWebpackPlugin({
  policy: {
    preset: "commercial",
    allow: ["MIT", "Apache-2.0"], // overrides the preset's allow list
  },
});

// Whitelist mode (strict)
new LicenseWebpackPlugin({
  policy: { preset: "strict", allow: ["MIT", "Apache-2.0"] },
});
```

### SPDX Expressions

The engine fully respects SPDX License Expressions:

- `MIT OR GPL-2.0` — passes if **any** alternative is allowed
- `MIT AND GPL-2.0` — passes only if **all** licenses are allowed
- `MIT WITH LLVM-exception` — exception is handled per SPDX spec

### Unknown / missing licenses

| Option           | Values                            | Default  | Description                                |
| ---------------- | --------------------------------- | -------- | ------------------------------------------ |
| `unknownLicense` | `'ignore'` / `'warn'` / `'error'` | `'warn'` | How to treat UNKNOWN licenses              |
| `missingLicense` | `'ignore'` / `'warn'` / `'error'` | `'warn'` | How to treat packages without license info |

```js
new LicenseWebpackPlugin({
  unknownLicense: "error", // fail on unknown licenses
  missingLicense: "ignore", // silently skip packages with no license field
});
```

## Multi-compiler usage (webpack only)

When using webpack's [multi-compiler](https://webpack.js.org/configuration/configuration-types/#exporting-multiple-configurations) mode (an array of configurations) each compiler runs independently. The `recorder` option lets all instances share a single `DefaultRecorder` so that one primary instance can merge all their findings and emit a single combined license file.

```js
const {
  LicenseWebpackPlugin,
  DefaultRecorder,
} = require("license-checker-plugin");

const sharedRecorder = new DefaultRecorder();

module.exports = [
  {
    name: "renderer",
    entry: "./src/renderer/index.js",
    plugins: [
      new LicenseWebpackPlugin({
        recorder: sharedRecorder,
        recordOnly: true,
      }),
    ],
  },
  {
    name: "main",
    entry: "./src/main/index.js",
    plugins: [
      new LicenseWebpackPlugin({
        filename: "third-party-licenses.txt",
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
  waitForReports(
    expectedCount?: number,
    timeoutMs?: number,
  ): Promise<LicenseBuildReport[]>;
}
```

`DefaultRecorder` is the built-in implementation. It stores reports in memory and resolves `waitForReports` as soon as the expected count is reached.

## API

### `LicenseWebpackPlugin`

webpack/Rspack plugin (class, use with `new`).

### `viteLicensePlugin(options)`

Vite plugin (function, returns a plugin object).

```ts
import { viteLicensePlugin } from "license-checker-plugin";
```

### `LicensePluginCore`

Framework-agnostic core that can be used to build adapters for other bundlers.

```ts
import { LicensePluginCore } from "license-checker-plugin";
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

[MIT](LICENSE)
