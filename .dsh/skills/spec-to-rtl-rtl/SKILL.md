---
name: spec-to-rtl-rtl
description: 阶段④RTL编写：依据已放行的详细设计写可综合 SystemVerilog，并通过 gate 04（lint/格式）。当用户要写模块 RTL、改端口、修 lint 告警时使用。
---

# ④ RTL 编写

在 `04-rtl/<module>/` 下产出可综合 SystemVerilog。**上游是该模块已 approved 的 `DES-*`**——端口、状态机、边界行为
全部来自详设，不允许自由发挥。RTL 是代码不是文档，**追溯锚点是模块目录**，不给每个 `.sv` 编 ID。

## 1. 前置检查

```bash
python3 tools/sv.py gate 03 --module rr_arbiter     # 详设必须无 hard fail 且已放行
head -5 standards/coding-standard.md                # 若含 PLACEHOLDER，产物需标注
```

## 2. 目录与命名

```
04-rtl/
└── rr_arbiter/
    ├── rr_arbiter.sv        # 顶层文件与模块同名
    ├── rr_arbiter_ctrl.sv
    └── rr_arbiter.f         # filelist：lint / 综合 / cocotb 共用的输入
```

- 顶层模块名 = 目录名（`rr_arbiter`），门禁会查 `module <dir>` 是否存在。
- 子模块用 `<top>_<role>.sv`；被引用者写在 `.f` 前面（文件顺序在 `.f` 里体现）。
- `include/` 只在确有共享头文件时才建。

## 3. 模块契约在 03，不在这里

模块的唯一身份来源是 **`03-design/<module>/module.yaml`**（`id_short`、`implements`、`files`）：

```yaml
# 03-design/rr_arbiter/module.yaml
module: rr_arbiter
id_short: rra
implements: [DES-rra-001, DES-rra-002]      # 由 `sv.py new des` 自动追加
files: [rr_arbiter.sv, rr_arbiter_ctrl.sv]  # 必须存在于 04-rtl/rr_arbiter/
```

- `implements` 里每条必须存在、属于本模块，且已 `approved`，否则 ④ 门禁 hard fail。
- `files` 里每个文件必须真实存在，否则 hard fail。
- 新文件要同时登记到 `files`（`sv.py new rtl` 自动做；手工新建则必须自己补）。
- `04-rtl/` 不重复声明模块身份，避免两处漂移。

## 4. 编码规范

**先读 `standards/coding-standard.md`**。该文件若仍是 placeholder（文件头有 `PLACEHOLDER`），
产物必须显式标注「依赖 placeholder 规范」，门禁会给出 warn。agent 不得自行发明风格。

编码要求（细节以该文件为准）：

1. **一个 `always` 块或 `assign` 只允许给一个变量赋值**；只有「赋值条件完全相同、且含义强关联」的变量才可以放进同一个 `always` 块
   （例：同一个优先编码器里的 `idx_hi` / `idx_lo` 与扫描标志 `hi_found` / `lo_found`）。
   不要把一组无关的组合信号塞进同一个 `always_comb`；`always_ff` 同理，一个块只驱动一组同源寄存器。
   纯表达式优先用 `assign`（一信号一条），过程式条件用单变量 `always_comb`。
2. **不允许嵌套三元运算符**。单层三目可用；需要多级条件时用 `if` / `else if` / `else`（分支里只给同一个变量赋值）。
3. 只用 `always_ff` / `always_comb`；非阻塞与阻塞赋值不混用；
4. 每个 `always_comb` 先给默认值，禁止推断 latch；
5. 所有端口/信号/参数显式位宽，比较两侧位宽一致，常量带位宽与进制；
6. 同步复位低有效（`rst_n`），异步必须有详设里的理由；
7. 每个模块头部注释写清：功能、时钟域、复位方式、对应的 `DES-*`。

> 第 1、2 条由人类评审者于 2026-10-03 明确要求，已同步进 `tools/templates/RTL.template.sv`
> 与 `standards/review-checklist.md` §E；`gate 04` 只查 lint/格式，这两条靠**评审**核对。

## 5. 步骤

```bash
python3 tools/sv.py new rtl --module rr_arbiter --title "轮询仲裁器"
```

生成带 TODO 的骨架后按 `DES-*` 的端口表逐条落实；端口数量/方向/位宽/命名与详设不一致时**回到 ③ 改详设并重新放行**，
不要在 RTL 里私自加端口。

## 6. 门禁与自检

```bash
python3 tools/sv.py gate 04 --module rr_arbiter --dry-run   # 先看会跑什么
python3 tools/sv.py gate 04 --module rr_arbiter
```

- hard fail：模块与详设对不上、`.f` 文件缺失、顶层名不符、`module.yaml` 不一致 → 必须修。
- lint / 格式 / SV 语义类为 soft warn（分别由 verilator / verible / slang 产出）：修到 0，
  或在 `06-checks/waivers/rr_arbiter.yaml` 登记**未过期**的 waiver（写明理由、owner、到期日）。
- 工具未安装会 skip：把 skip 项记录下来交给用户，不要声称已 lint 过。

## 7. 完成定义

1. `gate 04` 无 hard fail；
2. 端口与 `DES-*` 端口表逐条一致（数量/方向/位宽/命名）；
3. lint 与格式告警清零，或有未过期 waiver；
4. 自查：复位行为、边界条件、位宽截断三处最容易与详设不一致，逐条对照；
5. `python3 tools/sv.py trace` 更新 `INDEX.md`。

## 8. 禁止

- 写详设里没有的端口或行为（要加就回 ③）。
- 用 waiver 掩盖结构或追溯问题（waiver 只对 lint/综合/覆盖率类 soft 检查有效）。
- 把 `obj_dir/`、网表、波形提交进仓（`.gitignore` 已覆盖，仍不要 `-f` 强加）。
- 在未读 `standards/coding-standard.md` 的情况下写 RTL。
