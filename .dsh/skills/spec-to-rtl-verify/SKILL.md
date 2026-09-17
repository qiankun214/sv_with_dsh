---
name: spec-to-rtl-verify
description: 阶段⑤代码自测：写验证计划与 cocotb 测试点，跑回归与覆盖率，并通过 gate 05。当用户要写 testbench、cocotb 用例、回归清单、覆盖率分析时使用。
---

# ⑤ 代码自测

产出 `05-verification/<module>/` 下的验证计划、测试点、cocotb 用例与回归配置。
上游是同模块已 approved 的 `DES-*`。目标不是「跑过了」，而是**每个功能点都有测试点，每个测试点都有可执行用例**。

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
2. 功能点覆盖率：每个 `REQ-*` 至少被一个 `TC-*` 覆盖（`trace` 会列出缺口）；
3. 回归全绿，或失败项已 waiver 并说明原因；
4. 覆盖率达标或已 waiver；
5. 向用户请求放行（列出测试点清单、通过率、覆盖率）；放行后写 `status: approved`；
6. `python3 tools/sv.py trace` 更新 `INDEX.md`。
