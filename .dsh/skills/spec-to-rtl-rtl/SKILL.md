---
name: spec-to-rtl-rtl
description: 阶段④RTL编写：依据已放行的详细设计写可综合 SystemVerilog，并通过 gate 04（lint/格式）。当用户要写模块 RTL、改端口、修 lint 告警时使用。
---

# ④ RTL 编写

在 `04-rtl/<module>/` 下产出可综合 SystemVerilog。**上游是该模块已 approved 的 `DES-*`**——端口、状态机、边界行为全部来自详设，不允许自由发挥。

## 前置检查

```bash
python3 tools/sv.py gate 03 --module rr_arbiter     # 详设必须无 hard fail 且已放行
head -5 standards/coding-standard.md                # 若含 PLACEHOLDER，产物需标注
```

## 步骤

```bash
python3 tools/sv.py new rtl --module rr_arbiter --title "轮询仲裁器"
```

- 顶层文件与目录同名，顶层模块名 = 目录名（门禁会查 `module <dir>` 是否存在）。
- 子模块用 `<top>_<role>.sv`；被引用者写在 `.f` 前面。
- 新文件要同时登记到 `03-design/<module>/module.yaml` 的 `files`（`new rtl` 会自动做，手工新建则必须自己补）。

编码要求（细节以 `standards/coding-standard.md` 为准）：

1. 只用 `always_ff` / `always_comb`；非阻塞与阻塞赋值不混用；
2. 每个 `always_comb` 先给默认值，禁止推断 latch；
3. 所有端口/信号/参数显式位宽，比较两侧位宽一致，常量带位宽与进制；
4. 同步复位低有效（`rst_n`），异步必须有详设里的理由；
5. 每个模块头部注释写清：功能、时钟域、复位方式、对应的 `DES-*`。

## 自检

```bash
python3 tools/sv.py gate 04 --module rr_arbiter --dry-run   # 先看会跑什么
python3 tools/sv.py gate 04 --module rr_arbiter
```

- hard fail：模块与详设对不上、`.f` 文件缺失、顶层名不符、`module.yaml` 不一致 → 必须修。
- lint / 格式类为 soft warn：修到 0，或在 `06-checks/waivers/rr_arbiter.yaml` 登记**未过期**的 waiver（写明理由、owner、到期日）。
- 工具未安装会 skip：把 skip 项记录下来交给用户，不要声称已 lint 过。

## 完成定义

1. `gate 04` 无 hard fail；
2. 端口与 `DES-*` 端口表逐条一致（数量/方向/位宽/命名）；
3. lint 与格式告警清零或有未过期 waiver；
4. 自查：复位行为、边界条件、位宽截断三处最容易与详设不一致，逐条对照。
