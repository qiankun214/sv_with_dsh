# ⑤ 代码自测（Verification）

**放什么**：验证计划、测试点、cocotb 测试与回归配置。目标不是「跑过了」，而是「每个功能点都有测试点，每个测试点都有用例且通过」。

## 目录与命名

```
05-verification/
└── rr_arbiter/
    ├── VP-rra-001-verification-plan.md   # 验证计划（含 TC-* 测试点清单）
    ├── regress.yaml                      # TC → cocotb 用例名映射
    ├── run_tests.py                      # 自测入口（gate 05 直接调用它，无 Makefile）
    ├── tb/
    │   └── tb_rr_arbiter.py              # cocotb 测试驱动
    └── tests/
        └── test_rr_arbiter.py            # 用例实现
```

`gate 05` 的契约很简单：**它只执行 `python3 run_tests.py`**（工作目录为本目录），
并要求该脚本把覆盖率写到 `06-checks/reports/<module>/cov/summary.json`：

```json
{ "line_pct": 87.5, "toggle_pct": 64.0 }
```

之所以不让 `sv.py` 直接调 cocotb API，是为了把 cocotb 版本差异隔离在这一层之外。
`run_tests.py` 用 cocotb 2.x 的 runner API（`cocotb_tools.runner.get_runner`）写，见第二步样例。

- 新建：`python3 tools/sv.py new vp --module rr_arbiter --title "验证计划"`
- 测试点不单独建文件，写在 `VP-*` 的 front-matter `test_cases:` 里。

## VP front-matter（必填）

```yaml
---
id: VP-rra-001
title: 轮询仲裁器验证计划
status: draft
owner: agent
reviewer:
date:
upstream: [DES-rra-001, DES-rra-002]     # 同模块的已 approved 详设
artifacts:
  - 05-verification/rr_arbiter/regress.yaml
test_cases:
  - id: TC-rra-001
    covers: [REQ-003]                    # 覆盖哪些功能点（trace 用来算覆盖率）
    desc: 四个请求同时有效时按轮询顺序授权
  - id: TC-rra-002
    covers: [REQ-003]
    desc: 单请求持续有效时不会饿死其它通道
---
```

## regress.yaml

```yaml
module: rr_arbiter
sim: verilator                # cocotb runner 的后端
toplevel: rr_arbiter
tests:
  TC-rra-001: rr_arbiter_basic.test_rr_arbiter_rr_arbiter_001
  TC-rra-002: rr_arbiter_basic.test_rr_arbiter_rr_arbiter_002
coverage:
  line_warn: 80               # soft warn 阈值（百分比）
  toggle_warn: 60
```

`VP-*` 里的每个 `TC-*` 必须在此有同名条目，否则 ⑤ 门禁 **hard fail**。

## 门禁

```bash
python3 tools/sv.py gate 05 --module rr_arbiter
```

- hard fail：`TC-*` 无对应用例、上游详设不存在/未 approved、字段缺失。
- soft warn（需要工具 + 编译器）：cocotb 回归失败、行/翻转覆盖率低于阈值。缺 `cocotb`、缺 `g++`/`make` → skip + 提示。
- **注意**：cocotb + Verilator 需要 `make` 与 C++ 编译器；`verilator --lint-only` 与 Yosys 综合不需要。

## 完成定义

1. `gate 05` 无 hard fail；
2. 回归全绿（或失败项已登记 waiver 并说明原因）；
3. 覆盖率不低于 `regress.yaml` 阈值，或已登记 waiver；
4. `trace` 显示本模块的每个 `DES-*` 至少被一个 `TC-*` 覆盖（覆盖率不足为 soft warn）。
