# ② 系统方案（Architecture）

**放什么**：为满足一个或多个功能点，系统整体怎么做——模块划分、接口、时钟复位、数据流、关键时序与资源预算。

## 命名

```
ARCH-001-clk-reset.md
ARCH-002-bus-protocol.md
```

- ID：`ARCH-<三位序号>`，全仓唯一，永不复用。
- 新建：`python3 tools/sv.py new arch --title "时钟复位方案" --slug clk-reset`

## front-matter（必填）

```yaml
---
id: ARCH-001
title: 时钟复位方案
status: draft
owner: agent
reviewer:
date:
upstream: [REQ-001, REQ-004]      # 必须指向已 approved 的 REQ
artifacts:
  - docs/diagrams/clk-tree.drawio # 相对仓根，必须存在
---
```

## 正文该写什么

| 小节 | 要求 |
|---|---|
| 方案概述 | 一句话方案 + 一张框图（图放 `docs/diagrams/`，此处引用相对路径） |
| 功能点覆盖 | 本方案覆盖哪些 `REQ-*`，逐条说明如何满足 |
| 模块划分 | 列出模块与职责，模块名即后续 `03-design/<module>/` 的目录名 |
| 接口与协议 | 模块间接口、握手/流控、位宽与字节序 |
| 时钟与复位 | 时钟域清单、跨域策略、复位同步方式 |
| 资源/时序预算 | 面积、频率、延迟、吞吐的初步预算（后续 ⑥ 阶段对照） |
| 取舍与被否方案 | 为什么不用其它方案，避免下游重复讨论 |

## 门禁

```bash
python3 tools/sv.py gate 02
```

- hard fail：上游 `REQ-*` 不存在或未 `approved`；字段缺失；`artifacts` 路径不存在。
- warn：本阶段暂无产物。

## 放行

人类评审通过后置 `status: approved` + `reviewer` + `date`。之后才能写 ③ 详细设计。
