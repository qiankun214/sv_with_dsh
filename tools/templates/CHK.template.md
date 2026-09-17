---
id: {{ID}}
title: {{TITLE}}
status: draft
owner: agent
reviewer:
date:
upstream: {{UPSTREAM}}
artifacts: []
---

# {{ID}} {{TITLE}}

> 模块：`{{MODULE}}`　短名：`{{SHORT}}`

## 结论摘要

| 检查 | 工具 | 结论 | 关键数字 | 原始报告 |
|---|---|---|---|---|
| 语法/可综合性 lint | verilator --lint-only | | warnings: | `reports/{{MODULE}}/lint/summary.md` |
| 风格 lint / 格式 | verible | | | `reports/{{MODULE}}/lint/` |
| SV 语义 | slang | | | |
| 综合（sky130） | yosys + sky130_fd_sc_hd | | cells: | `reports/{{MODULE}}/synth/summary.md` |
| 行/翻转覆盖 | cocotb + verilator --coverage | | line: % toggle: % | `reports/{{MODULE}}/cov/summary.md` |

> 数字必须与原始报告一致，不允许手抄走形；缺项写明 skip 原因。

## 告警与豁免

| 规则 | 位置 | 处置（修复/waiver） | waiver 到期 |
|---|---|---|---|
| | | | |

## 与预算的对照

| 指标 | ② 预算 | 本次实测 | 偏差与解释 |
|---|---|---|---|
| 面积（单元数） | | | |
| 频率 | | | |

## 与上一版的差异

| 指标 | 上一版 | 本版 | 变化 |
|---|---|---|---|
| 告警数 | | | |
| 面积 | | | |

## 未执行项

<!-- 工具缺失/环境限制导致 skip 的检查，逐条列明与原因。 -->

| 检查 | 原因 | 补跑条件 |
|---|---|---|
| | | |

## 结论与后续

<!-- 是否可进入下一轮/交付；遗留问题与 owner。 -->
