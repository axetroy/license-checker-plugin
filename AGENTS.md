# AGENTS.md

This file provides context and instructions for AI coding agents working on this project. Human-oriented docs live in [README.md](./README.md) and [design/Design.md](./design/Design.md).

## Project overview

A bundler-agnostic plugin that scans the module graph to generate third-party license notices and enforce license compliance policies for bundled packages. Supports **webpack 5**, **Rspack**, and **Vite**.

Core architecture is **two-phase**:

1. **Database phase** — scans `node_modules` with the built-in license checker to build a license cache (`LicenseDatabase`).
2. **Scan phase** — inspects the bundler's module graph to find packages actually used in the final bundle.

Only packages present in the bundle output appear in the license asset; unused devDependencies are excluded.

### Module layout (`src/`)

| Path                      | Responsibility                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `LicensePluginCore.ts`    | Bundler-agnostic core: orchestration, options, formatting, compliance                     |
| `LicenseWebpackPlugin.ts` | webpack 5 adapter                                                                         |
| `ViteLicensePlugin.ts`    | Vite adapter                                                                              |
| `checker/`                | Built-in license checker, `LicenseDatabase`, `LicenseCache`                               |
| `compliance/`             | Compliance engine: `Policy`, presets, `PASS`/`REVIEW`/`FAIL` evaluation                   |
| `formatter/`              | Output formatters (`TxtFormatter`, `JsonFormatter`, `MarkdownFormatter`, `HtmlFormatter`) |
| `model/`                  | Data models (`PackageInfo`, `LicenseInfo`, `LicenseBuildReport`)                          |
| `scanner/`                | Package scanning (`PackageScanner`, `PackageResolver`)                                    |
| `Recorder.ts`             | Multi-compiler support for webpack (`recorder`/`recordOnly`/`waitForRecorderCount`)       |

## Setup commands

Requires Node.js >= 20 (see `engines` in `package.json`).

```bash
npm install        # install dependencies
npm run build      # compile src → dist via tsc (tsconfig.build.json)
npm run lint       # type-check only (tsc --noEmit)
npm test           # run the full test suite
```

`npm run prepack` runs the build automatically before publishing.

## Testing instructions

- Run all tests: `npm test` (uses `node --experimental-vm-modules`, already configured in the npm scripts).
- Unit tests: `npm test -- --testPathPattern=tests/unit/`
- Integration tests (real bundlers, slow):
  - `npm run test:webpack`
  - `npm run test:rspack`
  - `npm run test:vite`
- Integration tests compile fixtures through real webpack/rspack/vite builds, so they can be slow and require network access to install real packages (see `tests/integration/shared/real-packages.test.ts`).
- Snapshot tests live in `tests/**/__snapshots__/`. When changing output of a formatter, update the affected snapshots (`npm test -- -u`) and review the diff.
- Run `npm run lint` and the full suite (`npm test`) and make sure everything is green before finishing a task.

## Code style

- TypeScript **strict** mode (`"strict": true` in `tsconfig.json`); avoid `any` unless necessary.
- ESM source code: relative imports **must** use the `.js` extension (e.g. `import { LicenseDatabase } from './checker/LicenseDatabase.js'`).
- 2-space indentation, single quotes, semicolons.
- Use JSDoc comments on public API surfaces (options, interfaces, exported functions).
- Keep the core bundler-agnostic: `LicensePluginCore` and its dependencies must not import webpack/vite APIs. Bundler-specific code belongs in the adapter files (`LicenseWebpackPlugin.ts`, `ViteLicensePlugin.ts`).

## Architecture conventions

- Preserve the two-phase architecture (database phase → scan phase).
- The only runtime dependency is `spdx-expression-parse`. Do not add new runtime dependencies without a strong reason.
- Compliance statuses: any `FAIL` stops the build; `REVIEW` produces warnings but does not fail; `PASS` satisfies the policy.
- To add a new output format: implement the `Formatter` interface and register it in `LicensePluginCore`.
- When adding/changing license presets or categories, keep `src/compliance/presets.ts` in sync with the README's preset table.
- Update README.md (and design docs if the architecture changes) when user-facing behavior changes.

## Git / commit guidelines

- Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `chore:`, `docs:`).
- Keep changes focused; update `CHANGELOG.md` for user-facing changes.
