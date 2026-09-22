---
name: spec-to-rtl-verify
description: 阶段⑤代码自测：写验证计划与 cocotb 测试点，跑回归与覆盖率，并通过 gate 05。当用户要写 testbench、cocotb 用例、回归清单、覆盖率分析时使用。
---

# ⑤ 代码自测

产出 `05-verification/<module>/` 下的验证计划、测试点、cocotb 用例与回归配置。
上游是同模块已 approved 的 `DES-*`。目标不是「跑过了」，而是**每个功能点都有测试点，每个测试点都有可执行用例**。

## 验收标准在本阶段扇出（重要）

① 的 `REQ-*` **故意不含验收标准**——`REQ-*` 只有 IPO：输入、处理（`F*`）、输出与边界。
「什么算通过」由本阶段负责，从上游扇出成表，写进 `VP-*`：

| 验收标准 | 来源（REQ 的 F*/接口不变式/时序场景） | 激励 | 观测点 | 量化判据 | 对应 TC-* |
|---|---|---|---|---|---|
| AC-1 | | | | | TC-<short>-001 |

- 来源要逐条可追：`REQ-*` 的每个 `F*`、每条接口不变式、每个时序场景都要有落点；
- 扇出后的每条验收标准必须至少对应一个 `TC-*`；`TC-*` 的 `covers:` 仍指向 `REQ-*`（门禁据此算需求覆盖）；
- 验收标准写「激励 + 观测点 + 量化判据」，不复述 `F*` 的行为描述。

## 写文档前：先调用 `grill-me` 讨论

动笔前先按 `grill-me`（执行 `grilling` 技能）用 `ask_user_question` 卡片与用户把本阶段的边界、取舍、待定项讨论清楚：
事实自己查（模板/上游产物/门禁规则），推荐项放第一并标「（推荐）」，讨论到无未决问题且用户确认理解一致；
结论写进产物正文与变更历史，规范级结论回流到本技能或模板。详见 `spec-to-rtl` 与 `spec-to-rtl-req`。

## 步骤

```bash
python3 tools/sv.py new vp --module rr_arbiter --title "轮询仲裁器验证计划"
```

1. 在 `VP-rra-001-*.md` 的 front-matter 里写测试点（`TC-*`），每个必须声明 `covers:` 指向功能点：

   ```yaml
   test_cases:
     - id: TC-rra-001
       covers: [REQ-003]
       desc: 四个请求同时有效时按轮询顺序授权
   ```

2. 在 `regress.yaml` 里为**每个** `TC-*` 写同名用例映射（缺一条就是 hard fail）：

   ```yaml
   tests:
     TC-rra-001: rr_arbiter_basic.test_rr_arbiter_rr_arbiter_001
   ```

3. 写 `run_tests.py`——`gate 05` 的执行契约就是它：

   - 用 cocotb 2.x 的 runner API（`from cocotb_tools.runner import get_runner`）驱动 Verilator；
   - 源码取自 `04-rtl/<module>/<module>.f`，顶层为 `<module>`；
   - 结束时把覆盖率写到 `06-checks/reports/<module>/cov/summary.json`：`{"line_pct": …, "toggle_pct": …}`。

4. 用例要覆盖详设「边界条件」一节的每一条，而不只是 happy path；断言检查**需求级性质**（如「不会饿死」「同一拍只有一个授权」），断言失败要打印可诊断信息。

## 自检

```bash
python3 tools/sv.py gate 05 --module rr_arbiter
```

- hard fail：`TC-*` 缺用例、`regress.yaml` 字段不全、上游详设未放行、缺 `run_tests.py`。
- soft warn：回归失败、行/翻转覆盖率低于 `06-checks/cfg/thresholds.yaml` 阈值。
- skip：缺 `cocotb`/`verilator`/`make`/`g++` → 明确告知用户「本机未执行」，给出 `docs/setup/toolchain.md` 的安装路径。

## 完成定义

1. `gate 05` 无 hard fail；
2. **验收标准已从 `REQ-*` 的 `F*`/接口不变式/时序场景扇出成表**，每条至少一个 `TC-*`；
3. 功能点覆盖率：每个 `REQ-*` 至少被一个 `TC-*` 覆盖（`trace` 会列出缺口）；
4. 回归全绿，或失败项已 waiver 并说明原因；
5. 覆盖率达标或已 waiver；
6. 向用户请求放行（列出验收标准表、测试点清单、通过率、覆盖率）；放行后写 `status: approved`；
7. `python3 tools/sv.py trace` 更新 `INDEX.md`。
