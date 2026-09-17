# ⑥ lint / 综合等检查（Checks）

**放什么**：把「代码质量与可实现性」的证据固化下来——工具配置、豁免登记、工具报告，以及每模块一份汇总产物 `CHK-*`。

## 目录

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
│   └── rr_arbiter/{lint,synth,cov}/   # 工具原始输出（大产物已 gitignore，summary 保留）
└── rr_arbiter/
    └── CHK-rra-001-lint-synth.md      # 汇总证据（入库，带 front-matter）
```

新建汇总：`python3 tools/sv.py new chk --module rr_arbiter --title "lint 与综合检查"`

## 检查内容

| 检查 | 工具 | 强度 | 产物 |
|---|---|---|---|
| 语法/可综合性 lint | `verilator --lint-only` | soft warn | `reports/<m>/lint/` |
| 风格/格式化 | `verible-verilog-lint` / `-format` | soft warn | `reports/<m>/lint/` |
| SV 语义严格检查 | `slang` | soft warn | `reports/<m>/lint/` |
| 综合到网表 + 面积 | `yosys` + sky130 liberty | soft warn | `reports/<m>/synth/` |
| 行/翻转覆盖率 | cocotb + `verilator --coverage` | soft warn | `reports/<m>/cov/` |
| 结构与追溯 | `tools/sv.py` | **hard fail** | `INDEX.md` |

综合需要 PDK：见 [docs/setup/sky130-pdk.md](../docs/setup/sky130-pdk.md)，脚本从 `$PDK_ROOT` 或 `06-checks/cfg/pdk.env` 定位。

## 门禁

```bash
python3 tools/sv.py gate 06 --module rr_arbiter
python3 tools/sv.py gate 06 --module rr_arbiter --strict   # soft warn 也当失败
```

- hard fail：缺 `CHK-*` 汇总、上游 `VP-*` 未 approved、waiver 字段不全或已过期。
- soft warn：lint/综合/覆盖率问题；工具缺失 → skip。

## 豁免（waiver）

```yaml
# 06-checks/waivers/rr_arbiter.yaml
- rule: WIDTH
  scope: 04-rtl/rr_arbiter/rr_arbiter.sv:42
  reason: 该比较仅用于断言，位宽截断无功能影响
  owner: agent
  expires: 2026-03-31        # 过期即 hard fail
```

**结构与追溯断链不允许豁免。**
