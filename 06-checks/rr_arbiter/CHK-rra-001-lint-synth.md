---
id: CHK-rra-001
title: lint 与综合检查
status: approved
owner: agent
reviewer: qiankun214（样例评审）
date: 2026-10-03
upstream: [DES-rra-001, VP-rra-001]
artifacts:
  - 06-checks/reports/rr_arbiter/lint/summary.json
  - 06-checks/reports/rr_arbiter/lint/summary.md
  - 06-checks/reports/rr_arbiter/lint/verible-lint.json
  - 06-checks/reports/rr_arbiter/synth/summary.json
  - 06-checks/reports/rr_arbiter/synth/summary.md
  - 06-checks/reports/rr_arbiter/sta/summary.json
  - 06-checks/reports/rr_arbiter/sta/summary.md
  - 06-checks/reports/rr_arbiter/sta/run.tcl
  - 06-checks/reports/rr_arbiter/cov/summary.json
---

# CHK-rra-001 lint 与综合检查

> 模块：`rr_arbiter`　短名：`rra`　上游：`DES-rra-001` / `VP-rra-001`（均已 approved）

> 本产物汇总质量与可实现性证据。表中数字全部来自下方「原始报告」文件，未手工转抄；
> 缺项（工具缺失/环境限制）在「未执行项」逐条写明，不掩盖 skip。

## 结论摘要

| 检查 | 工具 | 结论 | 关键数字 | 原始报告 |
|---|---|---|---|---|
| 语法/可综合性 lint | verilator --lint-only | 通过 | errors 0 / warnings 0 / waived 0 | `06-checks/reports/rr_arbiter/lint/summary.md` |
| 风格 lint / 格式 | verible-verilog-lint / -format | 通过 | findings 0；`verible-verilog-format` 输出与源文件一致 | `06-checks/reports/rr_arbiter/lint/verible-lint.json` |
| SV 语义 | slang | **未执行（工具缺失）** | — | 见「未执行项」 |
| 综合（sky130） | yosys + sky130_fd_sc_hd | 通过 | cells 26 / area 165.158 | `06-checks/reports/rr_arbiter/synth/summary.md` |
| 静态时序（sky130） | sta（OpenSTA 3.1.0）+ sky130_fd_sc_hd | 通过（MET） | WNS 8.71 ns / TNS 0.00 ns / 推算 Fmax 775.2 MHz @ 10 ns | `06-checks/reports/rr_arbiter/sta/summary.md` |
| 行/翻转覆盖 | cocotb + verilator --coverage | 通过 | line 100.0% / toggle 96.9% | `06-checks/reports/rr_arbiter/cov/summary.json` |

补充证据：cocotb 回归 **8 个 `TC-*` × 5 个参数档（`NUM_REQ=2/3/4/5/8`）= 40/40 通过**，
由 `05-verification/rr_arbiter/run_tests.py` 执行（⑤ 放行结论，见 `VP-rra-001`）。

## 告警与豁免

**无告警**（verilator 0 条、verible 0 条），因此**不登记任何 waiver**；
`06-checks/waivers/` 下没有本模块的豁免文件。

| 规则 | 位置 | 处置（修复/waiver） | waiver 到期 |
|---|---|---|---|
| （无） | — | — | — |

## 与预算的对照

| 指标 | ② 预算（`ARCH-001`） | 本次实测 | 偏差与解释 |
|---|---|---|---|
| 面积（sky130 cells，`NUM_REQ=4`） | ≤ 150（预期 25~60） | **26 cells** | 落在预期区间内、为上限的 17%；口径一致（同为 `NUM_REQ=4`、`sky130_fd_sc_hd__tt_025C_1v80`） |
| 面积（liberty area 单位） | —（② 按 cells 定预算） | 165.158 | 仅记录，不与 cells 预算做换算（口径不同） |
| 频率 | 100 MHz（10 ns，`REQ-001` 约束） | **WNS 8.71 ns @ 10 ns（MET）**，推算 Fmax ≈ **775.2 MHz** | 时序核验通过（OpenSTA + sky130 `tt_025C_1v80`）；建模口径：单时钟、理想时钟网络（无 CTS）、I/O 外部延时 0；Fmax 由 `1000/(周期 − WNS)` 推算，见 `06-checks/cfg/sta_sky130.tcl` |

`ARCH-001` 定的「综合只按 `NUM_REQ=4`」已遵守；未附其它参数档面积。

## 与上一版的差异

首版（本产物为 `rr_arbiter` 的第一次检查汇总，无上一版可对比）：

| 指标 | 上一版 | 本版 | 变化 |
|---|---|---|---|
| 告警数 | — | 0 | 首版 |
| 面积（cells） | — | 26 | 首版 |
| 时序（WNS @ 10 ns） | — | 8.71 ns（MET） | 首版 |
| 覆盖率 | — | line 100.0% / toggle 96.9% | 首版 |

## 未执行项

| 检查 | 原因 | 补跑条件 |
|---|---|---|
| SV 语义（`slang`） | 环境未安装 `slang`（`doctor` 列为 MISSING）；不影响已完成的 verilator/verible 结论 | 装 `slang` 后对其做 lint；本仓库当前未把它接入 `sv.py` |
| 非法参数 elaboration 拒绝 | `NUM_REQ < 2` / `> 8` 属 elaboration 行为，**不可用激励覆盖**（`DES-rra-001` 与 `VP-rra-001` 均已记录，故不作为 `TC-*`） | ④ 静态检查已实测：`verilator -GNUM_REQ=1` 退出码 1、`yosys` 报 `ERROR`；无需重复 |

> 说明：本版起 **时序已执行**（原先的「无 STA 工具」已解决）：OpenSTA 已装到 `.tools/sta/`，
> 并接入 `tools/sv.py gate 06`（`06-checks/cfg/sta_sky130.tcl` + `thresholds.yaml` 的 `sta.*`）。
> 早期尝试的 yosys `ltp` 逻辑级数代理在门级网上只报 `length=0`，已废弃，不再作为时序依据。

## 结论与后续

1. **lint / 格式 / 综合 / 时序 / 覆盖率五项均通过**：无告警（verilator/verible 各 0 条）、无 waiver；
2. 面积 **26 cells** 满足 `ARCH-001` 的 ≤150 预算，且落在预期区间 25~60 内；
3. **时序收敛**：`NUM_REQ=4` 综合网表在 10 ns（100 MHz）下 **WNS 8.71 ns、TNS 0.00 ns**，
   推算 Fmax ≈ **775.2 MHz**（单时钟理想网络、I/O 外部延时 0）；最差路径为 `ptr_q` 寄存器 → 5 级组合 → 自身 D 端；
4. 唯一遗留：`slang` SV 语义检查（工具未安装），已列补跑条件，不影响上述结论。

## 变更历史

| 日期 | 变更 | 影响 |
|---|---|---|
| 2026-10-03 | 初稿：汇总 ④ 的 lint/格式证据、⑤ 的回归与覆盖率、⑥ 的 sky130 综合（26 cells）；列出 4 项未执行项（slang、STA、ltp 代理无效、非法参数不可激励） | 交付结论；未执行项待工具到位后补跑 |
| 2026-10-03 | **人类放行**：`status: approved`，`reviewer: qiankun214（样例评审）`（样例数据，如实标注为样例评审，非真实项目评审记录） | `rr_arbiter` 样例的 ①→⑥ 全链路完成；时序核验当时仍为遗留项 |
| 2026-10-03 | **补齐时序核验**：安装 OpenSTA 3.1.0 到 `.tools/sta/`，并接入 `tools/sv.py gate 06`（新增 `06-checks/cfg/sta_sky130.tcl`、`thresholds.yaml` 的 `sta.*`、`doctor` 的 sta 行、`docs/setup/opensta.md`、`setup.sh` 的 `setup_sta()`；⑥ 技能/CHK 模板/AGENTS §5§6/评审清单 §G 同步）。实测 `NUM_REQ=4` @10 ns：**WNS 8.71 ns、TNS 0.00 ns、推算 Fmax 775.2 MHz**；「未执行项」移除 STA 与 ltp 代理两条。原放行随内容变更作废，`status` 回到 `in_review` | 时序结论可核对；流程 ①→⑥ 完结 |
| 2026-10-03 | **人类重放行**（`status: approved`，`reviewer: qiankun214（样例评审）`）：确认 `NUM_REQ=4` 的时序结论（WNS 8.71 ns / TNS 0.00 ns / 推算 Fmax 775.2 MHz）与建模口径 | 本版为 `rr_arbiter` 样例 ①→⑥ 的最终检查结论 |
