---
name: spec-to-rtl-arch
description: 阶段②系统方案：把已放行的功能点变成模块划分、接口、时钟复位与资源预算，产出 ARCH-*.md 并通过 gate 02。当用户要定架构、拆模块、或讨论方案取舍时使用。
---

# ② 系统方案

产出 `02-architecture/ARCH-<nnn>-<slug>.md`，上游必须是**已 approved** 的 `REQ-*`。

## 步骤

```bash
python3 tools/sv.py new arch --title "总线协议方案" --slug bus-protocol
```

必填内容与判断标准：

| 小节 | 判断标准（写不出来就是没设计完） |
|---|---|
| 功能点覆盖 | 每个声明的 `REQ-*` 都能在方案里找到实现路径 |
| 模块划分 | 模块名**就是**后续 `03-design/<module>/` 的目录名，必须一致 |
| 接口与协议 | 位宽、字节序、握手/流控无歧义 |
| 时钟与复位 | 时钟域清单 + 跨域策略；写「后面再说」视为未完成 |
| 资源/时序预算 | 面积（sky130 单元数量级）、频率、延迟都要有数；⑥ 阶段会拿它对照 |
| 被否方案 | 至少一条，写清否决理由，避免下游重复讨论 |

模块划分中每个新增模块，立即建骨架（会同时创建 03/04/05 三处目录与模块契约）：

```bash
python3 tools/sv.py new module dma --short dma
```

## 自检

```bash
python3 tools/sv.py gate 02
```

- 若发现某功能点无法被任何方案满足：**回到 ① 与用户确认**，不要默默改需求。
- 预案中的预算若明显不可达（如频率超出工艺），先暴露矛盾再放行。

## 完成定义

1. `gate 02` 无 hard fail；
2. 每个声明的 `REQ-*` 都能在方案中找到落点，模块名与目录名一致；
3. 向用户请求放行（列出模块划分与预算）；
4. 放行后写 `status: approved` + `reviewer` + `date`；
5. `python3 tools/sv.py trace` 更新 `INDEX.md`。
