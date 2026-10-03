# ③ 详细设计（Design）

**放什么**：每个模块一份可据以写 RTL 的实现级设计：数据通路/控制通路实现概要、寄存器与组合变量清单（实现规划）、接口时序、位宽与边界条件。**这是 RTL 的唯一上游契约。**

## 目录与命名

```
03-design/
├── rr_arbiter/
│   ├── module.yaml                        # 模块短名/归属（必填）
│   ├── DES-rra-001-arbitration-policy.md  # 详设
│   ├── DES-rra-001-arbitration-policy/    # 与 md 同名目录：内部时序图源 .json + 渲染 .svg + README
│   ├── DES-rra-002-fsm.md
│   ├── REGMAP-rra-001-registers.md        # 专项：寄存器表（REGMAP.template.md）
│   └── IFACE-rra-001-port-timing.md       # 专项：接口/时序（IFACE.template.md）
└── dma/
    ├── module.yaml
    └── DES-dma-001-burst-split.md
```

- 新建模块：`python3 tools/sv.py new module rr_arbiter --short rra`（同时建 `03/04/05` 三处目录与 `module.yaml`）
- 新建详设：`python3 tools/sv.py new des --module rr_arbiter --title "仲裁策略"`
- 新建专项：`python3 tools/sv.py new regmap|iface --module rr_arbiter --title "..."`
- 图件布局：内部时序图放 `<阶段>/<详设文件名去扩展名>/`（与 md 同名、同级）；**端口时序引用上游 `REQ-*`，不在 ③ 重画**

## module.yaml

```yaml
module: rr_arbiter
id_short: rra          # 小写字母开头，2–8 位 [a-z0-9_]；全仓唯一；DES/VP/TC/CHK 的 ID 都用它
owner: agent
rtl_toplevel: rr_arbiter
```

## front-matter（必填）

```yaml
---
id: DES-rra-001
title: 轮询仲裁策略
status: draft
owner: agent
reviewer:
date:
upstream: [ARCH-001]                        # 必须指向已 approved 的 ARCH
artifacts:
  - 03-design/rr_arbiter/module.yaml                                  # 模块契约
  - 03-design/rr_arbiter/DES-rra-001-arbitration-policy/README.md     # 图件目录说明
  - 03-design/rr_arbiter/DES-rra-001-arbitration-policy/internal-1-round-robin.json
  - 03-design/rr_arbiter/DES-rra-001-arbitration-policy/internal-1-round-robin.svg
  # 规则：artifacts 里的路径**必须此刻真实存在**——所以不能把 ④ 才生成的 RTL 路径写进 ③ 的详设
---
```

## 正文该写什么（写不出来的部分就是没设计完）

| 小节 | 要求 |
|---|---|
| 端口表 | 方向/位宽/时钟域/复位值/含义，逐条列全 |
| 端口时序 | **引用**上游 `REQ-*` 的场景（事件 → 上游场景对应表），不重画端口波形 |
| 参数 | 参数名、默认值、合法范围、非法参数行为 |
| 数据通路实现概要 | 实现步骤（选路/运算/编码）、位宽推导（无隐式截断）、溢出/饱和策略、关键组合路径 |
| 控制通路实现概要 | 复位/使能/输出有效/状态推进的条件与动作；**尽量用 FSM**（状态列表 + 转移条件表 + 输出/次态逻辑），不用 FSM 必须写明理由 |
| 实现规划 | 寄存器清单 + 全部组合变量清单：位宽/复位值/含义/驱动来源/被谁使用；④ 的 RTL 信号名以此为准 |
| 内部时序 | WaveDrom 画端口 + 主要内部信号，覆盖连续请求推进/空闲保持/复位/请求变化；`.json`+`.svg` 入同名目录并计入 `artifacts` |
| 复位与初值 | 每个寄存器的复位值；异步/同步复位的选择理由 |
| 边界条件 | 空/满、同时请求、背压、非法输入的处理 |
| 时序假设 | 是否流水、目标频率、组合路径预算口径、对上游的时序要求 |
| 可综合性 | 用到的 SV 结构（是否可被 Yosys+sky130 映射），阵列/存储器是否映射为触发器 |

## 门禁

```bash
python3 tools/sv.py gate 03 --module rr_arbiter
```

- hard fail：上游 `ARCH-*` 不存在/未 approved；`module.yaml` 缺失或 `id_short` 与 ID 不匹配；ID 非法或重复。
- warn：本阶段暂无产物。

## 放行

人类评审通过后置 `status: approved`。**`04-rtl/<module>/` 只有在同模块已有 approved 详设时才允许通过 ④ 阶段门禁。**
