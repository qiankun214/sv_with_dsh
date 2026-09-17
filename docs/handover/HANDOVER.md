# 交接文档 — spec-to-RTL 流程骨架

| 项 | 值 |
|---|---|
| 生成日期 | 2026-09-18 |
| 仓库 | `/home/alpaca/sv` ↔ <https://github.com/qiankun214/sv_with_dsh>（public，默认分支 `main`） |
| 当前提交 | `3e9ff11` —「spec-to-RTL 骨架：六阶段目录 + 门禁 CLI + 8 个技能（第一步）」，46 个文件 |
| 远端状态 | 已推送，`refs/heads/main` = `3e9ff11e858f32b7913071d8f73424f224ea904a`（与本地 HEAD 一致） |
| 进度 | **第一步完成**（骨架 + CLI + 技能 + 模板 + 安装文档）；**第二步未开始**（`rr_arbiter` 样例模块） |

---

## 1. 这是什么

一个把 **功能点 → 系统方案 → 详细设计 → RTL 编写 → 代码自测 → lint/综合检查** 固化下来的仓库模板：
每阶段有模板与门禁，产物带机器可读的 front-matter 追溯链，**agent 逐阶段产出、人类在放行关口签核**。

设计前提（来自需求方的选择，不要擅自更改）：

- agent 主导产出，人类评审放行；
- 项目级 + 多模块，**阶段轴在外、模块在内**；
- 契约载体 = Markdown 正文（中文）+ YAML front-matter（机器读）；
- 全链路 ID + 可校验门禁；ID 单向 `upstream` 引用、永不复用；
- 工具链走开源（Verilator / Yosys / Verible / slang + cocotb，综合映射到 sky130）；
- 唯一入口是 Python CLI，**不要引入 Makefile**；
- 仓库不代装任何工具，只提供安装文档。

## 2. 目录结构

```
.
├── AGENTS.md                     ★ 流程总纲：铁律 / 阶段地图 / ID 规则 / front-matter 契约 / 门禁强度
├── README.md                     导览：安装入口、常用命令、当前状态、设计取舍
├── INDEX.md                      追溯与覆盖索引（由 sv.py trace 生成，必须入库）
├── requirements.txt              Python 侧依赖声明（PyYAML、cocotb）——只声明，不代装
├── .gitignore                    .tools/ .venv/ 波形 网表 obj_dir 等大产物
├── 01-requirements/…06-checks/   六个阶段目录，每个都带一份 README（放什么/命名/门禁）
├── docs/
│   ├── setup/toolchain.md        ★ 工具链安装（OSS CAD Suite / Verible / cocotb / 编译器）
│   ├── setup/sky130-pdk.md       ★ PDK 获取（volare / open_pdks）与 $PDK_ROOT 约定
│   └── handover/HANDOVER.md      本文件
├── standards/
│   ├── coding-standard.md        ★ 编码规范挂载点（当前是 PLACEHOLDER 默认内容）
│   └── review-checklist.md       评审清单 A~H，评审技能的判据
├── tools/
│   ├── sv.py                     ★ 唯一 CLI：doctor / new / gate / trace（单文件，仅依赖 PyYAML）
│   └── templates/                10 份模板：REQ ARCH DES VP CHK REGMAP IFACE RTL FILELIST module
├── .dsh/skills/                  8 个技能：spec-to-rtl（编排）+ 六阶段 + review
└── 06-checks/{cfg,waivers,reports}/   lint 配置、waiver、工具报告归档
```

★ = 接手时优先读的 6 个文件。

## 3. 流程契约（接手必须遵守）

### 3.1 阶段与产物

| 阶段 | 目录 | 产物 ID | 上游 | 门禁 |
|---|---|---|---|---|
| ① 功能点 | `01-requirements/` | `REQ-<nnn>` | — | `gate 01` |
| ② 系统方案 | `02-architecture/` | `ARCH-<nnn>` | `REQ-*` | `gate 02` |
| ③ 详细设计 | `03-design/<module>/` | `DES-<short>-<nnn>`（+`REGMAP-*`/`IFACE-*`） | `ARCH-*` | `gate 03 [--module M]` |
| ④ RTL | `04-rtl/<module>/` | 模块目录 + `<module>.f` | 同模块 `DES-*` | `gate 04 --module M` |
| ⑤ 代码自测 | `05-verification/<module>/` | `VP-<short>-<nnn>`、`TC-<short>-<nnn>` | 同模块 `DES-*` | `gate 05 --module M` |
| ⑥ 检查汇总 | `06-checks/<module>/` | `CHK-<short>-<nnn>` | 同模块 `VP-*` | `gate 06 --module M` |

### 3.2 front-matter（每份产物的机器可读头部）

```yaml
---
id: DES-rra-001
title: 轮询仲裁策略
status: draft            # draft | in_review | approved | superseded
owner: agent
reviewer:                # status=approved 时必填，且必须是真实的人
date:                    # status=approved 时必填
upstream: [ARCH-001]     # 上游 ID 列表，必须存在且已 approved
artifacts: []            # 相对仓根路径，必须真实存在
---
```

### 3.3 门禁强度

| 类别 | 判定 | 退出码 |
|---|---|---|
| 结构违规（字段缺失、ID 非法/重复、status 非法、artifacts 不存在） | hard fail | 1 |
| 追溯断链（upstream 不存在/未 approved、模块缺详设、TC 缺用例、waiver 过期） | hard fail | 1 |
| lint / 格式 / 综合 / 覆盖率不达标 | soft warn | 0（`--strict` 升级） |
| 阶段暂无产物 / 工具缺失 | warn / skip | 0 |

`gate all` 遇 hard fail **立即停**，不再调用工具；工具缺失时 `--dry-run` 仍打印将执行的命令。

### 3.4 命令速查

```bash
python3 tools/sv.py doctor                                    # 环境自检
python3 tools/sv.py new req|arch|module|des|regmap|iface|rtl|vp|chk ...
python3 tools/sv.py gate <01..06|all> [--module M] [--strict] [--dry-run]
python3 tools/sv.py trace [--check]                           # 重算覆盖并写 INDEX.md
```

## 4. 关键决策记录

### 4.1 需求方在需求阶段拍定的（7 轮问答的结论）

| 维度 | 结论 |
|---|---|
| 驱动方式 | agent 主导，人类放行 |
| 粒度 | 项目级 + 多模块，阶段轴在外 |
| 契约 | Markdown + YAML front-matter |
| 追溯 | 全链路 ID、单向 upstream、反向索引算覆盖、ID 不复用（废弃标 `superseded`） |
| 放行 | front-matter `status/reviewer/date` |
| 门禁 | 结构/断链 hard fail；lint/覆盖率 soft warn |
| 工具 | Verilator + Yosys + Verible + slang；cocotb 做自测前端；sky130 真实映射 |
| 安装 | **不代装**，只给安装文档与定位约定 |
| 入口 | 唯一 `tools/sv.py`，无 Makefile |
| PDK | 读 `$PDK_ROOT` / `06-checks/cfg/pdk.env` |
| 规范 | `standards/coding-standard.md` 挂载点，空时用 placeholder + warn |
| Skill | 仓内 `.dsh/skills/`，六阶段 + 编排 + 评审共 8 个 |
| 样例 | 参数化轮询仲裁器 `rr_arbiter`（第二步做） |
| 报告 | `06-checks/reports/` 归档，summary 入库、大产物忽略 |
| 仓库 | `git init` + `.gitignore`，不接 CI |

### 4.2 实现时补齐的决定（**建议复核**）

1. **RTL 追溯锚定模块目录**：不给每个 `.sv` 编 ID；`04-rtl/<m>/` 存在 ⇒ 同模块有 approved 的 `DES-*`。
2. **模块契约只有一份**：`03-design/<m>/module.yaml`（`id_short` / `implements` / `files`），`04-rtl`、`05-verification` 不重复声明。
3. **`TC-*` 不是独立文件**：写在 `VP-*` 的 `test_cases:` 里，并在 `regress.yaml` 有同名用例（缺一条即 hard fail）。
4. **`gate 05` 的执行契约**是 `python3 05-verification/<m>/run_tests.py`，且它要把覆盖率写到 `06-checks/reports/<m>/cov/summary.json`（`{"line_pct":…,"toggle_pct":…}`）——用这层隔离 cocotb 版本差异。
5. **新增 `REGMAP-*` / `IFACE-*`** 两个专项前缀，与 `DES-*` 同阶段同上游。

## 5. 当前做完了什么 / 没做什么

### 已完成（第一步）

- 六阶段目录 + 各阶段 README（含命名、front-matter 样例、门禁命令、完成定义）；
- `tools/sv.py`：`doctor` / `new`（9 种产物，自动分配 ID、自动维护 `implements`/`files`）/ `gate`（结构+追溯+工具三层）/ `trace`（写 INDEX.md）；支持 `--dry-run`、`--strict`；
- 10 份模板 + 06-checks 配置（`verilator.vlt`、`verible.rules`、`synth_sky130.ys`、`thresholds.yaml`、`pdk.env.example`）；
- 8 个技能（`.dsh/skills/spec-to-rtl*`）；`standards/` 两份；`docs/setup/` 两份；`AGENTS.md`/`README.md`/`INDEX.md`；
- git 仓库初始化 + 首个提交 + 推送到 GitHub。

### 未完成

| 项 | 说明 |
|---|---|
| **`rr_arbiter` 样例模块** | 六个阶段的真实产物全部未写；这是第二步的全部内容 |
| **三条工具链从未真实执行** | `gate 04`（verilator/verible）、`gate 05`（cocotb）、`gate 06`（Yosys+sky130）的命令行在代码里写好了，但本机没有工具，**只跑过 `--dry-run`** |
| 公司编码规范 | `standards/coding-standard.md` 仍是 PLACEHOLDER |
| CI | 按决定不做 |

## 6. 验证状况（诚实清单）

**已在本机实跑通过：**

```bash
python3 tools/sv.py doctor                      # 工具/PDK/规范/waiver 状态
python3 tools/sv.py trace                       # 生成 INDEX.md，覆盖矩阵正确
python3 tools/sv.py gate all                    # 空骨架：仅 placeholder warn，通过
python3 tools/sv.py new req|arch|module|des|rtl|vp|chk   # 全部产物生成 + ID 分配 + 契约自动维护
python3 tools/sv.py gate all --dry-run          # 打印完整工具命令，且不写报告
```

**负路径（均应 hard fail，已实测）：**

- 重复 ID → `ID 重复：REQ-001 …`；
- 上游未 approved → `上游 ARCH-001 尚未 approved`；
- `04-rtl/<m>/` 存在但详设未放行 → `RTL 的上游契约未放行`；
- `VP` 缺 `test_cases` / TC 在 `regress.yaml` 无对应用例；
- waiver 过期 → `waiver 已过期（2020-01-01）`。

**未验证（接手第一件事）：**

- Verilator 的确切参数组合（`--lint-only -Wall -Wno-style -Wno-fatal --top-module <m> <cfg>/verilator.vlt -f <m>.f`）；
- Verible 的 flag（`--rules_config=`）、以及 `06-checks/cfg/verible.rules` 里的规则名是否都被当前版本接受；
- cocotb 2.x runner API 写法与 `summary.json` 产出；
- Yosys + sky130 综合脚本（`dfflibmap`/`abc -liberty`）、以及 `stat` 输出的解析正则。

## 7. 环境事实（本机 WSL）

| 事实 | 影响 |
|---|---|
| 无 `verilator` `yosys` `slang` `verible` `iverilog` 等 | 需要按 `docs/setup/toolchain.md` 自装 |
| 无 `make`、无 `g++`/`gcc`/`clang` | **cocotb 功能仿真跑不了**（lint 与综合不需要编译器） |
| `sudo` 被 `no_new_privs` 禁用 | apt 装不了，只能用户态解包预编译包 |
| `python3` 无 pip/ensurepip，但 `python3-yaml 6.0.3` 已存在 | 结构/追溯门禁开箱可用；Python 包需另装（uv/get-pip） |
| 无 `unzip`，有 `tar`/`curl`/`wget`/`git` | 一律取 `.tar.gz`/`.tgz` |
| 网络可达 github.com / pypi.org | 可下载发布包 |
| `gh` 2.101.0 已装于 `~/.local/bin/gh` 并已登录 `qiankun214` | 可 `gh` 操作仓库；`gh auth setup-git` 已配置 |
| 工作区沙箱只允许写 `/home/alpaca/sv` | 写 `~/.config`、`~/.local` 等需提权 |

## 8. 接手步骤

```bash
# 0) 环境自检，看清哪些是 skip
python3 tools/sv.py doctor

# 1) 按文档装工具链（约 GB 级下载，用户态，无需 sudo）
#    docs/setup/toolchain.md  → OSS CAD Suite（verilator/yosys/slang/cocotb）+ Verible
#    docs/setup/sky130-pdk.md → volare 或 open_pdks，导出 PDK_ROOT
export PATH="$HOME/opt/oss-cad-suite/bin:$HOME/opt/verible/bin:$PATH"
export PDK_ROOT="$HOME/pdk"

# 2) 复检：期望工具行全部 ok
python3 tools/sv.py doctor

# 3) 进第二步：填 rr_arbiter 样例模块（见第 9 节），然后
python3 tools/sv.py gate all
```

**关于 cocotb 的额外前提**：`gate 05` 需要 `make` + C++ 编译器；本机两者都没有且无法 apt 安装。
若要在本机跑通 ⑤，需要换机器/容器，或用用户态工具链（conda/nix，未验证）。在此之前 ⑤ 的结论只能标为「未执行」。

## 9. 第二步的施工清单（`rr_arbiter`）

```bash
python3 tools/sv.py new req    --title "轮询仲裁" --slug rr-arbitration      # REQ-001
python3 tools/sv.py new arch   --title "仲裁器系统方案" --slug arb-arch      # ARCH-001（上游 REQ-001，需先放行）
python3 tools/sv.py new module rr_arbiter --short rra
python3 tools/sv.py new des    --module rr_arbiter --title "仲裁策略"        # DES-rra-001
python3 tools/sv.py new rtl    --module rr_arbiter --title "轮询仲裁器"
python3 tools/sv.py new vp     --module rr_arbiter --title "验证计划"        # VP-rra-001 + TC-*
python3 tools/sv.py new chk    --module rr_arbiter --title "lint 与综合检查" # CHK-rra-001
```

要点：

1. 每阶段写完 → 跑该阶段门禁 → **请人类放行**（写 `status: approved` + `reviewer` + `date`）→ 再进下一阶段；
2. 样例是**样例数据**，放行者字段必须诚实标注是样例评审，不能伪装成真实评审记录；
3. RTL 端口必须逐条对照 `DES-rra-001` 的端口表；顶层模块名 = 目录名 `rr_arbiter`；
4. `05-verification/rr_arbiter/run_tests.py` 用 cocotb 2.x runner API，覆盖率写 `06-checks/reports/rr_arbiter/cov/summary.json`；
5. 卡在工具上时不要把 skip 写成「已检查」，在 `CHK-rra-001` 的「未执行项」里如实记录。

## 10. 已知风险与坑

| 风险 | 说明 / 应对 |
|---|---|
| 工具参数未经验证 | 用 `gate 04/05/06 --dry-run` 先看命令，再用真工具跑；参数集中在 `tools/sv.py` 的「工具接线」一节 |
| Verible 规则名不匹配会直接报错退出 | `06-checks/cfg/verible.rules` 里新增规则前先 `verible-verilog-lint --help_rules=<name>` |
| Yosys 对 SystemVerilog 支持有限 | 复杂 SV 结构需先过 `slang` 检查；必要时用 yosys-slang 插件（OSS CAD Suite 含） |
| sky130 liberty 路径随版本变化 | 脚本按 open_pdks 布局自动 glob；找不到时用 `SKY130_LIB` 显式指定 |
| `gate 05` 依赖 make/g++ | 本机不可用，⑤ 的结论需在有编译环境处补跑 |
| placeholder 编码规范 | 团队规范到位后**直接替换** `standards/coding-standard.md` 并删除 `PLACEHOLDER` 标记 |
| ID 语义 | 永不复用；作废标 `superseded` + `superseded_by`，否则历史报告对不上 |
| 索引一致性 | 每次产物变更后跑 `trace`，`INDEX.md` 的 diff 就是追溯变化证据 |

## 11. 变更记录

| 日期 | 变更 | 提交 |
|---|---|---|
| 2026-09-18 | 第一步交付：骨架 + CLI + 8 技能 + 模板 + 安装文档；推送 GitHub | `3e9ff11` |
| 2026-09-18 | 新增本交接文档（`docs/handover/`） | 见 `git log docs/handover/` |
