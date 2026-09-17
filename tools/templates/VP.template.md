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
