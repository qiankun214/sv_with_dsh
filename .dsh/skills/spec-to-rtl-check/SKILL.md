---
name: spec-to-rtl-check
description: 阶段⑥检查汇总：跑 lint/格式/综合/覆盖率，把证据固化进 CHK-* 与 reports/，并通过 gate 06。当用户要跑 lint、Yosys sky130 综合、看面积、登记 waiver 时使用。
---

# ⑥ lint / 综合等检查

把「代码质量与可实现性」的证据固化下来：`06-checks/<module>/CHK-<short>-<nnn>-*.md` + `06-checks/reports/<module>/`。
上游是同模块已 approved 的 `VP-*`。

## 步骤

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
| SV 语义 | `slang` | 同上 |
| 综合到网表 + 面积 | `yosys` + sky130 liberty | `reports/<m>/synth/` |
| 行/翻转覆盖率 | cocotb + verilator `--coverage` | `reports/<m>/cov/` |

配置与阈值：

- `06-checks/cfg/verilator.vlt`、`verible.rules`、`synth_sky130.ys`、`thresholds.yaml`
- PDK 定位：`$PDK_ROOT` / `06-checks/cfg/pdk.env`（见 `docs/setup/sky130-pdk.md`）

## 写 CHK-* 的纪律

- 表里的每个数字**必须与原始报告一致**，不允许手抄走形；
- 缺项（工具没装、PDK 缺失、被 skip）要在「未执行项」一节逐条写明原因与补跑条件；
- 面积要与 ② 阶段的预算对照，偏差要解释；
- 与上一版对比告警数/面积，说明变化来源。

## waiver 纪律

```yaml
# 06-checks/waivers/rr_arbiter.yaml
- rule: WIDTH
  scope: 04-rtl/rr_arbiter/rr_arbiter.sv:42
  reason: 该比较仅用于断言，位宽截断无功能影响
  owner: agent
  expires: 2026-03-31
```

**过期即 hard fail**；每条必须写全 `rule/scope/reason/owner/expires`。
**结构与追溯断链不允许豁免**——只能修。

## 完成定义

1. `gate 06` 无 hard fail，且 `CHK-*` 内容与报告一致；
2. lint 告警为 0 或已 waiver；综合成功且面积已与预算对照；
3. 未执行项已明确列出（不要掩盖 skip）；
4. 向用户请求放行（列出结论、面积、未执行项）；放行后写 `status: approved`；
5. `python3 tools/sv.py trace` 更新 `INDEX.md`。
