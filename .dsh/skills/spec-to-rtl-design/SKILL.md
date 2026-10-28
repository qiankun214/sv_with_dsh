---
name: spec-to-rtl-design
description: 阶段③详细设计：把系统方案细化到可据以写 RTL 的程度，产出 DES-*/REGMAP-*/IFACE-* 并通过 gate 03。当用户要写模块详设、端口表、状态机、寄存器表、接口时序时使用。
---

# ③ 详细设计

产出 `03-design/<module>/` 下的模块契约与实现级设计：`module.yaml` + `DES-<short>-<nnn>-<slug>.md`
（按需加 `REGMAP-*` 寄存器表、`IFACE-*` 接口时序）。上游是**已 approved** 的 `ARCH-*`，门禁 `gate 03 --module M`。

**这是 RTL 的唯一契约**：RTL 阶段不允许写详设里没有的端口或行为。

## 1. 文档必须由 grill-me 讨论产出（强制）

**不允许「先写完再评审」**：先用 `grill-me`（执行 `grilling` 技能）与用户逐轮质询式讨论，把设计问到完善，
再落成 `DES-*`（以及 `REGMAP-*`/`IFACE-*`）。讨论是产出文档的**必经过程**。

- **事实自己查**：模板、上游 `ARCH-*`/`REQ-*`、`03-design/<module>/module.yaml`、`standards/coding-standard.md`、
  `tools/sv.py` 规则、已有详设——能查到的不要拿去问用户；已定决策涉及的文档要重读，发现矛盾先报告；
- **每轮一次 `ask_user_question`**：决策点做成卡片（稳定 `id` + 短 `header`，推荐项放第一并标「（推荐）」+ 一句取舍说明），
  用户也可以直接写答案；不要用散文复述选项，也不要一次抛一堆散问题；
- 讨论到**没有未决问题、每一节都能落下确定内容**为止。

**「完善」的判定（缺一不可）**：

1. 正文没有任何 `TODO` / `<占位>` / 「实现时再定」「视情况而定」式表述；
2. 端口表**逐条齐全**（方向、位宽、时钟域、复位值、含义），且与 ① 的端口表、② 的接口协议**逐条一致**；
3. 参数有默认值 + 合法范围 + **非法参数的行为**；
4. **数据通路实现概要**：实现步骤清楚（选路/运算/编码），位宽推导无隐式截断，溢出/饱和/对齐策略明确，关键组合路径写明；
5. **控制通路实现概要**：复位/使能/输出有效/状态推进的条件与动作逐条写出；**尽量采用状态机设计**——用 FSM 就给完备、互斥、无死状态的转移表，不用 FSM 必须写明理由（死状态不被读取、上游要求组合透传或当拍推进等），不得用「不适用」搪塞；
6. **实现规划**：寄存器清单与**全部**组合变量（含中间信号）逐条列出位宽/复位值/含义/驱动来源/被谁使用；④ 的 RTL 信号名必须与清单一致；
7. **时序已规划**：端口时序**引用**上游 `REQ-*`（给出「事件 → 上游场景」对应表，不重画）；**内部时序**用 WaveDrom 画端口 + 主要内部信号，覆盖关键场景（连续请求推进、空闲保持、复位、请求变化），图源 `.json` 与渲染 `.svg` 放与本产物同名的目录并**两件都计入 `artifacts`**；
8. 边界条件逐条给策略（空/满、同时请求、背压、非法输入、参数取极值），不是「视情况而定」；
9. 命名与信号后缀符合 `standards/coding-standard.md`（`_i/_o/_q/_d/_n` 等），可综合子集不冲突；
10. 用到的 SV 结构在 Yosys + sky130 下可映射（阵列/存储器要写明是否退化为触发器及其代价）；
11. `module.yaml` 的 `implements` 覆盖本模块**全部** `DES-*`/`REGMAP-*`/`IFACE-*`，`id_short` 与目录名契约一致；
12. 用户逐节确认过，并明确同意放行。

结论写进产物正文与变更历史；**不把问答过程抄进产物**。规范级结论必须回流到本技能或模板。

## 2. 目录与命名

```
03-design/
├── rr_arbiter/
│   ├── module.yaml                        # 模块契约（唯一身份来源）
│   ├── DES-rra-001-arbitration-policy.md  # 详设
│   ├── DES-rra-002-fsm.md
│   ├── REGMAP-rra-001-registers.md        # 专项：寄存器表（REGMAP.template.md）
│   └── IFACE-rra-001-port-timing.md       # 专项：接口/时序（IFACE.template.md）
└── dma/
    ├── module.yaml
    └── DES-dma-001-burst-split.md
```

- 目录名 = ② 里的 module 名 = `04-rtl/<module>/` 目录名 = 顶层模块名。
- ID 用短名：`DES-rra-001`、`REGMAP-rra-001`、`IFACE-rra-001`（与 `DES-*` 同阶段同上游）。
- 文件名 = `ID + kebab 短描述`。

## 3. module.yaml：唯一模块契约

```yaml
module: rr_arbiter
id_short: rra          # 小写字母开头，2–8 位 [a-z0-9_]；全仓唯一；DES/VP/TC/CHK 的 ID 都用它
owner: agent
rtl_toplevel: rr_arbiter
implements: [DES-rra-001, DES-rra-002]     # 由 `sv.py new des/regmap/iface` 自动追加
files: [rr_arbiter.sv, rr_arbiter_ctrl.sv] # 由 ④ 阶段维护，必须存在于 04-rtl/<module>/
```

- `implements` 里每条必须存在且属于本模块，④ 门禁还要求它们已 `approved`。
- `files` 每个文件必须真实存在，否则 hard fail。
- `04-rtl/` 与 `05-verification/` **不重复声明**模块身份，避免两处漂移。

## 4. 步骤（含骨架时序坑）

```bash
# 模块骨架与详设一起建（new module 会同时创建 03/04/05 三处目录）
python3 tools/sv.py new module rr_arbiter --short rra
python3 tools/sv.py new des    --module rr_arbiter --title "仲裁策略"
python3 tools/sv.py new regmap --module rr_arbiter --title "控制寄存器"   # 按需
python3 tools/sv.py new iface  --module rr_arbiter --title "端口时序"     # 按需
```

`new module` 会建 `04-rtl/<module>/`，而门禁要求「`04-rtl/<module>/` 存在 ⇒ 同模块必须有 approved 的 `DES-*`」。
因此**本阶段要一次性走完**：建骨架 → 写详设 → 人类放行；中途 `gate 03`/`gate all` 报 hard fail 属预期，
不要用 waiver 掩盖，也不要提前跑 `gate all` 下结论。

`new des/regmap/iface` 会自动把新 ID 追加到 `module.yaml` 的 `implements`，不要手改漏掉。

## 5. front-matter（必填）

```yaml
---
id: DES-rra-001
title: 轮询仲裁策略
status: draft
owner: agent
reviewer:                # approved 时必填（人类）
date:                    # approved 时必填
upstream: [ARCH-001]     # 必须指向已 approved 的 ARCH
artifacts:
  - 04-rtl/rr_arbiter/rr_arbiter.sv
---
```

## 6. 正文该写什么

| 小节 | 判断标准 |
|---|---|
| 端口表 | 方向/位宽/时钟域/复位值/含义，逐条齐全；RTL 端口将逐条对照此表 |
| 端口时序 | **引用**上游 `REQ-*` 的场景（事件 → 上游场景对应表），不重画端口波形 |
| 参数 | 默认值 + 合法范围 + 非法参数行为 |
| 数据通路实现概要 | 实现步骤（选路/运算/编码）+ 位宽推导（无隐式截断、溢出/饱和/对齐）+ 关键组合路径 |
| 控制通路实现概要 | 复位/使能/输出有效/状态推进的条件与动作；尽量用 FSM（状态列表 + 转移表：条件/次态/输出动作，完备互斥无死状态），不用 FSM 必须写明理由 |
| 实现规划 | 寄存器清单 + 全部组合变量清单，逐条给位宽/复位值/含义/驱动来源/被谁使用；RTL 信号名以此为准 |
| 内部时序 | WaveDrom 画端口 + 主要内部信号，覆盖关键场景；`.json`+`.svg` 入同名目录并计入 `artifacts` |
| 复位与初值 | 每个寄存器的复位值；同步/异步选择的理由 |
| 边界条件 | 空/满、同时请求、背压、非法输入、参数取极值，逐条给策略 |
| 时序假设 | 是否流水 + 目标频率 + 组合路径预算口径 + 对上游的时序要求 |
| 可综合性 | 用到的 SV 结构能否被 Yosys + sky130 映射；阵列是否退化为触发器 |
| 变更历史 | 每次内容变更都留痕（改了什么、为什么、影响谁） |

先读 `standards/coding-standard.md`，端口与信号命名必须与其后缀约定一致（`_i/_o/_q/_d/_n`）。

专项产物按需补：`REGMAP-*`（寄存器表：地址/位域/属性/复位值/读写行为）用 `REGMAP.template.md`；
`IFACE-*`（接口/时序：握手、采样沿、时序图）用 `IFACE.template.md`。它们与 `DES-*` 同阶段同上游，一样入 `implements`。

## 7. 门禁与自检

```bash
python3 tools/sv.py gate 03 --module rr_arbiter
```

- hard fail：上游 `ARCH-*` 不存在/未 approved；`module.yaml` 缺失或 `id_short` 与 ID 不匹配；ID 非法或重复。
- warn：本阶段暂无产物。

## 8. 放行与完成定义

1. **已通过 `grill-me` 讨论**，且达到 §1 的「完善」判定；
2. `gate 03` 无 hard fail（含 `id_short` 一致性、`implements` 完整性）；
3. 端口表 + 实现规划（寄存器/组合变量清单）足以让另一个人写出 RTL，无需再问；
4. 边界条件逐条有策略（不是「视情况而定」）；
5. 向用户请求放行；放行后写 `status: approved` + `reviewer` + `date`；
6. `python3 tools/sv.py trace` 更新 `INDEX.md`。

**`04-rtl/<module>/` 只有在同模块已有 approved 详设时才允许通过 ④ 门禁。** 返工即作废原放行。

## 9. 禁止

- 跳过 `grill-me` 讨论直接写文档，或把 `TODO`/「实现时再定」留在正文里当交付。
- 控制通路只写「不适用」/「无」而不给条件动作与理由，或实现规划漏列组合变量（只列端口）。
- 在详设里留未定的端口或行为——那就还没设计完。
- 未经详设确认就改端口（RTL 阶段发现端口不对，要回到本阶段改详设并重新放行）。
- 自行放行（`reviewer` 只能是真实人类）。
