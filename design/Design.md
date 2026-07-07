# License Checker Plugin 设计白皮书

## 1. 项目背景

现代 JavaScript 应用依赖大量第三方开源组件。商业软件（Electron 应用、桌面软件、企业 Web 应用）在最终发布时需提供 Third-Party Licenses 或 Open Source Notices，以满足 MIT、Apache、BSD 等开源协议的合规要求。

已有的工具（如 `license-checker-rseidelsohn`）可以扫描整个项目的依赖树，但其输出的是**全部 node_modules 依赖**，而非**最终实际进入 Bundle 的依赖**。这会导致输出过多无关信息，且无法按 Chunk 划分。

因此，本项目设计一个 Bundler 插件，在构建结束后：

- 识别最终 Bundle 实际使用的第三方依赖
- 查询对应 License 信息
- 生成合规的 License 文件
- 支持 License 合规检查（CI）
- 支持多种输出格式

---

## 2. 设计目标

### 核心目标

- 自动扫描最终 Bundle 使用的 Package
- 自动读取对应 License
- 输出 Third Party Licenses
- 无需修改业务代码
- 与构建流程完全融合

### 非目标

插件不负责：

- 解析源码 License Header
- 管理 SPDX 数据库
- 下载 License
- 修改源码或 Bundle 内容

---

## 3. 总体架构

```
                    ┌─────────────────────┐
                    │  Bundler Adapters   │
                    │  (Webpack/Rspack/Vite)│
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  LicensePluginCore  │
                    │  (Bundler-agnostic) │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Package    │    │   License    │    │  Formatter   │
   │  Scanner    │    │  Database    │    │  (Strategy)  │
   └─────────────┘    └──────────────┘    └──────────────┘
          │                    │
          ▼                    ▼
   ┌─────────────┐    ┌──────────────┐
   │  Package    │    │  BuiltIn     │
   │  Resolver   │    │  Checker     │
   └─────────────┘    └──────────────┘
```

整个插件遵循分层设计：

- **Adapter 层**：对接不同 Bundler 的生命周期
- **Core 层**：Bundler 无关的核心逻辑
- **Scanner 层**：扫描 Bundler 模块图，解析 Package 信息
- **Checker 层**：扫描 node_modules，收集 License 信息
- **Formatter 层**：策略模式，支持多种输出格式

---

## 4. 模块职责

### 核心引擎 (Core)

Bundler 无关的编排层，管理所有模块的协作。负责：

- 配置管理与默认值合并
- LicenseDatabase 初始化
- Package 扫描入口
- License 合规检查（onlyAllow / failOn）
- 与 Recorder 的协调（MultiCompiler 场景）

对外暴露 `output` 和 `format` 两个方法。

### 适配器 (Adapter)

将 Core 接入不同 Bundler 的生命周期：

- **Webpack / Rspack**：通过 `thisCompilation` + `processAssets` 钩子，在 `PROCESS_ASSETS_STAGE_REPORT` 阶段介入
- **Vite**：通过 `buildStart`、`transform`、`generateBundle` 钩子

Adapter 层负责：
- 从 Bundler 上下文获取项目根路径
- 调用 Core 的 `initialize()` 和 `generateLicenseItems()`
- 将格式化结果通过 Bundler 的 API emit 为构建产物

### 扫描层 (Scanner)

负责从 Bundler 的模块图中提取实际使用的 Package 信息：

- 遍历 Chunks 和 Modules
- 从模块路径中解析 Package Name、Version、元数据
- 支持普通包和 `@scope/name` 格式
- 结果按 `name@version` 去重，合并 Chunk 归属信息

### 许可证层 (Checker)

负责从 `node_modules` 收集许可证信息：

- **内置扫描器**：零外部运行时依赖，递归扫描 `node_modules`，读取 `package.json` 的 license 字段和 LICENSE 文件内容
- **LicenseDatabase**：门面模式，缓存一次扫描结果，提供按 `name@version` 的查询
- **LicenseCache**：内存 Map 封装

可选择性地跳过许可证内容读取以提升性能。

### 格式化层 (Formatter)

策略模式，统一接口：

```ts
export interface Formatter {
  generate(items: OutputItem[]): string;
}
```

内置实现：

- **TXT**：带格式对齐的纯文本，可选许可证正文
- **JSON**：结构化数据，适合 CI 和处理
- **Markdown**：表格输出，适合 GitHub
- **HTML**：完整页面，折叠许可证

### 数据模型

- **PackageInfo**：包名、版本、路径、Chunk 归属、元数据
- **LicenseInfo**：SPDX 标识符、许可证文件路径、许可证全文
- **OutputItem**：PackageInfo + LicenseInfo 的组合，供 Formatter 消费
- **LicenseBuildReport**：一组 OutputItem 的集合，用于 MultiCompiler 场景

### Recorder

可选模块，用于 Webpack MultiCompiler 场景下跨 Compiler 共享和合并许可证报告：

- `record()`：提交一份报告
- `getReports()`：获取全部报告
- `waitForReports()`：异步等待指定数量的报告（支持超时）
- 合并时按 `name@version` 去重

---

## 5. 核心数据流

```
Bundler Build
     │
     ▼
LicensePluginCore.initialize()
     │ 扫描所有 node_modules，预填充 LicenseDatabase
     ▼
PackageScanner.scan(compilation)
     │ 遍历 Chunks + Modules，调用 PackageResolver 解析
     ▼
Map<PackageKey, PackageInfo>
     │
     ▼
LicensePluginCore.generateLicenseItems()
     │
     ├─ resolveLicenseEntries()
     │   从 LicenseDatabase 查询，回退到 PackageInfo.license 缓存，
     │   最终回退到同步读取 package.json
     │
     ├─ checkCompliance()
     │   onlyAllow / failOn 合规检查
     │
     ├─ buildOutputItems()
     │   按配置筛选输出字段
     │
     └─ mergeReports() (可选)
         MultiCompiler 场景合并多个 Recorder 报告
     │
     ▼
Formatter.generate(items)
     │
     ▼
emitAsset() / emitFile()
```

---

## 6. Bundler 适配层

### Webpack 5 / Rspack

`LicenseWebpackPlugin` 实现 `WebpackPluginInstance`，通过 `thisCompilation` + `processAssets` 钩子介入构建流程。

```ts
compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
  compilation.hooks.processAssets.tapPromise(
    { name: PLUGIN_NAME, stage: PROCESS_ASSETS_STAGE_REPORT },
    async () => {
      /* ... */
    },
  );
});
```

使用 `compiler.webpack.sources.RawSource` 直接 emit Asset，兼容 Webpack 5 和 Rspack。

### Vite

`viteLicensePlugin` 工厂函数返回一个 Vite Plugin 对象：

- `buildStart`：初始化 LicenseDatabase
- `transform`：拦截 `node_modules` 的模块，解析 PackageInfo
- `generateBundle`：生成 License 文件并调用 `this.emitFile()`

支持传入 `LicensePluginOptions` 配置。

---

## 7. Package Scanner & Resolver

### PackageScanner

遍历 `compilation.chunks` 和 `chunkGraph.getChunkModulesIterable()`，从每个模块中提取资源路径。

通过 `rootModule` 回退处理 re-export 场景。

### PackageResolver

从模块路径（如 `/node_modules/react/index.js`）中提取：

- Package Name（支持 `@scope/name` 格式）
- Package Root 路径
- Package Version、Repository、Author 等元数据

解析结果通过内部 `Map` 缓存，同一包路径避免重复 I/O。

---

## 8. License Resolution

### BuiltInLicenseChecker

零外部运行时依赖的内置扫描器：

- 递归扫描 `node_modules`（含嵌套、scoped 包、symlink 循环保护）
- 读取 `package.json` 的 `license` / `licenses` 字段
- 自动匹配 `LICENSE`、`LICENCE`、`COPYING`、`COPYRIGHT` 等文件名（大小写不敏感）
- 读取 License 文本内容
- URL 规范化（`git+https://`、`git://`、`.git` 后缀处理）

### LicenseDatabase

门面模式，封装扫描逻辑：

- `initialize()`：首次扫描并缓存所有结果
- `getLicense()`：按 `name@version` 查询，未命中返回 `'UNKNOWN'`
- 支持 `includeLicenseText` 参数按需控制是否读取文本内容

### 缓存

- `LicenseCache`：Map 包装器
- `cache` 选项：控制是否复用缓存实例（MultiCompiler 场景）
- 路径变化时自动重新初始化

---

## 9. Output Formatters

所有 Formatter 实现 `Formatter` 接口：

```ts
export interface Formatter {
  generate(items: OutputItem[]): string;
}
```

| 格式     | 类                  | 特性                                                                           |
| -------- | ------------------- | ------------------------------------------------------------------------------ |
| TXT      | `TxtFormatter`      | `# THIRD-PARTY LICENSES` 头部，对齐字段，可选 License Text 块                  |
| JSON     | `JsonFormatter`     | 标准 JSON 数组，含 name/version/license/repository/homepage/author/licenseText |
| Markdown | `MarkdownFormatter` | 表格输出，当存在 licenseText 时自动增加 License Text 列                        |
| HTML     | `HtmlFormatter`     | 完整 HTML 页面，可折叠 License Text，CSS 样式                                  |

---

## 10. License Compliance

合规检查由 `LicensePluginCore.checkCompliance()` 实现。

### onlyAllow

白名单模式。仅允许指定许可证列表中的许可证。

支持 SPDX Expression 分解：

- `MIT OR Apache-2.0`：任一许可证在 allow 列表中即通过
- `MIT AND Apache-2.0`：所有许可证均在 allow 列表中才通过

### failOn

黑名单模式。命中指定许可证列表立即报错。

### 错误处理

- 仅当 onlyAllow 或 failOn 触发时输出 Error
- 不触发时正常生成 License 文件

详细设计见 [`License Compliance Engine.md`](./License%20Compliance%20Engine.md)。

---

## 11. Multi-Compiler Recorder

支持 Webpack MultiCompiler 场景。

### Recorder 接口

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

### DefaultRecorder

- 线程安全的内存收集器
- `waitForReports()`：异步等待指定数量的报告，支持超时
- `flushWaiters()`：有新的 record 时自动检查并 resolve

### 配置

- `recorder`：共享 Recorder 实例
- `recordOnly`：仅记录不输出
- `waitForRecorderCount`：等待 N 个 Compiler 报告后再合并输出

合并时按 `name@version` 去重。

---

## 12. 数据模型

### PackageInfo

```
name, version, path, packageJsonPath
chunks[], modules[]
repository?, homepage?, author?, publisher?
private?, license?
```

### LicenseInfo

```
license        — SPDX identifier(s)
licenseFile?   — 磁盘上的许可证文件路径
licenseText?   — 许可证全文
```

### OutputItem

```
package: PackageInfo
license: LicenseInfo
```

### LicenseBuildReport

```
items: OutputItem[]
```

---

## 13. 配置选项

| 选项                   | 类型                                | 默认值           | 说明                     |
| ---------------------- | ----------------------------------- | ---------------- | ------------------------ |
| `filename`             | `string`                            | `'licenses.txt'` | 输出文件名               |
| `format`               | `'txt'\|'json'\|'markdown'\|'html'` | `'txt'`          | 输出格式                 |
| `includeLicenseText`   | `boolean`                           | `true`           | 是否包含许可证全文       |
| `includeRepository`    | `boolean`                           | `true`           | 是否包含仓库地址         |
| `includeHomepage`      | `boolean`                           | `true`           | 是否包含主页             |
| `includeAuthor`        | `boolean`                           | `true`           | 是否包含作者             |
| `excludePackages`      | `(string\|Function)[]`              | `[]`             | 排除的包                 |
| `onlyAllow`            | `string[]`                          | `[]`             | 仅允许的许可证列表       |
| `failOn`               | `string[]`                          | `[]`             | 禁止的许可证列表         |
| `cache`                | `boolean`                           | `true`           | 是否复用 LicenseDatabase |
| `workspaceRoot`        | `string`                            | `''`             | 扫描根路径               |
| `recorder`             | `Recorder`                          | —                | 共享 Recorder            |
| `recordOnly`           | `boolean`                           | `false`          | 仅记录不输出             |
| `waitForRecorderCount` | `number`                            | —                | 等待报告数               |

---

## 14. 设计原则

- **SRP**：扫描、解析、许可证查询、格式化、合规检查均为独立模块
- **OCP**：通过策略接口扩展新输出格式，无需修改核心流程
- **最小依赖**：仅依赖 `spdx-expression-parse`，许可证扫描完全内置
- **构建无侵入**：不修改源码、不修改 Bundle、不影响 Chunk Hash
- **Bundler 无关**：Core 层不依赖任何 Bundler API，通过 Adapter 对接

---

## 15. 扩展能力

- 新增 Formatter：实现 `Formatter` 接口即可
- 新增 Bundler 支持：编写 Adapter 调用 `LicensePluginCore`
- 自定义 License Provider：替换或扩展 `BuiltInLicenseChecker`
- SBOM / SPDX / CycloneDX 输出：新增对应 Formatter
