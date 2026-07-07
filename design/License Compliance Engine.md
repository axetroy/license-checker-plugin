# License Compliance 模块设计白皮书

## 1. 模块定位

License Compliance 模块用于在 License 信息收集完成后，对所有第三方依赖执行许可证合规检查。

它基于插件扫描得到的 License 数据，根据预设或自定义策略判断项目是否满足许可证要求，并输出统一的检查结果。

该模块仅负责**策略评估**，不参与依赖扫描、License 识别或报告生成。

---

## 2. 设计目标

模块需要提供以下能力：

- 内置常用 License 合规策略（Preset）
- 支持用户自定义策略
- 支持 SPDX License Expression
- 输出统一的检查结果
- 可用于 CI 自动检查

---

## 3. 工作流程

```text
License Database
        │
        ▼
LicenseInfo[]
        │
        ▼
Compliance Checker
        │
        ▼
Policy
        │
        ▼
Compliance Result
```

整个流程仅执行一次。

所有判断均基于内存中的 License 数据完成。

---

# 4. Policy

Policy 描述了一组许可证规则。

每次检查均基于一个 Policy 执行。

例如：

```ts
policy: {
  preset: "commercial";
}
```

也可以完全自定义：

```ts
policy: {
    allow: [...],
    review: [...],
    deny: [...]
}
```

若同时指定 `preset` 与自定义规则，则自定义配置覆盖 Preset。

---

# 5. 内置 Preset

模块内置以下策略。

| Preset     | 说明             |
| ---------- | ---------------- |
| none       | 不进行合规检查   |
| permissive | 宽松策略         |
| commercial | 商业软件（默认） |
| enterprise | 企业级严格策略   |
| oss        | 开源项目         |
| strict     | 白名单模式       |

其中：

**commercial** 为默认策略。

适用于大多数商业软件、Electron 应用及企业 Web 项目。

---

# 6. 检查结果

每个 Package 将得到一种状态：

| 状态   | 说明           |
| ------ | -------------- |
| PASS   | 满足策略要求   |
| REVIEW | 需要人工审核   |
| FAIL   | 不符合策略要求 |

整个项目最终输出：

```text
PASS

或

FAIL
```

若存在 REVIEW，则输出 Warning。

---

# 7. SPDX Expression

模块支持解析 SPDX License Expression。

例如：

```text
MIT OR GPL-2.0
```

若 Policy 允许 MIT，则判定为 PASS。

例如：

```text
MIT AND GPL-2.0
```

由于同时依赖 GPL，

则判定为 FAIL。

对于包含 `WITH` Exception 的 SPDX 表达式，也按照 SPDX 规范进行解析。

---

# 8. 未知许可证

对于无法识别的许可证：

```text
UNKNOWN
```

可配置处理方式：

- 忽略
- Warning
- Error

默认输出 Warning。

---

# 9. 缺失许可证

对于不存在 License 信息的 Package，可配置：

- 忽略
- Warning
- Error

默认输出 Warning。

---

# 10. CI 集成

若检查结果存在 FAIL，则插件可终止构建。

例如：

```ts
policy: "commercial",

failOn: "FAIL"
```

CI 可据此自动阻止发布。

---

# 11. 扩展能力

Policy 支持扩展。

未来可增加：

- 企业自定义策略
- SPDX Policy
- License 风险等级
- License 兼容性检查
- 企业在线 Policy

无需修改现有检查流程。

---

# 12. 设计原则

License Compliance 模块遵循以下原则：

- **策略与扫描分离**：仅负责策略判断，不负责 License 收集。
- **预设优先**：提供开箱即用的 Preset，降低配置成本。
- **支持覆盖**：允许用户在 Preset 基础上增加、修改或移除规则。
- **遵循 SPDX**：按照 SPDX License Expression 规范进行判断，避免误判。
- **构建无侵入**：仅输出检查结果，不修改构建产物。
