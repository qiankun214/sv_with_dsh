# 交接文档 — spec-to-RTL 流程骨架 + rr_arbiter 样例（③ 已放行，待进 ④）

| 项 | 值 |
|---|---|
| 生成日期 | 2026-10-03 |
| 仓库 | `/home/alpaca/sv_with_dsh` ↔ <https://github.com/qiankun214/sv_with_dsh>（public，默认分支 `main`） |
| 上一版交接文档 | 提交 `b92d9e2` 时的内容（2026-09-23，② 进行中）；本文件取代它，旧版仍在 git 历史里 |
| 本次提交 | `e6018bb` —— 阶段②放行 + 阶段③ `DES-rra-001`（含内部时序图与结构回流）；历次改动见 §8 变更记录 |
| 进度 | **① `REQ-001` 已放行**（2026-10-03 按 ③ 反馈返工后重放行）；**② `ARCH-001` 已放行**（2026-10-03）；**③ `DES-rra-001` 已放行**（2026-10-03）；④~⑥ 未开始 |

> 本文件取代上一版交接文档。凡与旧版冲突处，以本版为准。

---

## 1. 一句话现状

流程骨架与工具链早已就绪；`rr_arbiter` 样例已推到 **③ 详细设计放行完毕**：
`REQ-001`（轮询仲裁，含按 ③ 讨论返工的**复位口径**）→ `ARCH-001`（单模块、≤500 行分解，无模块间连接）→
`DES-rra-001`（二进制指针 + 两段掩码优先级编码；**数据通路/控制通路实现概要 + 实现规划 + 端口/内部时序**）。
3 份产物均为 `approved`，`gate 01/02/03` 全绿，`INDEX.md` 已重算。**④ RTL 是下一步**。

## 2. 本轮（2026-10-03）做了什么

### 2.1 产出

| 产物 | 状态 | 说明 |
|---|---|---|
| `01-requirements/REQ-001-rr-arbitration.md` | **`approved`** | 按 ③ 的 `grill-me` 讨论返工：删除接口不变式 `I4`、`F8` 改为「复位只同步复位轮询指针、不强制清零输出」、场景 4 图与文字说明重绘；原 2026-09-23 放行作废后**同日重放行**（reviewer `qiankun214（样例评审）`） |
| `02-architecture/ARCH-001-arb-arch.md` | **`approved`** | 内容未变（单模块 `rr_arbiter`、不拆子模块、无模块间连接、预算口径），本轮由人类放行 |
| `03-design/rr_arbiter/module.yaml` | — | 模块契约：`id_short: rra`、`rtl_toplevel: rr_arbiter`、`implements: [DES-rra-001]`；由 `new module` 生成 |
| `03-design/rr_arbiter/DES-rra-001-arbitration-policy.md` | **`approved`** | **RTL 唯一契约**：端口表（与 REQ 逐条一致）、参数与非法参数行为、数据通路实现概要、控制通路实现概要（不用 FSM + 理由）、实现规划（寄存器 + 全部组合变量清单）、端口时序（引用 REQ）、内部时序（4 图）、复位与初值、边界条件、时序假设、可综合性 |
| `03-design/rr_arbiter/DES-rra-001-arbitration-policy/` | — | 与 md **同名目录**：4 组内部时序图源 `.json` + 渲染 `.svg` + `README.md`（渲染命令与记法） |
| `INDEX.md` | — | `trace` 重算：01/02/03 各 1 份 approved；覆盖矩阵 `REQ-001 → ARCH-001 → DES-rra-001` |

### 2.2 ③ 的关键设计决策（`grill-me` 结论）

1. **结构**：单模块、不拆子模块、**不用 FSM**——每拍都能独立授权，无跨周期相位；唯一时序状态是轮询指针 `ptr_q`。
2. **仲裁**：`ptr_q`（`$clog2(NUM_REQ)` 位，二进制）+ **两段掩码优先级编码**——`mask_lo[k]=(k<ptr_q)`、`req_hi=req_i&~mask_lo`，`req_hi != 0` 取 `idx_hi`，否则回绕取 `idx_lo`。
3. **输出**：`grant_o`/`grant_valid_o` **组合透传**（`REQ-001` 场景 3/5 要求当拍反映）；`req_i` 不打拍。
4. **复位**：**只**同步复位 `ptr_q` 到 0；输出**不被复位门控**（新 `F8`）。
5. **非法参数**：`NUM_REQ<2` 或 `>8` 用 `generate` + `$error` 在 **elaboration 期**拒绝（实测 Verilator 退出码 1、Yosys 报 `ERROR`）。
6. **时序**：端口时序**引用** `REQ-001` 的 5 个场景（不重画）；内部时序 4 图（轮询推进 / 空闲保持 / 复位只复位指针 / 请求逐拍变化）；**不写 ns 预算**，100 MHz 收敛留 ⑥ 综合对照。
7. **实现规划**列全寄存器（`ptr_q`）与组合变量（`mask_lo`/`req_hi`/`idx_hi`/`idx_lo`/`sel_idx`/`wrap_hit`/`ptr_d`/`grant_o`/`grant_valid_o`），④ 的信号名以此为准。

### 2.3 返工留痕（重要）

③ 的 `grill-me` 发现「复位断言期间输出必须为 0」会强制输出组合门控，与「复位只复位指针」的实现口径冲突 →
**停下来回改 `REQ-001`**（约定 #6：内容变更即作废原放行）。同日经历「返工 → 重放行 → 发现场景 4 图一拍错位（同步复位在第一个上升沿即生效）→ 修正图件 → 再次作废 → 按修正后图件重放行」。
两次作废与重签都如实写进了 `REQ-001` 的变更历史。**教训**：同步复位的波形图要把 `rst_n` 的断言/释放沿放在 `clk` 上升沿之前，否则「边沿是否采到复位」有歧义（见 §5）。

### 2.4 本轮固化/回流的文件（写作约定 #7）

| 文件 | 本轮改动 |
|---|---|
| `tools/templates/DES.template.md` | 新增「端口时序」（引用上游）与「内部时序」（WaveDrom 图件）骨架；「数据通路实现概要 / 控制通路实现概要 / 实现规划（寄存器 + 组合变量清单）」三节与列定义；删除旧「状态机」节 |
| `.dsh/skills/spec-to-rtl-design/SKILL.md` | 「完善」判定扩到 12 条（数据通路概要、控制通路概要（尽量 FSM，不用必给理由）、实现规划、时序已规划）；必填内容表、完成定义、禁止项同步 |
| `03-design/README.md` | 「放什么」与「正文该写什么」表更新；新增图件同名目录布局；**修正原示例**（把 `04-rtl/...sv` 写进 ③ `artifacts` 会让 `gate 03` hard fail） |
| `standards/review-checklist.md` | §D 新增 4 条：数据通路概要、控制通路概要、实现规划、时序图（端口引用上游 + 内部时序图件入同名目录） |

`grill-me`（`grilling`）强制讨论的规定此前已在总纲与各阶段技能中；本轮按用户意见**不再额外标注**。

## 3. 当前门禁与追溯状态（诚实清单）

```bash
source .tools/env.sh                 # 不 source 会让 doctor 把 verilator/yosys/verible/cocotb 全判 MISSING
python3 tools/sv.py gate 01          # 通过（0 hard）
python3 tools/sv.py gate 02          # 通过（0 hard）
python3 tools/sv.py gate 03 --module rr_arbiter   # 通过（0 hard）
python3 tools/sv.py trace            # 通过；仅 1 条预期 warn：REQ-001 还没有 TC（⑤ 未开始）
```

`INDEX.md` 现状：01/02/03 各 1 份 `approved`；模块 `rr_arbiter`（短名 `rra`）详设 `DES-rra-001`；`04-rtl/` 与 `05-verification/` 目录已建（`new module` 的预期行为），④⑤ 产物尚未生成。

## 4. 未完成 / 下一步（按顺序）

1. **④ RTL**：按 `DES-rra-001` 写 `04-rtl/rr_arbiter/rr_arbiter.sv`——
   端口逐条对照「端口表」、信号名逐条对照「实现规划」、时序对照「内部时序」4 图；
   顶层模块名 = 目录名 `rr_arbiter`；标注「依赖 placeholder 规范」（`standards/coding-standard.md` 仍是 PLACEHOLDER）；
   `gate 04 --module rr_arbiter`（lint/格式）。④ 没有单独人工关口，其放行体现在 ③ 已 approved。
2. **⑤ 自测**：`VP-rra-001`——先把验收标准从 `REQ-001` 的 `F1~F8`、接口不变式 `I1~I3`、5 个时序场景**扇出成表**，
   再落成 `test_cases` 的 `TC-*`；配 `05-verification/rr_arbiter/{run_tests.py,regress.yaml,tests/}` → `gate 05` → 人类放行。
3. **⑥ 检查**：`CHK-rra-001` + `06-checks/reports/rr_arbiter/{lint,synth,cov}/`，数字与报告一致 → `gate 06` → 人类放行。
4. **收尾**：`trace` 更新 `INDEX.md`，交付摘要列出未执行项与仍为 `draft`/`in_review` 的产物。

### 施工命令速查

```bash
python3 tools/sv.py new rtl --module rr_arbiter --title "轮询仲裁器"
python3 tools/sv.py new vp  --module rr_arbiter --title "验证计划"
python3 tools/sv.py new chk --module rr_arbiter --title "lint 与综合检查"
python3 tools/sv.py gate 04 --module rr_arbiter
python3 tools/sv.py gate all
```

## 5. 已知的坑与风险

| 风险 | 说明 / 应对 |
|---|---|
| **模块骨架时序坑（重要）** | `new module` 会同时创建 `03/04/05` 三处目录；门禁规则「`04-rtl/<m>/` 存在 ⇒ 同模块必须有 approved 的 `DES-*`」。因此在 `DES-*` 放行前 `gate 02`/`gate all` 必然 hard fail。**这是门禁的预期行为**：③ 应一次性走完 `new module → new des → 写 DES → 人类放行 → gate 03` |
| **同步复位波形坑（本轮踩过）** | 同步复位在 `rst_n` 拉低后的**第一个** `clk` 上升沿生效。画 WaveDrom 时要把 `rst_n` 的断言/释放沿放在上升沿**之前**（如 tick 1），否则「边沿是否采到复位」有歧义；重绘场景 4 时曾写成延迟一拍 |
| **`.tools/wdvenv` 不入库** | 换机后必须重建：`python3 -m venv .tools/wdvenv && .tools/wdvenv/bin/pip install wavedrom`（本地把 SVG 转 PNG 自查另装 `cairosvg`） |
| **门禁/doctor 需先 `source .tools/env.sh`** | 该脚本把 `.venv/bin` 与 `.tools/eda/bin` 放到 PATH 最前；否则 verilator/yosys/verible/cocotb 全报 MISSING（实际都在仓库内） |
| **③ 的 `artifacts` 不能写 ④ 才生成的 RTL** | 门禁要求 `artifacts` 路径**此刻存在**；原 `03-design/README.md` 示例写 `04-rtl/...sv` 会让 `gate 03` hard fail，本轮已修正 |
| WaveDrom 三个坑 | ① bit 信号只在电平变化处写值、其余用 `.`；② 图内文字只用 ASCII；③ `head`/`foot` ≤ ~60 字符、`hscale: 1.8` |
| `.vlt` 注释坑（历史） | `06-checks/cfg/verilator.vlt` 的 `//` 注释不能以工具名开头，否则 verilator 当元注释解析、lint 静默失效 |
| verible 同一规则只能一行 | 重复 `+parameter-name-style=` 会互相覆盖并告警；多参数不能逗号合并 |
| **`gate 05` 硬依赖 verilator** | 即使 `regress.yaml` 写 `sim: icarus` 也先检查 verilator 是否存在；纯 icarus 环境会被误判 skip |
| yosys `stat` 输出随版本变 | 解析已兼容新旧两种；换 yosys 版本后复核单元数/面积是否解析到 |
| sky130 liberty 路径随版本变化 | 先按 `PDK_ROOT` 自动 glob，找不到用 `SKY130_LIB` 显式指定 |
| placeholder 编码规范 | `standards/coding-standard.md` 仍是 PLACEHOLDER；④ 产物必须显式标注「依赖 placeholder 规范」 |
| ID 语义 / 索引一致性 | ID 永不复用，作废标 `superseded` + `superseded_by`；每次产物变更后跑 `trace`，`INDEX.md` 的 diff 就是追溯变化证据 |

## 6. 遗留项（第一步留下的）

| 项 | 说明 |
|---|---|
| `slang` 未接线 | `doctor` 里列出，门禁流程从未调用；conda-forge 有包，接入便宜 |
| 公司编码规范 | `standards/coding-standard.md` 仍是 PLACEHOLDER |
| 文档债 | `README.md`、`docs/setup/toolchain.md` 的部分环境事实仍待更新 |
| CI | 按决定不做 |

## 7. 环境事实（2026-10-03 快照）

| 事实 | 值 / 影响 |
|---|---|
| 解释器 | 系统 `python3` 3.12.3；仓库 `.venv`（PyYAML、cocotb 2.1.0）；**所有 `sv.py` 命令用系统 `python3` 即可** |
| EDA 工具 | `.tools/eda/bin`：verilator **5.052**、verible（`verible-verilog-lint/format`）、yosys **0.69**；另有 iverilog 12.0。**需 `source .tools/env.sh` 才在 PATH** |
| 图件工具 | `.tools/wdvenv`（本轮重建）：`wavedrom` + 本地自查用 `cairosvg`；**gitignored** |
| PDK | `PDK_ROOT=.tools/pdk/share/pdk`（sky130A，`sky130_fd_sc_hd`），`doctor` 3/3 ok |
| 忽略目录 | `.tools/`、`.venv/` 均 gitignored；`06-checks/cfg/pdk.env` 不入库 |
| Git | `origin` = `sv_with_dsh.git`，`gh` 已登录 `qiankun214`（`repo` scope），可直接 push |

## 8. 变更记录

| 日期 | 变更 | 提交 |
|---|---|---|
| 2026-09-18 | 第一步交付：骨架 + CLI + 模板 + 技能 + 安装文档 | `3e9ff11` |
| 2026-09-18 | 新增交接文档（上一版） | `043a13e` |
| 2026-09-19 | 工具链接线修复 + `setup.sh` 一键环境构建 | `e131c48` |
| 2026-09-19 | 重写交接文档（工具链就绪 + gate 04/05/06 实跑） | `d3837c6` |
| 2026-09-21 | 修 `setup.sh`（sudo/apt 主路径等） | `d25e831` |
| 2026-09-21 | 第二步启动：`REQ-001` 样例 + `ARCH-001` 草稿；写作约定固化进模板/清单/技能；WaveDrom 图件链与同名目录布局；本交接文档 | `f2395aa` |
| 2026-09-21 | 按评审意见把**验收标准从 ① 扇出到 ⑤**：REQ 只保留 IPO；合同文件同步 | `fe6542d` |
| 2026-09-21 | ②③ 技能改为**强制由 `grill-me` 讨论产出完善文档**，并修掉 ② 技能里会让 `gate 02` hard fail 的建骨架指令 | `8780bd2` |
| 2026-09-23 | **放行 `REQ-001`**（`approved`，样例评审）；① 解锁 ② | `3d12c72` |
| 2026-09-23 | ② `grill-me` 讨论 + `ARCH-001` 重写（单模块、≤500 行、模块间连接为「无」、不抄端口表）；合同文件同步 | `b41112b` |
| 2026-09-23 | 按评审意见去掉 `ARCH-001` 的废话与重复（上游改引用）；新增「文档写作通则」 | `61bbac9` |
| 2026-10-03 | **放行 `ARCH-001`**（`approved`）；② 解锁 ③ | `e6018bb` |
| 2026-10-03 | ③ `grill-me`（5 轮）产出 `DES-rra-001`：二进制指针 + 两段掩码优先级编码、组合透传、不用 FSM、仅同步复位指针、非法参数 elaboration `$error`、端口时序引用上游 + 内部时序 4 图、实现规划清单 | `e6018bb` |
| 2026-10-03 | ③ 讨论触发 **`REQ-001` 复位语义返工**：删 `I4`、`F8` 改为只复位指针、场景 4 重绘并修正一拍错位；两次作废放行、两次重放行 | `e6018bb` |
| 2026-10-03 | **放行 `DES-rra-001`**（`approved`）；③ 解锁 ④；DES 结构与时序规范回流到模板/③技能/`03-design/README.md`/评审清单 §D；本轮交接文档 | `e6018bb`（交接文档随后补提交） |
