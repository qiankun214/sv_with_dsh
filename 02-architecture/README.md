# ② 系统方案（Architecture）

**放什么**：为满足一个或多个功能点，系统整体怎么做——**整体架构、功能如何分解为模块、模块之间如何连接**，以及接口、时钟复位与资源预算。

> 本阶段的目标是**把功能分解为每个不超过 500 行 RTL 的 module**：超过 500 行必须继续拆，远低于则不为拆而拆。
> 本阶段**不设计 module 内部结构**（内部功能块、FSM、数据通路、寄存器清单）——那是 ③ 详细设计的职责；
> 也**不重复抄写 `REQ-*` 的端口表**——接口以 ① 为唯一权威。

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
  - 02-architecture/ARCH-001-clk-reset/block-diagram.md   # 图件放与 md 同名同级的目录
---
```

## 正文该写什么

| 小节 | 要求 |
|---|---|
| 方案概述 | 一句话方案 + 一张**模块级**框图（框图只画到 module 边界） |
| 功能分解为模块 | 每个 module 的功能（做什么 / 不做什么）与预计 RTL（**≤500 行**）；写清划分依据与「为何不继续拆」 |
| 模块间连接 | 连接框图 + 模块间接口表（信号/方向/位宽/说明）；只有一个 module 时写明「无模块间连接」 |
| 上游引用（不重述） | 功能点覆盖、端口、接口协议、时钟复位、时序约束 → **用引用标记指向 `REQ-*` 出处**，不重述、不复制表格 |
| 资源与时序预算 | 只写本阶段新增的数字（如面积预算）与口径（综合/回归参数档位、验证深度）；沿用上游的指标用引用 |
| 取舍与被否方案 | 为什么不用其它方案，避免下游重复讨论 |

> 通则：**只写本阶段新增的结论**，上游已有的内容用引用标记；没有新信息的小节宁可不写。
> 通用约定（布局、格式、判据、流程）见本 README 与 `spec-to-rtl-arch` 技能，不在每份产物里重复。

## 图件布局

- 图源与渲染产物放 `02-architecture/<本 ARCH 文件名去扩展名>/`，与本文件的 `.md` **同名、同级**；
- 结构框图用 **Mermaid + ASCII**（`.md`）；时序类图用 **WaveDrom**（`.json` 图源 + `.svg` 渲染）；
- 两件都入库并列入 front-matter 的 `artifacts`。

## 门禁

```bash
python3 tools/sv.py gate 02
```

- hard fail：上游 `REQ-*` 不存在或未 `approved`；字段缺失；`artifacts` 路径不存在。
- warn：本阶段暂无产物。

## 放行

人类评审通过后置 `status: approved` + `reviewer` + `date`。之后才能写 ③ 详细设计。
