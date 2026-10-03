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
| 频率 | 100 MHz（10 ns，`REQ-001` 约束） | **未核验** | 本机无 STA 工具（`sta`/`opensta` 均缺）；尝试用 yosys `ltp` 取逻辑级数做代理也无效，详见「未执行项」 |

`ARCH-001` 定的「综合只按 `NUM_REQ=4`」已遵守；未附其它参数档面积。

## 与上一版的差异

首版（本产物为 `rr_arbiter` 的第一次检查汇总，无上一版可对比）：

| 指标 | 上一版 | 本版 | 变化 |
|---|---|---|---|
| 告警数 | — | 0 | 首版 |
| 面积（cells） | — | 26 | 首版 |
| 覆盖率 | — | line 100.0% / toggle 96.9% | 首版 |

## 未执行项

| 检查 | 原因 | 补跑条件 |
|---|---|---|
| SV 语义（`slang`） | 环境未安装 `slang`（`doctor` 列为 MISSING）；不影响已完成的 verilator/verible 结论 | 装 `slang` 后对其做 lint；本仓库当前未把它接入 `sv.py` |
| 100 MHz 时序核验（STA） | 环境无 `sta` / `opensta`，yosys 综合本身不含时序分析；`DES-rra-001` 把「100 MHz 收敛」托付给 ⑥，本机无法给出数字 | 安装 OpenSTA（+ sky130 liberty）后，对 `06-checks/reports/rr_arbiter/synth/rr_arbiter.netlist.v` 做 STA（时钟 10 ns） |
| 逻辑级数代理（yosys `ltp`） | 已尝试 `ltp -noff`（脚本内）与 `ltp`（手工补跑），在映射到 sky130 的门级网上均只报 `length=0`（路径仅 `clk` / `rst_n`），**无法作为时序代理** | 无有效替代；改为装 STA 后直接读时序报告 |
| 非法参数 elaboration 拒绝 | `NUM_REQ < 2` / `> 8` 属 elaboration 行为，**不可用激励覆盖**（`DES-rra-001` 与 `VP-rra-001` 均已记录，故不作为 `TC-*`） | ④ 静态检查已实测：`verilator -GNUM_REQ=1` 退出码 1、`yosys` 报 `ERROR`；无需重复 |

## 结论与后续

1. **lint / 格式 / 综合 / 覆盖率四项均通过**，无告警、无 waiver；
2. 面积 **26 cells** 满足 `ARCH-001` 的 ≤150 预算，且落在预期区间 25~60 内；
3. **唯一遗留项：时序未核验**（本机无 STA 工具）——已列补跑条件，不影响本版的功能、面积与覆盖率结论；
4. 建议后续：装 OpenSTA 后补做一次 `NUM_REQ=4` 的 STA，并把结果回填本表「频率」行；
   `slang` 语义检查同样待工具到位后补跑。

## 变更历史

| 日期 | 变更 | 影响 |
|---|---|---|
| 2026-10-03 | 初稿：汇总 ④ 的 lint/格式证据、⑤ 的回归与覆盖率、⑥ 的 sky130 综合（26 cells）；列出 4 项未执行项（slang、STA、ltp 代理无效、非法参数不可激励） | 交付结论；未执行项待工具到位后补跑 |
| 2026-10-03 | **人类放行**：`status: approved`，`reviewer: qiankun214（样例评审）`（样例数据，如实标注为样例评审，非真实项目评审记录） | `rr_arbiter` 样例的 ①→⑥ 全链路完成；时序核验仍为遗留项 |
