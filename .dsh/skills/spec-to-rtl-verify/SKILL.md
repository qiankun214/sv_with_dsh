---
name: spec-to-rtl-verify
description: 阶段⑤代码自测：写验证计划与 cocotb 测试点，跑回归与覆盖率，并通过 gate 05。当用户要写 testbench、cocotb 用例、回归清单、覆盖率分析时使用。
---

# ⑤ 代码自测

产出 `05-verification/<module>/` 下的验证计划、测试点、cocotb 用例与回归配置。
上游是同模块已 approved 的 `DES-*`，门禁 `gate 05 --module M`。
目标不是「跑过了」，而是**每个功能点都有测试点，每个测试点都有可执行用例**。

## 1. 验收标准在本阶段扇出（重要）

① 的 `REQ-*` **故意不含验收标准**——`REQ-*` 只有 IPO：输入、处理（`F*`）、输出与边界。
「什么算通过」由本阶段负责，从上游扇出成表，写进 `VP-*`：

| 验收标准 | 来源（REQ 的 F*/接口不变式/时序场景） | 激励 | 观测点 | 量化判据 | 对应 TC-* |
|---|---|---|---|---|---|
| AC-1 | | | | | TC-<short>-001 |

- 来源要逐条可追：`REQ-*` 的每个 `F*`、每条接口不变式、每个时序场景都要有落点；
- 扇出后的每条验收标准必须至少对应一个 `TC-*`；`TC-*` 的 `covers:` 仍指向 `REQ-*`（门禁据此算需求覆盖）；
- 验收标准写「激励 + 观测点 + 量化判据」，不复述 `F*` 的行为描述。

## 2. 写文档前：先 grill-me

动笔前按 `grill-me`（执行 `grilling` 技能）用 `ask_user_question` 卡片与用户把边界、取舍、待定项讨论清楚：
事实自己查（模板/上游产物/门禁规则），推荐项放第一并标「（推荐）」，讨论到无未决问题且用户确认理解一致；
结论写进产物正文与变更历史，规范级结论回流到本技能或模板。详见 `spec-to-rtl` 与 `spec-to-rtl-req`。

## 3. 目录与命名

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

- `VP-<short>-<nnn>-<slug>.md`；测试点不单独建文件，写在 `VP-*` front-matter 的 `test_cases:` 里。
- 新建：`python3 tools/sv.py new vp --module rr_arbiter --title "验证计划"`
- 本目录存在的前提是 `04-rtl/<module>/<module>.f` 已存在（门禁会查）。

## 4. VP front-matter（必填）

```yaml
---
id: VP-rra-001
title: 轮询仲裁器验证计划
status: draft
owner: agent
reviewer:                # approved 时必填（人类）
date:                    # approved 时必填
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

`test_cases` 是 `VP-*` 的额外必填项；每个 `TC-*` 的 `covers:` 必须指向真实存在的 `REQ-*`。

## 5. regress.yaml

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

`VP-*` 里的每个 `TC-*` 必须在此有同名条目，缺一条就是 **hard fail**；反向多出的条目也会被点名。

## 6. run_tests.py：gate 05 的执行契约

`gate 05` 只执行 `python3 run_tests.py`（工作目录为本目录），并要求它把覆盖率写到
`06-checks/reports/<module>/cov/summary.json`：

```json
{ "line_pct": 87.5, "toggle_pct": 64.0 }
```

- 用 cocotb 2.x 的 runner API（`from cocotb_tools.runner import get_runner`）驱动 Verilator；
- 源码取自 `04-rtl/<module>/<module>.f`，顶层为 `<module>`；
- 之所以不让 `sv.py` 直接调 cocotb API，是为了把 cocotb 版本差异隔离在这一层之外。
- 测试点要覆盖详设「边界条件」一节的每一条，而不只是 happy path；断言检查**需求级性质**
  （如「不会饿死」「同一拍只有一个授权」），失败时打印可诊断信息。

## 7. 门禁与自检

```bash
python3 tools/sv.py gate 05 --module rr_arbiter
```

- hard fail：`TC-*` 无对应用例、`regress.yaml` 字段不全、上游详设不存在/未 approved、缺 `run_tests.py`。
- soft warn（需要工具 + 编译器）：cocotb 回归失败、行/翻转覆盖率低于 `06-checks/cfg/thresholds.yaml` 阈值。
- skip：缺 `cocotb`/`verilator`/`make`/`g++` → 明确告知用户「本机未执行」，给出 `docs/setup/toolchain.md` 的安装路径。
- 注意：cocotb + Verilator 需要 `make` 与 C++ 编译器；`verilator --lint-only` 与 Yosys 综合不需要。

## 8. 放行与完成定义

1. `gate 05` 无 hard fail；
2. **验收标准已从 `REQ-*` 的 `F*`/接口不变式/时序场景扇出成表**，每条至少一个 `TC-*`；
3. 功能点覆盖：每个 `REQ-*` 至少被一个 `TC-*` 覆盖（`trace` 会列出缺口）；
4. 回归全绿，或失败项已登记 waiver 并说明原因；
5. 覆盖率达标或已 waiver；
6. 向用户请求放行（列出验收标准表、测试点清单、通过率、覆盖率）；用户确认后写 `status: approved` + `reviewer` + `date`；
7. `python3 tools/sv.py trace` 更新 `INDEX.md`。

## 9. 禁止

- 把「跑过了」当验证完成：没有验收标准扇出、没有 `TC-*` 覆盖边界的回归不算通过。
- 用 `TC-*` 只覆盖 happy path，跳过详设的边界条件。
- 漏写 `regress.yaml` 映射或写错用例名。
- 自称已仿真（当工具缺失被 skip 时）。
- 自行放行（`reviewer` 只能是真实人类）。
