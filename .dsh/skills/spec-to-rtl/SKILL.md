---
name: spec-to-rtl
description: spec-to-RTL 编排技能：把功能点一路推进到 lint/综合检查，在每个人工放行关口停下等签核。当用户说「从功能点做到底」「推进这个需求」「跑完整流程」时使用。
---

# spec-to-RTL 总纲与编排

本仓把 **功能点 → 系统方案 → 详细设计 → RTL 编写 → 代码自测 → lint/综合检查** 固化成一条带门禁的流水线：
每阶段有模板与产物，产物用 YAML front-matter 连成追溯链；**agent 主导产出，人类在放行关口签核**。

流程知识只写在技能里：本技能是总纲，六个阶段各有一份技能，评审另有一份。
`AGENTS.md` 只是常驻入口（铁律 + 路由），仓内不再维护与技能平行的阶段说明书。

## 1. 铁律（所有阶段适用）

1. **不得跳过阶段**。下游产物必须引用上游 ID，且上游必须已 `approved`。
2. **不得伪造放行**。禁止自行把 `status` 改成 `approved`、禁止填写未真实发生的 `reviewer`；`reviewer` 只能是人类。
3. **不得重编号 ID**。ID 一经使用永不复用；作废时标 `status: superseded` 并指向 `superseded_by`。
4. **语言约定**：正文与注释用中文；RTL 标识符、信号名、目录名、文件名、front-matter 键一律英文（目录名可含数字前缀）。
5. **不得绕过门禁**。失败先修产物或走 waiver（§6），不得删检查、不得改 `tools/sv.py` 或 `06-checks/cfg/*` 让它通过。
6. **不得凭猜测写规范**。编码规范以 `standards/coding-standard.md` 为唯一权威（§7）。
7. **单一入口**：一切校验与报告走 `python3 tools/sv.py <子命令>`；不另写临时脚本、不引入 Makefile、不加 CI。

## 2. 阶段地图

| 阶段 | 目录 | 产物 ID | 上游 | 主模板 | 门禁 | 技能 |
|---|---|---|---|---|---|---|
| ① 功能点 | `01-requirements/` | `REQ-<nnn>` | — | `REQ.template.md` | `sv.py gate 01` | `spec-to-rtl-req` |
| ② 系统方案 | `02-architecture/` | `ARCH-<nnn>` | `REQ-*` | `ARCH.template.md` | `sv.py gate 02` | `spec-to-rtl-arch` |
| ③ 详细设计 | `03-design/<module>/` | `DES-<short>-<nnn>` | `ARCH-*` | `DES.template.md` | `sv.py gate 03 [--module M]` | `spec-to-rtl-design` |
| ④ RTL 编写 | `04-rtl/<module>/` | 模块目录 + `<module>.f` | 该模块的 `DES-*` | `RTL.template.sv` / `FILELIST.template.f` | `sv.py gate 04 --module M` | `spec-to-rtl-rtl` |
| ⑤ 代码自测 | `05-verification/<module>/` | `VP-<short>-<nnn>`、`TC-<short>-<nnn>` | 同模块 `DES-*` | `VP.template.md` | `sv.py gate 05 --module M` | `spec-to-rtl-verify` |
| ⑥ 检查汇总 | `06-checks/<module>/` | `CHK-<short>-<nnn>` | 同模块 `VP-*`、`DES-*` | `CHK.template.md` | `sv.py gate 06 --module M` | `spec-to-rtl-check` |

专项模板（按需使用，放在所属阶段目录）：

- `REGMAP.template.md` — 寄存器表 → `03-design/<module>/`
- `IFACE.template.md` — 接口/时序约定 → `03-design/<module>/`
- `VP.template.md` 内的测试点表 — 测试点清单 → `05-verification/<module>/`

**模块契约只有一份**：`03-design/<module>/module.yaml`（见 `spec-to-rtl-design`），`04-rtl/` 与 `05-verification/` 不重复声明。
模块短名 `<short>` 在该文件用 `id_short` 声明：小写字母开头，2–8 位 `[a-z0-9_]`，全仓唯一。
目录名写全称（`rr_arbiter`），ID 用短名（`rra`）。

模块维度的硬性推进关系（门禁会查）：

- `04-rtl/<module>/` 存在 ⇒ 同模块至少有一份 `approved` 的 `DES-*`；
- `05-verification/<module>/` 存在 ⇒ `04-rtl/<module>/<module>.f` 存在；
- 顶层模块名必须等于 `04-rtl/` 下的目录名。

## 3. 追溯规则

- **单向引用**：下游在 front-matter 的 `upstream:` 里列上游 ID；上游不写下游。反向覆盖关系由 `sv.py trace` 计算并写入 `INDEX.md`。
- **模块是 RTL 与自测的追溯锚点**：`04-rtl/<module>/` 的存在意味着 `03-design/<module>/` 至少有一份 `approved` 的 `DES-*`，否则 hard fail。
- **ID 格式**：
  - 项目级：`REQ-001`、`ARCH-001`（三位序号，全仓唯一）；
  - 模块级：`DES-rra-001`、`VP-rra-001`、`TC-rra-001`、`CHK-rra-001`；
  - 专项设计：`REGMAP-rra-001`、`IFACE-rra-001`，与 `DES-*` 同阶段同上游。
- **测试点**：`TC-*` 不单独建文件，而是 `VP-*` front-matter 里 `test_cases:` 的条目；每个 `TC-*` 必须在
  `05-verification/<module>/regress.yaml` 有同名 cocotb 用例，否则 hard fail。
- **状态生命周期**：`draft → in_review → approved → superseded`；门禁只认 `approved` 为「可进下一阶段」。

## 4. front-matter 契约

每份产物（`01-`~`06-` 下的 Markdown）必须以 YAML front-matter 开头：

```yaml
---
id: DES-rra-001
title: 轮询仲裁器数据通路详设
status: draft            # draft | in_review | approved | superseded
owner: agent             # 产出责任人
reviewer:                # 人类评审者；status=approved 时必填
date: 2025-01-01         # 最近一次状态变更日期；approved 时必填
upstream: [ARCH-001]     # 上游 ID 列表
artifacts:               # 相对仓根的路径列表，必须真实存在
  - 04-rtl/rr_arbiter/rr_arbiter.sv
superseded_by:           # 仅 status=superseded 时填
---
```

- 必填：`id` `title` `status` `owner` `upstream` `artifacts`（`REQ-*` 的 `upstream` 允许空列表）。
- `status: approved` 时额外必填：`reviewer` `date`。
- `05-verification` 的 `VP-*` 额外必填：`test_cases`。
- `artifacts` 只填真实存在的路径；覆盖矩阵由 `sv.py trace` 写进 `INDEX.md`，不要在正文里另抄一份。

## 5. 门禁强度与用法

| 类别 | 判定 | 退出码 |
|---|---|---|
| 结构违规（字段缺失、ID 非法/重复、状态值非法、`artifacts` 指向不存在的文件） | **hard fail** | 1 |
| 追溯断链（`upstream` 不存在、上游未 `approved`、模块缺详设、`TC-*` 无对应用例） | **hard fail** | 1 |
| waiver 过期 | **hard fail** | 1 |
| lint / 格式 / 综合 / 覆盖率不达标 | **soft warn** | 0（`--strict` 时 1） |
| 阶段暂无产物 | **warn** | 0 |
| 工具未安装 | **skip + 安装提示** | 0 |

```bash
python3 tools/sv.py doctor                 # 先看工具与环境是否就位
python3 tools/sv.py gate 03 --module rr_arbiter
python3 tools/sv.py gate all               # 按 01→06 顺序跑，遇 hard fail 立即停
python3 tools/sv.py gate 04 --module rr_arbiter --dry-run   # 只打印将执行的工具命令
python3 tools/sv.py trace                  # 重算覆盖关系并写 INDEX.md
```

## 6. 豁免（waiver）

- 位置：`06-checks/waivers/<module>.yaml`（项目级告警放 `06-checks/waivers/project.yaml`）。
- 每条写全：`rule` `scope` `reason` `owner` `expires`（`YYYY-MM-DD`）。
- **过期的 waiver 是 hard fail**，不允许用豁免长期埋掉告警。
- 豁免只对 lint / 综合 / 覆盖率类 soft 检查有效，**不能豁免结构与追溯断链**。

## 7. 编码规范挂载点

- 唯一权威：`standards/coding-standard.md`；agent 不得自行发明风格。
- 若该文件仍是 placeholder（文件头有 `PLACEHOLDER` 标记）：门禁放行但输出 warn，产物必须显式标注「依赖 placeholder 规范」。
- 团队规范到位后直接替换该文件内容，不改脚本。

## 8. 命令速查

```bash
python3 tools/sv.py doctor                                   # 环境自检
python3 tools/sv.py new req  --title "..." [--slug clk-domain]
python3 tools/sv.py new arch --title "..." [--slug bus-protocol]
python3 tools/sv.py new module rr_arbiter --short rra        # 建 03/04/05 模块目录 + module.yaml
python3 tools/sv.py new des   --module rr_arbiter --title "..."
python3 tools/sv.py new regmap --module rr_arbiter --title "..."
python3 tools/sv.py new iface  --module rr_arbiter --title "..."
python3 tools/sv.py new rtl    --module rr_arbiter --title "..."
python3 tools/sv.py new vp     --module rr_arbiter --title "..."
python3 tools/sv.py new chk    --module rr_arbiter --title "..."
python3 tools/sv.py gate <01..06|all> [--module M] [--strict] [--dry-run]
python3 tools/sv.py trace [--check]                          # 写 INDEX.md；--check 只校验不写
```

## 9. 环境与安装（本仓不自建环境）

工具链与 PDK 由使用者安装，仓库只给说明与自检：

- `docs/setup/toolchain.md` — Verilator / Yosys / Verible / slang / cocotb 安装
- `docs/setup/sky130-pdk.md` — sky130 PDK 获取与 `$PDK_ROOT` 约定
- `requirements.txt` — Python 侧依赖（PyYAML、cocotb）
- `./setup.sh --with-pdk` — 一键补齐（用户态 conda；无 sudo 用 `--no-sudo` 降级）

装完先跑 `python3 tools/sv.py doctor`：逐项报告工具、版本与缺失项安装提示；缺工具不会让门禁崩，对应检查 `skip`。

## 10. 文档写作通则（所有阶段）

- **只写本阶段新增的结论**：上游已写过的内容（功能点、端口表、接口协议、时序约束）用**引用标记**
  （如「见 `REQ-001` 硬件接口」），**不重述、不复制表格**——重述一定会随上游改动而漂移。
- **通用约定写进技能/模板**：布局、命名、格式、判据、流程不随产物变化，写在技能或 template 里，产物正文不重复。
- **不写废话**：没有新信息的小节宁可不写；每条都要能回答「这一步新增了什么决策」，且可被下游直接使用或核对。
- **返工留痕**：内容变更即作废原放行（`approved` → `in_review`，清空 `reviewer`），变更历史写清改了什么、为什么、影响谁。
- **写前先 grill-me**：每份阶段文档动笔前，用 `grill-me`（执行 `grilling` 技能）与用户做质询式讨论；
  事实自己查（模板、上游产物、`sv.py` 规则、`standards/`），每轮一次 `ask_user_question`，推荐项放第一并标「（推荐）」；
  讨论到无未决问题且用户确认理解一致为止。结论写进产物正文/变更历史，**不把问答过程抄进产物**；
  讨论中形成的规范级结论必须回流到对应阶段技能或模板。

各阶段的写作硬要求写在对应技能里；① 那一套最完整，见 `spec-to-rtl-req`。

## 11. 推进流程与人工关口

```bash
python3 tools/sv.py doctor          # 先确认工具与 PDK，把 skip 项告诉用户
python3 tools/sv.py trace           # 当前覆盖矩阵与未覆盖清单
```

逐阶段推进，每阶段**加载对应技能**，不要凭记忆代替：

| 阶段 | 技能 | 门禁 | 输出 |
|---|---|---|---|
| ① 功能点 | `spec-to-rtl-req` | `gate 01` | `REQ-*` |
| ② 系统方案 | `spec-to-rtl-arch` | `gate 02` | `ARCH-*` |
| ③ 详细设计 | `spec-to-rtl-design` | `gate 03` | `DES-*` / `REGMAP-*` / `IFACE-*` |
| ④ RTL | `spec-to-rtl-rtl` | `gate 04 --module M` | `04-rtl/M/*` |
| ⑤ 自测 | `spec-to-rtl-verify` | `gate 05 --module M` | `VP-*` + cocotb |
| ⑥ 检查 | `spec-to-rtl-check` | `gate 06 --module M` | `CHK-*` + 报告 |

**必须停下的放行关口**（用 `ask_user_question` 把阶段结论与评审要点交给用户）：

- ① 功能点（IPO 是否完整、`F*` 是否可验证、non-goals 是否清楚？验收标准此时不写，留给 ⑤ 扇出）
- ② 系统方案（模块划分与预算是否认可？）
- ③ 详细设计（端口表与 FSM 是否可作为 RTL 契约？）
- ⑤ 自测（验收标准是否已从 `F*`/接口不变式/时序场景扇出？覆盖率是否接受？）
- ⑥ 检查（面积/告警/waiver 是否接受？）

④ 没有单独关口：它建立在 ③ 的 `approved` 之上，自身不产出带状态的文档，只要求 `gate 04` 通过并把 lint/格式结果
报告给用户。其余阶段的放行动作只有一个：用户确认后，把 `status: approved` + `reviewer` + `date` 写进该产物
front-matter（唯一合法的放行动作），然后重跑门禁确认。**不得自行放行，也不得代填 `reviewer`。**

## 12. 每阶段收尾与交付摘要

```bash
python3 tools/sv.py gate <stage> [--module M]
python3 tools/sv.py trace            # 更新 INDEX.md（必须入库）
```

- hard fail：立刻修，不继续推进，也不要用 waiver 掩盖。
- soft warn（lint/覆盖率/综合）：记录进 ⑥ 的 `CHK-*`，是否修由用户决定。
- skip（工具缺失）：在交付摘要里逐条列出，不要假装跑过。

结束时交付摘要必须包含：

1. 本次新增/修改的产物清单（含 ID）；
2. `INDEX.md` 里该功能点的覆盖链（REQ→ARCH→DES→TC→CHK）；
3. **未执行项**：哪些检查因工具/PDK 缺失被 skip，以及补跑命令；
4. 仍为 `draft`/`in_review` 的产物（尚未放行的部分）。

## 13. 目录结构与设计取舍

```
01-requirements/   功能点（REQ-xxx，一功能点一文件）
02-architecture/   系统方案（ARCH-xxx）
03-design/<模块>/  详细设计（DES-<short>-xxx + module.yaml）
04-rtl/<模块>/     RTL 与 filelist
05-verification/   自测（VP-<short>-xxx + cocotb）
06-checks/         lint/综合/覆盖率配置、waiver、报告
tools/sv.py        唯一入口（门禁/追溯/建产物/自检）
.dsh/skills/       8 个技能：六阶段 + 编排 + 评审
```

仓库根没有 README：`AGENTS.md` 只有一行，指向本技能。当前进度以 `INDEX.md` 与 `docs/handover/HANDOVER.md` 为准。

| 选择 | 理由 |
|---|---|
| 阶段轴在外、模块在内 | 项目级产物（功能点/系统方案）有处安放，跨模块门禁可汇总 |
| Markdown + YAML front-matter | 人读正文、机器读头部，校验脚本只解析头部 |
| 单一 `tools/sv.py`，不设 Makefile | 无 make 也能跑；逻辑只有一份，避免双入口漂移 |
| front-matter 单向 `upstream` | 写入成本低，覆盖缺口由 `trace` 反算 |
| RTL 追溯锚定模块目录 | RTL 是代码不是文档，用「模块目录 ↔ 详设」代替给每个 `.sv` 编 ID |
| ID 不复用 | 历史报告与 commit 里的 ID 永远有效 |

## 14. 禁止事项

- 跳过任何阶段；跳过就是断链，门禁也会拦。
- 伪造放行（自己写 `reviewer` / `date`）。
- 改 `tools/sv.py`、`06-checks/cfg/*`、`standards/review-checklist.md` 来让门禁通过。
- 在 `06-checks/reports/` 下提交波形、网表、`obj_dir` 等大产物（`.gitignore` 已覆盖）。
- 创建 Makefile、CI 工作流或第二套并行脚本入口。
- 把 `examples/` 之类的旁路示例目录当作流程演示；样例走真实阶段目录。
- 在未读 `standards/coding-standard.md` 的情况下写 RTL。
