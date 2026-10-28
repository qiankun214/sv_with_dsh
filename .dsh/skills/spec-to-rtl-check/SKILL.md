---
name: spec-to-rtl-check
description: 阶段⑥检查汇总：跑 lint/格式/综合/覆盖率，把证据固化进 CHK-* 与 reports/，并通过 gate 06。当用户要跑 lint、Yosys sky130 综合、看面积、登记 waiver 时使用。
---

# ⑥ 检查汇总（lint / 综合等）

把「代码质量与可实现性」的证据固化下来：每模块一份 `06-checks/<module>/CHK-<short>-<nnn>-*.md`，
原始输出落 `06-checks/reports/<module>/`。上游是同模块已 approved 的 `VP-*`，门禁 `gate 06 --module M`。

## 1. 写文档前：先 grill-me

动笔前先按 `grill-me`（执行 `grilling` 技能）用 `ask_user_question` 卡片与用户把本阶段的边界、取舍、待定项讨论清楚：
事实自己查（模板/上游产物/门禁规则），推荐项放第一并标「（推荐）」，讨论到无未决问题且用户确认理解一致；
结论写进产物正文与变更历史，规范级结论回流到本技能或模板。详见 `spec-to-rtl` 与 `spec-to-rtl-req`。

## 2. 目录布局

```
06-checks/
├── cfg/
│   ├── verilator.vlt            # lint 规则配置
│   ├── verible.rules            # Verible lint 规则开关
│   ├── synth_sky130.ys          # Yosys + sky130 综合脚本
│   ├── thresholds.yaml          # 覆盖率/面积 soft warn 阈值
│   └── pdk.env.example          # PDK 路径配置样例（复制为 pdk.env，不入库）
├── waivers/
│   ├── project.yaml             # 项目级豁免
│   └── rr_arbiter.yaml          # 模块级豁免
├── reports/
│   └── rr_arbiter/{lint,synth,cov}/   # 工具原始输出（大产物 gitignore，summary 保留）
└── rr_arbiter/
    └── CHK-rra-001-lint-synth.md      # 汇总证据（入库，带 front-matter）
```

新建汇总：`python3 tools/sv.py new chk --module rr_arbiter --title "lint 与综合检查"`

## 3. 检查内容

| 检查 | 工具 | 强度 | 产物 |
|---|---|---|---|
| 语法/可综合性 lint | `verilator --lint-only` | soft warn | `reports/<m>/lint/` |
| 风格/格式化 | `verible-verilog-lint` / `-format` | soft warn | `reports/<m>/lint/` |
| SV 语义严格检查 | `slang` | soft warn | `reports/<m>/lint/` |
| 综合到网表 + 面积 | `yosys` + sky130 liberty | soft warn | `reports/<m>/synth/` |
| 行/翻转覆盖率 | cocotb + `verilator --coverage` | soft warn | `reports/<m>/cov/` |
| 结构与追溯 | `tools/sv.py` | **hard fail** | `INDEX.md` |

## 4. 配置与 PDK

- 规则/阈值：`06-checks/cfg/verilator.vlt`、`verible.rules`、`synth_sky130.ys`、`thresholds.yaml`。
- PDK 定位：`$PDK_ROOT` 或 `06-checks/cfg/pdk.env`（由 `pdk.env.example` 复制，**不入库**）；
  获取与约定见 `docs/setup/sky130-pdk.md`。
- 改 `.vlt` 时注意：`//` 注释不能以工具名开头（否则 verilator 当元注释解析、整份 `.vlt` 失效，lint 静默不跑）。
- `verible` 同一规则只能写一行，重复 `+parameter-name-style=` 会互相覆盖并告警；多参数不能逗号合并。

## 5. 步骤

```bash
python3 tools/sv.py doctor                                   # 工具/PDK 状态先看清楚
python3 tools/sv.py gate 06 --module rr_arbiter              # 跑 lint + 综合
python3 tools/sv.py new chk --module rr_arbiter --title "lint 与综合检查"
```

检查矩阵（soft warn，需要工具）：

| 检查 | 工具 | 产物 |
|---|---|---|
| 语法/可综合性 | `verilator --lint-only` | `reports/<m>/lint/` |
| 风格 | `verible-verilog-lint` / `-format` | `reports/<m>/lint/` |
| SV 语义 | `slang --lint-only` | 同上 |
| 综合到网表 + 面积 | `yosys` + sky130 liberty | `reports/<m>/synth/` |
| 静态时序（WNS/TNS） | `sta`（OpenSTA）+ sky130 liberty | `reports/<m>/sta/` |
| 行/翻转覆盖率 | cocotb + verilator `--coverage` | `reports/<m>/cov/` |

配置与阈值：

- `06-checks/cfg/verilator.vlt`、`verible.rules`、`synth_sky130.ys`、`sta_sky130.tcl`、`thresholds.yaml`
- PDK 定位：`$PDK_ROOT` / `06-checks/cfg/pdk.env`（见 `docs/setup/sky130-pdk.md`）
- OpenSTA 安装：见 `docs/setup/opensta.md`；目标周期由 `thresholds.yaml` 的 `sta.period_ns` 给出

## 6. 写 CHK-* 的纪律

- 表里的每个数字**必须与原始报告一致**，不允许手抄走形；
- 缺项（工具没装、PDK 缺失、被 skip）要在「未执行项」一节逐条写明原因与补跑条件；
- 面积要与 ② 阶段的预算对照，**时序要与 ②/① 的目标频率对照**（WNS ≥ 0 即收敛；推算 Fmax 要写明推导口径）；
- 与上一版对比告警数/面积/时序，说明变化来源。

## 7. waiver 纪律

```yaml
# 06-checks/waivers/rr_arbiter.yaml
- rule: WIDTH
  scope: 04-rtl/rr_arbiter/rr_arbiter.sv:42
  reason: 该比较仅用于断言，位宽截断无功能影响
  owner: agent
  expires: 2026-03-31        # 过期即 hard fail
```

每条必须写全 `rule/scope/reason/owner/expires`。
**结构与追溯断链不允许豁免**——只能修。

## 8. 门禁

```bash
python3 tools/sv.py gate 06 --module rr_arbiter
python3 tools/sv.py gate 06 --module rr_arbiter --strict   # soft warn 也当失败
```

- hard fail：缺 `CHK-*` 汇总、上游 `VP-*` 未 approved、waiver 字段不全或已过期。
- soft warn：lint/综合/覆盖率问题；工具缺失 → skip。

## 9. 放行与完成定义

1. `gate 06` 无 hard fail，且 `CHK-*` 内容与报告一致；
2. lint 告警为 0 或已 waiver；综合成功且面积已与预算对照；**时序有 WNS/TNS（或明确列为未执行项）并与目标频率对照**；
3. 未执行项已明确列出（不要掩盖 skip）；
4. 向用户请求放行（列出结论、面积、未执行项）；用户确认后写 `status: approved` + `reviewer` + `date`；
5. `python3 tools/sv.py trace` 更新 `INDEX.md`。

## 10. 禁止

- 手抄报告数字、或把没跑过的检查写成「已检查」。
- 用 waiver 埋掉结构/追溯问题，或登记一条已过期的豁免。
- 提交波形、网表、`obj_dir` 等大产物。
- 自行放行（`reviewer` 只能是真实人类）。
