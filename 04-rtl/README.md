# ④ RTL 编写（RTL）

**放什么**：可综合的 SystemVerilog 代码，一个模块一个目录，配一份 filelist。**RTL 的追溯锚点是模块目录**，不给每个 `.sv` 单独编 ID。

## 目录与命名

```
04-rtl/
└── rr_arbiter/
    ├── rr_arbiter.sv        # 顶层文件与模块同名
    ├── rr_arbiter_ctrl.sv
    └── rr_arbiter.f         # filelist：lint / 综合 / cocotb 共用的输入
```

- 顶层模块名 = 目录名（`rr_arbiter`）；子模块用 `<top>_<role>.sv`。
- 文件顺序在 `.f` 里体现（被引用者在前）。
- `include/` 只有在确有共享头文件时才建。
- 新建：`python3 tools/sv.py new rtl --module rr_arbiter --title "..."`（生成带 TODO 的骨架）

## 模块契约在 03-design，不在这里

模块的唯一身份来源是 **`03-design/<module>/module.yaml`**（`id_short`、`implements`、`files`）。
本目录不重复声明，避免两处漂移。

```yaml
# 03-design/rr_arbiter/module.yaml
module: rr_arbiter
id_short: rra
implements: [DES-rra-001, DES-rra-002]   # 由 `sv.py new des` 自动追加
files: [rr_arbiter.sv, rr_arbiter_ctrl.sv]  # 必须存在于 04-rtl/rr_arbiter/
```

- `implements` 里每条必须存在且属于本模块，④ 门禁还要求它们已 `approved`。
- `files` 里每个文件必须真实存在，否则 hard fail。

## 编码规范

**先读 [standards/coding-standard.md](../standards/coding-standard.md)**。该文件若仍是 placeholder，产物必须显式标注「依赖 placeholder 规范」，门禁会给出 warn。

## 门禁

```bash
python3 tools/sv.py gate 04 --module rr_arbiter            # 真跑
python3 tools/sv.py gate 04 --module rr_arbiter --dry-run  # 只看将要执行的命令
```

- hard fail：模块目录与详设对不上、缺 `module.yaml`、`.f` 里的文件不存在、名实不符（顶层模块名 ≠ 目录名）。
- soft warn（需要工具）：`verilator --lint-only`、`verible-verilog-lint`、格式检查。
- 工具未安装 → skip + 安装提示（见 `docs/setup/toolchain.md`）。

## 完成定义

1. `gate 04` 无 hard fail；
2. lint 告警已清零，或已在 `06-checks/waivers/rr_arbiter.yaml` 里登记且未过期；
3. 顶层端口与 `DES-*` 的端口表逐条一致（人工/评审 skill 核对）。
