# AGENTS.md — spec-to-RTL 流程总纲

本仓是 **从功能点到 RTL 并完成检查** 的单一事实源。任何 agent（或人）在本仓工作时，先读本文件，再按阶段加载 `.dsh/skills/spec-to-rtl-*` 对应的技能。

工作方式：**agent 主导产出，人类在放行关口签核**。agent 不得自行宣布某阶段通过；放行的唯一凭据是产物 front-matter 里的 `status: approved` + `reviewer` + `date`。

---

## 1. 铁律

1. **不得跳过阶段**。下游产物必须引用上游 ID，且上游必须已 `approved`。
2. **不得伪造放行**。禁止自行把 `status` 改成 `approved`、禁止填写未真实发生的 `reviewer`。`reviewer` 只能是人类评审者。
3. **不得重编号 ID**。ID 一经使用永不复用；作废时标 `status: superseded` 并指向替代 ID。
4. **语言约定**：文档正文与注释用中文；RTL 标识符、信号名、目录名、文件名、front-matter 键一律英文（目录名可含数字前缀）。
5. **不得绕过门禁**。门禁失败先修产物或走 waiver（见 §6），不得删检查、不得改脚本让它通过。
6. **不得凭猜测写规范**。编码规范以 `standards/coding-standard.md` 为唯一权威（见 §7）。
7. **单一入口**：一切校验与报告通过 `python3 tools/sv.py <子命令>`，不要另写临时脚本、不要引入 Makefile。

---

## 2. 阶段地图

| 阶段 | 目录 | 产物 ID | 上游 | 主模板 | 门禁命令 |
|---|---|---|---|---|---|
| ① 功能点 | `01-requirements/` | `REQ-<nnn>` | — | `REQ.template.md` | `sv.py gate 01` |
| ② 系统方案 | `02-architecture/` | `ARCH-<nnn>` | `REQ-*` | `ARCH.template.md` | `sv.py gate 02` |
| ③ 详细设计 | `03-design/<module>/` | `DES-<short>-<nnn>` | `ARCH-*` | `DES.template.md` | `sv.py gate 03 [--module M]` |
| ④ RTL 编写 | `04-rtl/<module>/` | 模块目录 + `<module>.f` | 该模块的 `DES-*` | `RTL.template.sv` / `FILELIST.template.f` | `sv.py gate 04 --module M` |
| ⑤ 代码自测 | `05-verification/<module>/` | `VP-<short>-<nnn>`、`TC-<short>-<nnn>` | `DES-*`（同模块） | `VP.template.md` | `sv.py gate 05 --module M` |
| ⑥ 检查汇总 | `06-checks/<module>/` | `CHK-<short>-<nnn>` | `VP-*`、`DES-*`（同模块） | `CHK.template.md` | `sv.py gate 06 --module M` |

专项模板（按需使用，放在所属阶段目录）：

- `REGMAP.template.md` — 寄存器表 → `03-design/<module>/`
- `IFACE.template.md` — 接口/时序约定 → `03-design/<module>/`
- `VP.template.md` 内的测试点表 — 测试点清单 → `05-verification/<module>/`

模块短名 `<short>`：在 `03-design/<module>/module.yaml` 里用 `id_short` 显式声明（小写字母开头，2–8 位 `[a-z0-9_]`），全仓唯一。目录名可写全称（`rr_arbiter`），ID 用短名（`rra`）。**模块契约只有这一份**（`module.yaml`），`04-rtl/` 与 `05-verification/` 不重复声明。

模块维度的硬性推进关系：

- `04-rtl/<module>/` 存在 ⇒ 同模块至少有一份 `approved` 的 `DES-*`；
- `05-verification/<module>/` 存在 ⇒ `04-rtl/<module>/<module>.f` 存在；
- 顶层模块名必须等于 `04-rtl/` 下的目录名。

---

## 3. 追溯规则

- **单向引用**：下游在 front-matter 的 `upstream:` 里列出上游 ID。上游不写下游；反向覆盖关系由 `sv.py trace` 计算并写入 `INDEX.md`。
- **模块是 RTL 与自测的追溯锚点**：`04-rtl/<module>/` 的存在意味着 `03-design/<module>/` 至少有一份 `approved` 的 `DES-*`。若模块目录下没有对应详设，门禁 hard fail。
- **ID 格式**：
  - 项目级：`REQ-001`、`ARCH-001`（三位序号，全仓唯一）
  - 模块级：`DES-rra-001`、`VP-rra-001`、`TC-rra-001`、`CHK-rra-001`
  - 专项设计：`REGMAP-rra-001`（寄存器表）、`IFACE-rra-001`（接口/时序），与 `DES-*` 同阶段同上游
- **测试点**：`TC-*` 不作为独立文件，而是 `VP-*` 文档 front-matter 里 `test_cases:` 的条目；每个 `TC-*` 必须在 `05-verification/<module>/regress.yaml` 里有同名 cocotb 用例，否则 hard fail。
- **状态生命周期**：`draft → in_review → approved → superseded`。门禁只认 `approved` 为「可进下一阶段」。

---

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

- 必填：`id` `title` `status` `owner` `upstream` `artifacts`（`REQ-*` 的 `upstream` 允许为空列表）。
- `status: approved` 时额外必填：`reviewer` `date`。
- `05-verification` 的 `VP-*` 额外必填：`test_cases`（`TC-*` 列表）。

---

## 5. 门禁强度

| 类别 | 判定 | 退出码 |
|---|---|---|
| 结构违规（字段缺失、ID 非法/重复、状态值非法、artifacts 指向不存在的文件） | **hard fail** | 1 |
| 追溯断链（upstream 不存在、上游未 approved、模块缺详设、TC 无对应用例） | **hard fail** | 1 |
| waiver 过期 | **hard fail** | 1 |
| lint / 格式 / 综合 / 覆盖率不达标 | **soft warn** | 0（除非 `--strict`） |
| 阶段暂无产物 | **warn** | 0 |
| 工具未安装 | **skip + 安装提示** | 0 |

用法：

```bash
python3 tools/sv.py doctor                 # 先看工具与环境是否就位
python3 tools/sv.py gate 03 --module rr_arbiter
python3 tools/sv.py gate all               # 按 01→06 顺序跑，遇 hard fail 立即停
python3 tools/sv.py gate 04 --module rr_arbiter --dry-run   # 只打印将执行的工具命令
python3 tools/sv.py trace                  # 重算覆盖关系并写 INDEX.md
```

---

## 6. 豁免（waiver）

- 位置：`06-checks/waivers/<module>.yaml`（项目级告警放 `06-checks/waivers/project.yaml`）。
- 每条必须写全：`rule` `scope` `reason` `owner` `expires`（`YYYY-MM-DD`）。
- **过期的 waiver 是 hard fail**，不允许用豁免长期埋掉告警。
- 豁免只对 lint / 综合 / 覆盖率类 soft 检查有效，**不能豁免结构与追溯断链**。

---

## 7. 编码规范挂载点

- 唯一权威：`standards/coding-standard.md`。
- agent **不得自行发明风格**。若该文件仍是 placeholder 默认内容（文件头有 `PLACEHOLDER` 标记），门禁放行但输出 warn，且产物必须显式标注「依赖 placeholder 规范」。
- 团队规范到位后直接替换该文件内容，无需改脚本。

---

## 8. 命令速查

```bash
python3 tools/sv.py doctor                                   # 环境自检
python3 tools/sv.py new req  --title "..." [--slug clk-domain]
python3 tools/sv.py new arch --title "..." [--slug bus-protocol]
python3 tools/sv.py new module rr_arbiter --short rra        # 建 03/04/05 模块目录 + module.yaml
python3 tools/sv.py new des   --module rr_arbiter --title "..."
python3 tools/sv.py new regmap --module rr_arbiter --title "..."
python3 tools/sv.py new iface  --module rr_arbiter --title "..."
python3 tools/sv.py new vp    --module rr_arbiter --title "..."
python3 tools/sv.py new chk   --module rr_arbiter --title "..."
python3 tools/sv.py gate <01..06|all> [--module M] [--strict] [--dry-run]
python3 tools/sv.py trace [--check]                          # 写 INDEX.md；--check 只校验不写
```

---

## 9. 禁止事项

- 不要创建 Makefile、CI 工作流、或第二套并行脚本入口。
- 不要在 `06-checks/reports/` 下提交波形、网表、obj_dir 等大产物（`.gitignore` 已覆盖）。
- 不要把 `examples/` 之类的旁路示例目录当作流程演示；样例走真实阶段目录。
- 不要在未读 `standards/coding-standard.md` 的情况下写 RTL。
