---
name: spec-to-rtl-design
description: 阶段③详细设计：把系统方案细化到可据以写 RTL 的程度，产出 DES-*/REGMAP-*/IFACE-* 并通过 gate 03。当用户要写模块详设、端口表、状态机、寄存器表、接口时序时使用。
---

# ③ 详细设计

产出 `03-design/<module>/DES-<short>-<nnn>-<slug>.md`（按需加 `REGMAP-*` 寄存器表、`IFACE-*` 接口时序）。
上游必须是**已 approved** 的 `ARCH-*`。**这是 RTL 的唯一契约**：RTL 阶段不允许写详设里没有的端口或行为。

## 文档必须由 `grill-me` 讨论产出（强制）

**本阶段文档不允许「先写完再评审」**：必须先用 `grill-me`（执行 `grilling` 技能）与用户逐轮质询式讨论，
把设计问到完善，再落成 `DES-*`（以及 `REGMAP-*`/`IFACE-*`）。讨论是产出文档的**必经过程**，不是可选项。

- **事实自己查**：模板、上游 `ARCH-*`/`REQ-*`、`03-design/<module>/module.yaml`、`standards/coding-standard.md`、
  `tools/sv.py` 规则、已有详设——能查到的不要拿去问用户；已定决策涉及的文档要重读，发现矛盾先报告；
- **每轮一次 `ask_user_question`**：把该轮决策点做成卡片（稳定 `id` + 短 `header`，推荐项放第一并标「（推荐）」+ 一句取舍说明），
  用户也可以直接写自己的答案；不要用散文复述选项，也不要一次抛一堆散问题；
- 讨论到**没有未决问题、每一节都能落下确定内容**为止。

**「完善」的判定（缺一不可）**：

1. 正文没有任何 `TODO` / `<占位>` / 「实现时再定」「视情况而定」式的表述；
2. 端口表**逐条齐全**（方向、位宽、时钟域、复位值、含义），且与 ① 的端口表、② 的接口协议**逐条一致**；
3. 参数有默认值 + 合法范围 + **非法参数的行为**；
4. 时序逻辑：每个寄存器有复位值与同步/异步选择的理由；用 FSM 就给完备互斥无死状态的转移表，不用就写明理由；
5. 数据通路：位宽推导无隐式截断，溢出/饱和/对齐策略明确；
6. 边界条件逐条给策略（空/满、同时请求、背压、非法输入、参数取极值），不是「视情况而定」；
7. 命名与信号后缀符合 `standards/coding-standard.md`（`_i/_o/_q/_d/_n` 等），可综合子集不冲突；
8. 用到的 SV 结构在 Yosys + sky130 下可映射（阵列/存储器要写明是否退化为触发器及其代价）；
9. `module.yaml` 的 `implements` 覆盖本模块**全部** `DES-*`/`REGMAP-*`/`IFACE-*`，`id_short` 与目录名契约一致；
10. 用户逐节确认过，并明确同意放行。

结论写进产物正文与变更历史；**不要把问答过程抄进产物**。讨论中形成的规范级结论必须回流到本技能或模板。

## 步骤

```bash
# 模块骨架与详设一起建（new module 会同时创建 03/04/05 三处目录）
python3 tools/sv.py new module rr_arbiter --short rra
python3 tools/sv.py new des    --module rr_arbiter --title "仲裁策略"
python3 tools/sv.py new regmap --module rr_arbiter --title "控制寄存器"   # 按需
python3 tools/sv.py new iface  --module rr_arbiter --title "端口时序"     # 按需
```

`new module` 会建 `04-rtl/<module>/`，而门禁要求「`04-rtl/<module>/` 存在 ⇒ 同模块必须有 approved 的 `DES-*`」。
因此**本阶段要一次性走完**：建骨架 → 写详设 → 人类放行；中途 `gate 03`/`gate all` 报 hard fail 属预期。

`new des/regmap/iface` 会自动把新 ID 追加到 `module.yaml` 的 `implements`，不要手改漏掉。

必填内容与判断标准：

| 小节 | 判断标准 |
|---|---|
| 端口表 | 方向/位宽/时钟域/复位值/含义，逐条齐全；RTL 端口将逐条对照此表 |
| 参数 | 默认值 + 合法范围 + 非法参数行为 |
| 状态机 | 状态列表 + 转移表（条件/次态/输出动作），覆盖完备且互斥，无死状态；不用 FSM 要写理由 |
| 数据通路 | 位宽推导、溢出/饱和策略、流水级划分 |
| 复位与初值 | 每个寄存器的复位值；同步/异步选择的理由 |
| 边界条件 | 空/满、同时请求、背压、非法输入、参数取极值，逐条给策略 |
| 时序假设 | 关键路径预算、是否需要流水、对上游的时序要求 |
| 可综合性 | 用到的 SV 结构能否被 Yosys + sky130 映射；阵列是否退化为触发器 |
| 变更历史 | 每次内容变更都留痕（改了什么、为什么、影响谁） |

先读 `standards/coding-standard.md`，端口与信号命名必须与其后缀约定一致（`_i/_o/_q/_d/_n`）。

## 自检

```bash
python3 tools/sv.py gate 03 --module rr_arbiter
```

## 完成定义

1. **已通过 `grill-me` 讨论**，且达到上面的「完善」判定（无 TODO/占位，端口/参数/边界/复位逐条有确定答案）；
2. `gate 03` 无 hard fail（含 `id_short` 一致性、`implements` 完整性）；
3. 端口表足以让另一个人写出 RTL 接口，无需再问；
4. 边界条件逐条有策略（不是「视情况而定」）；
5. 向用户请求放行；放行后写 `status: approved` + `reviewer` + `date`；
6. `python3 tools/sv.py trace` 更新 `INDEX.md`。

## 禁止

- 跳过 `grill-me` 讨论直接写文档，或把 `TODO`/「实现时再定」留在正文里当交付。
- 在详设里留未定的端口或行为——那就还没设计完。
- 未经详设确认就改端口（RTL 阶段发现端口不对，要回到本阶段改详设并重新放行）。
- 自行放行（`reviewer` 只能是真实人类）。
