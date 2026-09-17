# ③ 详细设计（Design）

**放什么**：每个模块一份可据以写 RTL 的实现级设计：状态机、数据通路、寄存器表、接口时序、位宽与边界条件。**这是 RTL 的唯一上游契约。**

## 目录与命名

```
03-design/
├── rr_arbiter/
│   ├── module.yaml                        # 模块短名/归属（必填）
│   ├── DES-rra-001-arbitration-policy.md  # 详设
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
  - 04-rtl/rr_arbiter/rr_arbiter.sv
---
```

## 正文该写什么（写不出来的部分就是没设计完）

| 小节 | 要求 |
|---|---|
| 端口表 | 方向/位宽/时钟域/复位值/含义，逐条列全 |
| 参数 | 参数名、默认值、合法范围 |
| 状态机 | 状态列表 + 转移条件表 + 输出/次态逻辑；不用 FSM 就说明为何不用 |
| 数据通路 | 位宽推导、溢出/饱和策略、流水级划分 |
| 复位与初值 | 每个寄存器的复位值；异步/同步复位的选择理由 |
| 边界条件 | 空/满、同时请求、背压、非法输入的处理 |
| 时序假设 | 组合路径预算、是否需要流水 |
| 可综合性 | 用到的 SV 结构（是否可被 Yosys+sky130 映射），阵列/存储器是否映射为触发器 |

## 门禁

```bash
python3 tools/sv.py gate 03 --module rr_arbiter
```

- hard fail：上游 `ARCH-*` 不存在/未 approved；`module.yaml` 缺失或 `id_short` 与 ID 不匹配；ID 非法或重复。
- warn：本阶段暂无产物。

## 放行

人类评审通过后置 `status: approved`。**`04-rtl/<module>/` 只有在同模块已有 approved 详设时才允许通过 ④ 阶段门禁。**
