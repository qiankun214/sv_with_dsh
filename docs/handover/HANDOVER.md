# 交接文档 — spec-to-RTL 流程骨架 + rr_arbiter 样例（阶段①进行中）

| 项 | 值 |
|---|---|
| 生成日期 | 2026-09-21 |
| 仓库 | `/home/alpaca/sv` ↔ <https://github.com/qiankun214/sv_with_dsh>（public，默认分支 `main`） |
| 上一版交接文档 | 提交 `d3837c6`（2026-09-19）的内容；本文件取代它，旧版仍在 git 历史里 |
| 本次提交 | 见 `git log docs/handover/`（本轮提交信息：`REQ-001 样例 + 写作约定固化 + 交接文档`） |
| 进度 | **第二步进行中**：`REQ-001` 已完稿并返工 5 轮，当前 **`status: in_review`（人类尚未放行）**；`ARCH-001` 已成稿但被 REQ 未放行阻塞；③~⑥ 未开始 |

> 本文件取代上一版交接文档。凡与旧版冲突处，以本版为准。

---

## 1. 一句话现状

流程骨架与工具链（第一步）早已就绪；本轮开始第二步，写完了 **`rr_arbiter` 样例的功能点 `REQ-001`**
（含软硬件接口、硬件接口三段式、5 张 WaveDrom 时序图、AC 判据表），并把评审过程中形成的**写作约定固化进了模板与技能**。
**REQ-001 尚未放行**，因此 ② 及其之后的产物都停在门口。

## 2. 本轮（2026-09-21）做了什么

### 2.1 产出

| 产物 | 状态 | 说明 |
|---|---|---|
| `01-requirements/REQ-001-rr-arbitration.md` | `in_review` | 轮询仲裁功能点：F1~F8、软硬件接口、硬件接口三段式、AC-1~AC-8 判据表 |
| `01-requirements/REQ-001-rr-arbitration/` | — | 与 md **同名目录**：5 组 WaveDrom 图源 `.json` + 渲染 `.svg` + `README.md` |
| `02-architecture/ARCH-001-arb-arch.md` | `draft` | 仲裁器系统方案：单模块 `rr_arbiter`、组合授权 + 指针寄存器、面积预算 ≤150 cells |
| `docs/diagrams/arch-001-rr-arbiter.md` | — | ARCH-001 的框图（Mermaid + ASCII），**布局尚未按「图伴 md」规则统一**（见 §4） |

### 2.2 固化下来的写作约定（本轮评审沉淀，已写进技能与模板）

1. **REQ 章节顺序固定**：背景与目标 → 功能描述（`F*`）→ 软硬件接口 → 硬件接口 → 约束 → 验收标准（AC 判据表）→ non-goals → 变更历史。
2. **软硬件接口先给结论**：本模块无软件接口 → **一句结论** + 软件的唯一影响（综合期参数）+「要加须另立 `REQ-*`」边界，**不列全「无」的表**；**有**软件接口才详细描述（寄存器/总线/中断/地址空间/访问属性 + `REGMAP-*`）。
3. **硬件接口三段式**（顺序不可变）：
   - ① **参数表**：默认值 / 合法范围 / 含义；
   - ② **接口信息**：表头固定 `端口 | 方向 | 位宽 | 时钟域 | 复位值 | 含义`；**用到结构体**时另加「成员 / 位宽 / 功能」表；
   - ③ **接口协议**：**只写接口**——输入侧 / 输出侧 / 握手与流控 / 复位 / 时钟 + 可断言的接口不变式。
     **不得**写内部实现与功能映射（状态机、指针/计数器、算法、公平性推导、「给什么输入出什么输出」），
     **不得**写组合路径延迟数字（如 `≤5 ns`）；场景小标题内容固定 = **WaveDrom 图 + 文字说明**（需要时加**只列端口信号**的逐拍表）。
4. **时序图只画端口信号**，不含内部状态；图源 `.json` 与渲染产物 `.svg` 都放 `<阶段>/<产物文件名去扩展名>/`（与 md **同名、同级**的目录），一个场景一对同名文件，两件都入 `artifacts`。
5. **F 与 AC 分工**：`F*` 是行为契约，`AC-*` 是可观测判据（表格：覆盖哪个 F / 激励 / 观测点 / 量化判据），**AC 不复述 F**。
6. **返工留痕**：内容变更即作废原放行（`approved` → `in_review`，清空 `reviewer`），变更历史写清改了什么、为什么、影响谁。
7. **写文档前先 `grill-me`**：任何阶段文档动笔前，先用 `grill-me`（执行 `grilling` 技能）以 `ask_user_question` 卡片与用户做质询式讨论；事实自己查，结论写进产物，规范级结论回流技能/模板。

### 2.3 约定回流到了哪些文件

| 文件 | 本轮改动 |
|---|---|
| `tools/templates/REQ.template.md` | 三节重写：软硬件接口（结论式）、硬件接口（三段式 + 场景固定内容）、验收标准（AC 判据表 + F/AC 分工）；新增图层布局与三个 WaveDrom 坑 |
| `standards/review-checklist.md` | §B 新增：软硬件接口结论式、硬件接口三段式、时序图只画端口、AC 不复述 F |
| `01-requirements/README.md` | 「正文该写什么」表更新 + 新增「时序图的布局约定」 |
| `.dsh/skills/spec-to-rtl-req/SKILL.md` | 新增「写文档前先 grill-me」与「本仓固化的写作约定」两节；写作要求表更新；完成定义加「已 grill-me 讨论」 |
| `.dsh/skills/spec-to-rtl/SKILL.md` | 新增「写文档前先 grill-me」一节，并指向 REQ 的固化约定 |
| `.dsh/skills/spec-to-rtl-{arch,design,verify,check}/SKILL.md` | 各加一节「写文档前先 grill-me」 |
| `INDEX.md` | 由 `sv.py trace` 重算（REQ-001 `in_review`、ARCH-001 `draft`） |

### 2.4 WaveDrom 图件工具链（本次新增）

- 渲染器装在 **`.tools/wdvenv/`**（gitignored）：`wavedrom 2.0.3.post3` + `cairosvg`（后者仅本机用于把 SVG 转 PNG 自查）。
- 渲染命令（路径相对仓根）：
  ```bash
  .tools/wdvenv/bin/wavedrompy -i 01-requirements/REQ-001-rr-arbitration/scenario-2-round-robin.json \
                               -s 01-requirements/REQ-001-rr-arbitration/scenario-2-round-robin.svg
  ```
- **三个坑（会让图「看起来对、其实错」，改图必读）**：
  1. bit 信号**只在电平变化处写值**，其余用 `.` 保持——连写同一值（如 `"1100001111"`）会在每个 tick 交界渲染出**假 V 形毛刺**；bus 状态 `"2.2.2.2."` 不受影响。
  2. 图内文字只用 **ASCII**（渲染环境可能无中文字库，中文会变方框）；中文说明写在 REQ 正文。
  3. `head`/`foot` 过长会被画布宽度**截断**；本仓统一 `hscale: 1.8`，文案 ≤ ~60 字符。
- 细节见 `01-requirements/REQ-001-rr-arbitration/README.md`。

## 3. 当前门禁与追溯状态（诚实清单）

```bash
python3 tools/sv.py gate 01          # 通过（0 hard）
python3 tools/sv.py gate 02          # hard fail：ARCH-001 的上游 REQ-001 尚未 approved（in_review）——预期行为
python3 tools/sv.py trace            # 写 INDEX.md，同时报同一个 hard fail（exit 1）
```

`INDEX.md` 现状：`01` 阶段 1 份 `in_review`；`02` 阶段 1 份 `draft`；覆盖矩阵里 `REQ-001 → ARCH-001`，无 TC、无模块。
**这不是缺陷**：功能点没有人类放行之前，下游引用它就是断链，门禁必须拦。

## 4. 未完成 / 下一步（按顺序）

1. **人类放行 `REQ-001`**：在 front-matter 写 `status: approved` + 真实 `reviewer` + `date`（样例数据要如实标注为样例评审），然后重跑 `gate 01` / `gate 02` 与 `trace`。
2. **复核并放行 `ARCH-001`**：重点核对模块划分（单模块 `rr_arbiter`）、无软件的接口结论、面积/时序预算；顺带决定 **ARCH 框图的布局**——
   目前仍在 `docs/diagrams/arch-001-rr-arbiter.md`，若要与 REQ 统一，应移到 `02-architecture/ARCH-001-arb-arch/`（或直接改成 WaveDrom 图源+SVG）。
3. **③ 详细设计**：`new module rr_arbiter --short rra` → `new des` → 写 `DES-rra-001`（端口表、指针/掩码/两段优先级编码、边界条件）→ 人类放行 → `gate 03 --module rr_arbiter`。
   ⚠️ 见 §5 的「模块骨架时序坑」。
4. **④ RTL**：写 `04-rtl/rr_arbiter/rr_arbiter.sv`（端口逐条对照 DES 端口表；顶层模块名 = 目录名）→ `gate 04 --module rr_arbiter`。
5. **⑤ 自测**：`VP-rra-001`（`test_cases` 覆盖 AC-1~AC-8）+ `05-verification/rr_arbiter/{run_tests.py,regress.yaml,tests/}` → `gate 05` → 人类放行。
6. **⑥ 检查**：`CHK-rra-001` + `06-checks/reports/rr_arbiter/{lint,synth,cov}/`，数字与报告一致 → `gate 06` → 人类放行。
7. **收尾**：`trace` 更新 `INDEX.md`，交付摘要列出未执行项与仍为 `draft`/`in_review` 的产物。

### 施工命令速查

```bash
python3 tools/sv.py new module rr_arbiter --short rra
python3 tools/sv.py new des    --module rr_arbiter --title "仲裁策略"
python3 tools/sv.py new rtl    --module rr_arbiter --title "轮询仲裁器"
python3 tools/sv.py new vp     --module rr_arbiter --title "验证计划"
python3 tools/sv.py new chk    --module rr_arbiter --title "lint 与综合检查"
python3 tools/sv.py gate 03 --module rr_arbiter
python3 tools/sv.py gate all
```

## 5. 已知的坑与风险

| 风险 | 说明 / 应对 |
|---|---|
| **模块骨架时序坑（重要）** | `new module` 会同时创建 `03/04/05` 三处目录；而门禁规则是「`04-rtl/<m>/` 存在 ⇒ 同模块必须有 approved 的 `DES-*`」。因此在 `DES-rra-001` 被人类放行**之前**，`gate 02` / `gate all` 必然 hard fail。**这不是 bug，是门禁的预期行为**：③ 阶段应一次性走完 `new module → new des → 写 DES → 人类放行 → gate 03`，中途不要用 `gate all` 下结论 |
| WaveDrom 三个坑 | 见 §2.4（点记法 / ASCII / 截断） |
| `.vlt` 注释坑（历史） | `06-checks/cfg/verilator.vlt` 的 `//` 注释不能以工具名开头，否则 verilator 当元注释解析、整个 `.vlt` 被当源码，lint 静默失效 |
| verible 同一规则只能一行 | 重复 `+parameter-name-style=` 会互相覆盖并告警；多参数不能逗号合并 |
| **`gate 05` 硬依赖 verilator** | 即使 `regress.yaml` 写 `sim: icarus` 也先检查 verilator 是否存在；纯 icarus 环境会被误判 skip |
| PATH 顺序 | `.venv/bin` 必须在 conda bin 之前，否则 `verilator_includer` 用错 Python |
| yosys `stat` 输出随版本变 | 解析已兼容新旧两种；换 yosys 版本后复核单元数/面积是否解析到 |
| sky130 liberty 路径随版本变化 | 先按 `PDK_ROOT` 自动 glob，找不到用 `SKY130_LIB` 显式指定 |
| placeholder 编码规范 | `standards/coding-standard.md` 仍是 PLACEHOLDER；④ 阶段产物必须显式标注「依赖 placeholder 规范」 |
| ID 语义 | 永不复用；作废标 `superseded` + `superseded_by` |
| 索引一致性 | 每次产物变更后跑 `trace`，`INDEX.md` 的 diff 就是追溯变化证据 |

## 6. 遗留项（第一步留下的）

| 项 | 说明 |
|---|---|
| `slang` 未接线 | `doctor` 里列出，门禁流程从未调用；conda-forge 有包，接入便宜 |
| 公司编码规范 | `standards/coding-standard.md` 仍是 PLACEHOLDER |
| 文档债 | `README.md`、`docs/setup/toolchain.md` 的部分环境事实仍待更新（本轮未动） |
| CI | 按决定不做 |

## 7. 环境事实（2026-09-21 快照）

| 事实 | 值 / 影响 |
|---|---|
| Python / 依赖 | `.venv`：python3 3.14.4、PyYAML 6.0.3、cocotb 2.1.0 |
| EDA 工具 | `.tools/eda`：verilator 5.052、verible `0.0_3667`、yosys 0.69；另有 iverilog 12.0 |
| 图件工具 | `.tools/wdvenv`：wavedrom 2.0.3.post3 + cairosvg（仅本地，gitignored） |
| Node / npm | v24.21.0 / 11.19.0（本机可用，本轮未用于流程） |
| PDK | `PDK_ROOT=.tools/pdk/share/pdk`（sky130A，`sky130_fd_sc_hd`），`doctor` 3/3 ok |
| 忽略目录 | `.tools/`、`.venv/` 均 gitignored；`06-checks/cfg/pdk.env` 不入库 |
| Git | `origin` = `sv_with_dsh.git`，`gh` 已登录 `qiankun214`（`repo` scope），可直接 push |
| `doctor` | 工具 7 项 ok、`slang` MISSING、PDK 3/3 ok、`coding-standard` warn（placeholder） |

## 8. 变更记录

| 日期 | 变更 | 提交 |
|---|---|---|
| 2026-09-18 | 第一步交付：骨架 + CLI + 模板 + 技能 + 安装文档 | `3e9ff11` |
| 2026-09-18 | 新增交接文档（上一版） | `043a13e` |
| 2026-09-19 | 工具链接线修复 + `setup.sh` 一键环境构建 | `e131c48` |
| 2026-09-19 | 重写交接文档（工具链就绪 + gate 04/05/06 实跑） | `d3837c6` |
| 2026-09-21 | 修 `setup.sh`（sudo/apt 主路径等） | `d25e831` |
| 2026-09-21 | 第二步启动：`REQ-001` 样例（5 轮评审返工）+ `ARCH-001` 草稿；写作约定固化进模板/清单/技能；新增 WaveDrom 图件工具链与同名目录布局；本交接文档 | 本轮提交 |
