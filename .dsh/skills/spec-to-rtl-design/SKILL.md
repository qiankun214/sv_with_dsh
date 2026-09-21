---
name: spec-to-rtl-design
description: 阶段③详细设计：把系统方案细化到可据以写 RTL 的程度，产出 DES-*/REGMAP-*/IFACE-* 并通过 gate 03。当用户要写模块详设、端口表、状态机、寄存器表、接口时序时使用。
---

# ③ 详细设计

产出 `03-design/<module>/DES-<short>-<nnn>-<slug>.md`（按需加 `REGMAP-*` 寄存器表、`IFACE-*` 接口时序）。
上游必须是**已 approved** 的 `ARCH-*`。**这是 RTL 的唯一契约**：RTL 阶段不允许写详设里没有的端口或行为。

## 写文档前：先调用 `grill-me` 讨论

动笔前先按 `grill-me`（执行 `grilling` 技能）用 `ask_user_question` 卡片与用户把本阶段的边界、取舍、待定项讨论清楚：
事实自己查（模板/上游产物/门禁规则），推荐项放第一并标「（推荐）」，讨论到无未决问题且用户确认理解一致；
结论写进产物正文与变更历史，规范级结论回流到本技能或模板。详见 `spec-to-rtl` 与 `spec-to-rtl-req`。

## 步骤

```bash
python3 tools/sv.py new des   --module rr_arbiter --title "仲裁策略"
python3 tools/sv.py new regmap --module rr_arbiter --title "控制寄存器"
python3 tools/sv.py new iface  --module rr_arbiter --title "端口时序"
```

`new des/regmap/iface` 会自动把新 ID 追加到 `module.yaml` 的 `implements`，不要手改漏掉。

必填内容与判断标准：

| 小节 | 判断标准 |
|---|---|
| 端口表 | 方向/位宽/时钟域/复位值/含义，逐条齐全；RTL 端口将逐条对照此表 |
| 参数 | 默认值 + 合法范围 + 非法参数行为 |
| 状态机 | 状态列表 + 转移表（条件/次态/输出动作），覆盖完备且互斥，无死状态 |
| 数据通路 | 位宽推导、溢出/饱和策略、流水级划分 |
| 复位与初值 | 每个寄存器的复位值；同步/异步选择的理由 |
| 边界条件 | 空/满、同时请求、背压、非法输入、参数取极值，逐条给策略 |
| 可综合性 | 用到的 SV 结构能否被 Yosys + sky130 映射；阵列是否退化为触发器 |

先读 `standards/coding-standard.md`，端口与信号命名必须与其后缀约定一致（`_i/_o/_q/_d/_n`）。

## 自检

```bash
python3 tools/sv.py gate 03 --module rr_arbiter
```

## 完成定义

1. `gate 03` 无 hard fail（含 `id_short` 一致性、`implements` 完整性）；
2. 端口表足以让另一个人写出 RTL 接口，无需再问；
3. 边界条件逐条有策略（不是「视情况而定」）；
4. 向用户请求放行；放行后写 `status: approved` + `reviewer` + `date`；
5. `python3 tools/sv.py trace` 更新 `INDEX.md`。

## 禁止

- 在详设里留「实现时再定」的端口或行为——那就还没设计完。
- 未经详设确认就改端口（RTL 阶段发现端口不对，要回到本阶段改详设并重新放行）。
