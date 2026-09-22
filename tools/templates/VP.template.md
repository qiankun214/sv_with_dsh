---
id: {{ID}}
title: {{TITLE}}
status: draft
owner: agent
reviewer:
date:
upstream: {{UPSTREAM}}
artifacts: []
test_cases: []
---

# {{ID}} {{TITLE}}

> 模块：`{{MODULE}}`　短名：`{{SHORT}}`

## 验证范围与策略

<!-- 测什么、不测什么、为什么；用定向用例还是随机；与 06-checks 的分工（这里测功能，那里测质量）。 -->

## 验收标准（从 REQ 扇出）

<!-- ① 的 REQ-* 只有 IPO（输入/处理/输出 + 边界），故意不含验收标准；「什么算通过」由本阶段扇出。
     来源必须逐条可追：REQ 的每个 F*、每条接口不变式、每个时序场景都要有落点；
     每条验收标准至少对应一个 TC-*；TC-* 的 covers: 仍指向 REQ-*（门禁据此算需求覆盖）。 -->

| 验收标准 | 来源（F* / 接口不变式 / 时序场景） | 激励 | 观测点 | 量化判据 | 对应 TC-* |
|---|---|---|---|---|---|
| | | | | | |

## 测试点清单

<!-- 每个测试点一个 TC-*，必须写进本文件 front-matter 的 test_cases，并在 regress.yaml 里有同名用例。
     示例：
     test_cases:
       - id: TC-rra-001
         covers: [REQ-003]
         desc: 四个请求同时有效时按轮询顺序授权
-->

| 测试点 | 覆盖的功能点 | 描述 | 预期 |
|---|---|---|---|
| | | | |

## 边界与异常

<!-- 对照详设「边界条件」一节，逐条给出对应测试点。 -->

| 边界场景 | 对应 TC-* |
|---|---|
| | |

## 覆盖率目标

| 指标 | 目标 | 依据 |
|---|---|---|
| 行覆盖 | 80% | `regress.yaml` 阈值 |
| 翻转覆盖 | 60% | 同上 |
| 需求覆盖 | 100%（每个 REQ 至少一个 TC） | 门禁 hard fail |

## 运行方式

```bash
python3 tools/sv.py gate 05 --module {{MODULE}}
```

依赖：cocotb + Verilator + `make` + C++ 编译器（见 `docs/setup/toolchain.md`）。
