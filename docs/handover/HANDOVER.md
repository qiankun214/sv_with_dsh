# 交接文档 — spec-to-RTL 流程骨架 + 工具链

| 项 | 值 |
|---|---|
| 生成日期 | 2026-09-19 |
| 仓库 | `/home/alpaca/sv_with_dsh` ↔ <https://github.com/qiankun214/sv_with_dsh>（public，默认分支 `main`） |
| 上一版交接文档 | 提交 `043a13e`（2026-09-18；其 §7 环境事实已过时） |
| 本次代码提交 | `e131c48` —「工具链接线修复 + setup.sh」（见 `git log`） |
| 远端状态 | 本次已推送 `main` |
| 进度 | **第一步完成**（骨架 + CLI + 技能 + 模板）；**工具链已装并实跑验证 gate 04/05/06**；**第二步未开始**（`rr_arbiter` 正式产物） |

> **本文件取代上一版交接文档**（上一版内容仍在 git 历史里）。凡与上一版冲突处，以本版为准：
> 上一版 §7「本机无 verilator/make/g++/pip」等环境事实**已全部过时**。

---

## 1. 这是什么

一个把 **功能点 → 系统方案 → 详细设计 → RTL 编写 → 代码自测 → lint/综合检查** 固化下来的仓库模板：
每阶段有模板与门禁，产物带机器可读的 front-matter 追溯链，**agent 逐阶段产出、人类在放行关口签核**。

设计前提（来自需求方的选择，不要擅自更改）：

- agent 主导产出，人类评审放行；
- 项目级 + 多模块，**阶段轴在外、模块在内**；
- 契约载体 = Markdown 正文（中文）+ YAML front-matter（机器读）；
- 全链路 ID + 可校验门禁；ID 单向 `upstream` 引用、永不复用；
- 工具链走开源（Verilator / Yosys / Verible + cocotb，综合映射到 sky130）；
- 唯一流程入口是 `python3 tools/sv.py`，**不要引入 Makefile、不要第二套流程入口**；
- 仓库不自建环境：提供 `docs/setup/` 安装文档 **和** `setup.sh` 一键构建（见 §4.3）。

## 2. 目录结构

```
.
├── AGENTS.md                     ★ 流程总纲：铁律 / 阶段地图 / ID 规则 / front-matter 契约 / 门禁强度
├── README.md                     导览（⚠ 见 §10「文档债」）
├── INDEX.md                      追溯与覆盖索引（由 sv.py trace 生成，必须入库）
├── setup.sh                      ★ 新增：用户态一键构建 .venv + .tools/eda + 可选 .tools/pdk
├── requirements.txt              Python 侧依赖声明（PyYAML、cocotb）
├── .gitignore                    .tools/ .venv/ pdk.env 波形 网表 obj_dir 等
├── 01-requirements/…06-checks/   六个阶段目录，每个都带一份 README
├── docs/
│   ├── setup/toolchain.md        ⚠ 环境事实过时（见 §10）
│   ├── setup/sky130-pdk.md       PDK 获取说明
│   └── handover/HANDOVER.md      本文件
├── standards/
│   ├── coding-standard.md        ★ 编码规范挂载点（当前仍是 PLACEHOLDER）
│   └── review-checklist.md       评审清单 A~H
├── tools/
│   ├── sv.py                     ★ 唯一 CLI：doctor / new / gate / trace（单文件，仅依赖 PyYAML）
│   └── templates/                10 份模板
├── .dsh/skills/                  10 个技能：六阶段 + 编排 + 评审 + grilling/grill-me
└── 06-checks/{cfg,waivers,reports}/   lint 配置、waiver、工具报告归档
```

★ = 接手时优先读。

### 2.1 本机已就位的工具链（不入库，`.gitignore` 覆盖）

| 路径 | 内容 | 版本 | 体积 |
|---|---|---|---|
| `.venv/` | cocotb + PyYAML | cocotb 2.1.0 / PyYAML 6.0.3 | 3.8 M |
| `.tools/eda/` | verilator + verible + yosys（conda-forge 单环境） | verilator **5.052** / verible 0.0_3667_g88d12889 / yosys **0.69** | 1.7 G |
| `.tools/pdk/` | sky130 PDK（`litex-hub/open_pdks.sky130a`） | 1.0.471_0_g97d0844 | 8.9 G |
| `.tools/sandbox/` | **一次性验证夹具**（见 §6.3，含伪放行） | — | 2.1 M |

`.tools` 合计约 11 G；`PDK_ROOT=.tools/pdk/share/pdk`（由 `setup.sh` 自动探测）。

## 3. 流程契约（接手必须遵守）

以 `AGENTS.md` 为唯一权威，这里只列接手最常用的：

| 阶段 | 目录 | 产物 ID | 上游 | 门禁 |
|---|---|---|---|---|
| ① 功能点 | `01-requirements/` | `REQ-<nnn>` | — | `gate 01` |
| ② 系统方案 | `02-architecture/` | `ARCH-<nnn>` | `REQ-*` | `gate 02` |
| ③ 详细设计 | `03-design/<module>/` | `DES-<short>-<nnn>`（+`REGMAP-*`/`IFACE-*`） | `ARCH-*` | `gate 03` |
| ④ RTL | `04-rtl/<module>/` | 模块目录 + `<module>.f` | 同模块 `DES-*` | `gate 04 --module M` |
| ⑤ 代码自测 | `05-verification/<module>/` | `VP-<short>-<nnn>`、`TC-<short>-<nnn>` | 同模块 `DES-*` | `gate 05 --module M` |
| ⑥ 检查汇总 | `06-checks/<module>/` | `CHK-<short>-<nnn>` | 同模块 `VP-*` | `gate 06 --module M` |

放行的唯一凭据：front-matter 里 `status: approved` + 真实人类 `reviewer` + `date`。

## 4. 关键决策记录

### 4.1 需求方在需求阶段拍定的

驱动方式 / 粒度 / 契约 / 追溯 / 放行 / 门禁强度 / 工具链 / 安装 / 入口 / PDK / 规范 / 技能 / 样例 / 报告 / 仓库——详见上一版交接文档 §4.1（git 历史 `043a13e`），结论未变。

### 4.2 实现时补齐的决定

1. **RTL 追溯锚定模块目录**：不给每个 `.sv` 编 ID；`04-rtl/<m>/` 存在 ⇒ 同模块有 approved 的 `DES-*`。
2. **模块契约只有一份**：`03-design/<m>/module.yaml`（`id_short` / `implements` / `files`）。
3. **`TC-*` 不是独立文件**：写在 `VP-*` 的 `test_cases:` 里，并在 `regress.yaml` 有同名用例（缺一条即 hard fail）。
4. **`gate 05` 的执行契约**是 `python3 05-verification/<m>/run_tests.py`，且它把覆盖率写到
   `06-checks/reports/<m>/cov/summary.json`（`{"line_pct":…,"toggle_pct":…}`）。
5. **新增 `REGMAP-*` / `IFACE-*`** 两个专项前缀，与 `DES-*` 同阶段同上游。

### 4.3 工具链与 PDK 的获取决策（本次新增，均已实测）

| 决策 | 理由（实测数据） |
|---|---|
| **基础包走 apt，EDA 不走 apt** | 基础包（`bzip2` / `build-essential` / `python3-venv` / `python3-pip`）apt 有且无版本风险，`setup.sh` 用 `sudo apt-get` 装。EDA 仍走 conda-forge：Ubuntu 26.04 索引里 verible **无包**、verilator 只有 **5.032 < cocotb 要求的 5.036**（且 `tools/sv.py` 的 gate 05 硬依赖 verilator、无 icarus 分支），yosys 0.52 未在本仓 RTL 上验证。无 sudo 时按 `setup.sh` 头部注释的降级表走（`--no-sudo`）。 |
| **不用 GitHub 发布包** | 直连 `github.com` 发布包实测 **约 3 KB/s**（verible 17 MB 下了一刻钟没下完）。代理可用：`gh-proxy.com` 953 KB/s、`ghfast.top` 736 KB/s；`hub.gitmirror.com`/`ghproxy.cc`/`gh.llkk.cc` 不可用。 |
| **用 conda-forge + 清华镜像** | `https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge` 实测 **47 MB/s**，一个渠道同时提供 verilator / verible / yosys，装进单环境 `.tools/eda`。 |
| **PDK 用 `litex-hub/open_pdks.sky130a`** | conda-forge 上没有 PDK 包（`open_pdks`/`sky130`/`volare` 均 404）；TUNA/BFSU 不镜像 litex-hub；但官方 `conda.anaconda.org` 实测 **12.5 MB/s**，1.2 GB 约 2 分钟。布局正好是 `sv.py` 的 `find_sky130` 期望的 `sky130A/libs.ref/sky130_fd_sc_hd/{lib,verilog}`。 |
| **缓存全部落仓内** | 沙箱拒绝写 `~/.cache`、`~/.conda`；`uv` / `micromamba` 必须把 `UV_CACHE_DIR` / `CONDA_PKGS_DIRS` / `XDG_CACHE_HOME` 指到 `.tools/` 下（`setup.sh` 已内建）。 |

## 5. 当前做完了什么 / 没做什么

### 已完成

- **第一步**：六阶段目录 + `tools/sv.py`（doctor/new/gate/trace，支持 `--dry-run`/`--strict`）+ 10 份模板
  + 06-checks 配置 + 8 个流程技能（另有 `grilling`/`grill-me`，来自外部 skills 安装）
  + `standards/` + `docs/setup/` + `AGENTS.md`/`README.md`/`INDEX.md`。
- **工具链**：`setup.sh` 一键构建，本机已装 `verilator 5.052` / `verible 0.0_3667` / `yosys 0.69`
  / `cocotb 2.1.0` / `sky130 PDK`，`doctor` 全 ok。
- **门禁接线**：`gate 04` / `gate 05` / `gate 06` 三条链**首次真实跑通**，并修掉 4 处「门禁显示通过、
  但检查其实没执行」的缺陷（见 §6.2）。

### 未完成

| 项 | 说明 |
|---|---|
| **`rr_arbiter` 正式产物** | 六个阶段的真实产物**一条都没有**；`.tools/sandbox/` 里只有验证夹具（非正式产物） |
| `slang` 未接线 | `spec-to-rtl-check` 技能的检查矩阵列了 slang，但 `tools/sv.py` 只在 `doctor` 里列它，门禁流程从未调用（conda-forge 有 `slang` 包，接入很便宜） |
| 公司编码规范 | `standards/coding-standard.md` 仍是 PLACEHOLDER |
| 文档债 | `README.md`、`docs/setup/toolchain.md` 的环境事实与「不代装」表述已过时（见 §10） |
| `gate 05` 后端硬编码 | `tool_sim` 在跑 `run_tests.py` 前硬检查 `verilator` 是否存在，即使 `regress.yaml` 写 `sim: icarus` |
| CI | 按决定不做 |

## 6. 验证状况（诚实清单）

### 6.1 已在本机实跑通过

```bash
./setup.sh                     # → .venv + .tools/eda
./setup.sh --with-pdk          # → .tools/pdk（sky130）
source .tools/env.sh
python3 tools/sv.py doctor     # 工具 7 项 ok（slang 仍缺）、PDK 3/3 ok
python3 tools/sv.py gate all   # 见下表
```

沙箱（`.tools/sandbox/`，含真实 RTL 与 cocotb 用例）实测：

| 门禁 | 结果 |
|---|---|
| `gate 04` | verilator lint 通过（0 告警）/ verible 风格 lint 通过 / 格式通过 |
| `gate 05` | cocotb 回归 2/2 通过（**icarus 12.0 与 verilator 5.052 双后端**）；覆盖率 **line 100% / toggle 100%** |
| `gate 06` | Yosys 0.69 + sky130 综合成功：**50 cells / 344.08 µm²**（`sky130_fd_sc_hd__tt_025C_1v80`） |
| `gate all` | **7 ok / 1 warn（placeholder）/ 0 skip / 0 hard** |

真实仓库（尚无产物）跑 `gate all`：`0 ok / 2 warn / 0 hard`，通过（warn = placeholder + 无模块）。

### 6.2 本次修掉的 4 处「静默失效」+ 2 处配置缺口

1. **`verilator.vlt` 让 lint 从未真正执行**（最严重）：首行 `// Verilator lint 配置（…）` 被 verilator
   当成遗留元注释，报 `Unknown verilator comment`（5.020）/ `BADVLTPRAGMA`（5.052），整个 `.vlt`
   被当作 Verilog 源文件。**原版在 5.020 与 5.052 上均复现失败**；改写注释后均 exit 0。
2. **`verible.rules` 缺命名规则配置**：verible 默认 `localparam_style=CamelCase`，与 coding-standard
   §1.4 的 `UPPER_SNAKE` 冲突，任何含 `localparam IDX_W` 的 RTL 都被报。
3. **`tools/sv.py` verible 计数正则漏匹配**：`^.*?:\d+:\d+:` 不匹配 verible 的 `file:line:col-col:`
   输出，`findings` 恒为 0，真实告警被掩盖。
4. **`tools/sv.py` yosys 单元数恒为 `None`**：yosys ≥0.4x 的 `stat -liberty` 改成列式
   `50  344.08 cells`，旧正则找 `Number of cells:` 匹配不到。
5. **`.gitignore` 漏 `06-checks/cfg/pdk.env`**：`pdk.env.example` 明写「该文件不入库」，但规则缺失，
   会把机器本地绝对路径提交进去。
6. **`setup.sh` 自身**：`${PDK_ROOT:+PDK_ROOT="$PDK_ROOT"}` 展开后不被 bash 当作赋值前缀，会当命令
   执行；已改显式分支。

### 6.3 关于 `.tools/sandbox/`

为验证工具接线而建的一次性夹具：完整复制了仓库结构，含一份**伪放行**的 REQ/ARCH/DES
（`reviewer: sandbox-probe`）与一个真 RR 仲裁器 + cocotb 用例。它**不是**正式产物：

- 位于 `.tools/`（gitignored），永不入库；
- 其中的 `approved` 是伪的，**不得**当作放行证据，也不得拷进 `01-`~`06-` 真实阶段目录；
- 第二步写正式产物时可参考其 RTL / `regress.yaml` / `run_tests.py` 结构，但内容必须重写。

### 6.4 负路径（上一轮实测，本轮未复测）

重复 ID、上游未 approved、`04-rtl/<m>/` 存在但详设未放行、`VP` 缺 `test_cases`、
TC 在 `regress.yaml` 无对应用例、waiver 过期 —— 均应 hard fail。**接手后建议复测一遍。**

### 6.5 未验证 / 未执行

- `slang` 的 SV 语义检查：**未装、未接线**（技能文档提到，`sv.py` 未实现）；
- 面积/单元数只有单点数据（50 cells / 344.08 µm²），**尚无 ② 阶段资源预算可比对**；
- 覆盖率采集只在验证夹具上跑过，`run_tests.py` 的正式版本还没写。

## 7. 环境事实（本机 WSL，2026-09-19 快照）

| 事实 | 影响 |
|---|---|
| `NoNewPrivs=1`，`sudo` 被内核标志禁止 | `apt-get install` **不可用**；只能用户态装（conda / 解包） |
| 已装：`make 4.4.1`、`g++ 13.3`、`python3 3.12.3`、`pip 24.0`、`uv`、`iverilog 12.0`、`verilator 5.020(apt)` | cocotb 功能仿真可跑 |
| `.tools/eda`：verilator 5.052、verible、yosys 0.69 | lint / 格式 / 综合齐全 |
| `.tools/pdk`：sky130（PDK_ROOT 已写入 `pdk.env` 与 `.tools/env.sh`） | gate 06 可跑 |
| 沙箱拒绝写 `~/.cache`、`~/.conda` | 包管理器缓存必须指到 `.tools/` |
| GitHub 发布包直连约 3 KB/s | 不要从 GitHub release 取工具；代理 `gh-proxy.com` 可用 |
| 磁盘 436 G，已用 52%；`.tools` 占约 11 G（eda 1.7 G + pdk 8.9 G） | 空间充足 |
| `gh` 已登录 `qiankun214`，`gh auth setup-git` 已配置 | 可直接 push |

## 8. 接手步骤

```bash
# 0) 拿到仓库后先建环境（系统基础包按需 sudo apt；EDA/PDK 仍是用户态 conda）
./setup.sh --with-pdk          # .venv + .tools/eda + .tools/pdk；幂等，可重复跑
# 无 sudo（agent 沙箱 / CI）时：./setup.sh --no-sudo --with-pdk
source .tools/env.sh           # PATH + PDK_ROOT
`python3 tools/sv.py doctor` 期望：**工具 7 项 ok / slang 缺失，PDK 3 项 ok**。

# 1) 进第二步：填 rr_arbiter（见 §9），然后
python3 tools/sv.py gate all
```

`setup.sh` 参数：`--with-pdk`、`--no-sudo`（禁用 apt，走无 sudo 降级路径）、`--mirror tuna|bfsu|official|<url>`、`--force`。

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

1. 每阶段写完 → 跑该阶段门禁 → **请人类放行**（`status: approved` + 真实 `reviewer` + `date`）→ 再进下一阶段；
2. 样例是**样例数据**，放行者字段必须诚实标注是样例评审，不能伪装成真实评审记录；
3. RTL 端口必须逐条对照 `DES-rra-001` 的端口表；顶层模块名 = 目录名 `rr_arbiter`；
4. `05-verification/rr_arbiter/run_tests.py` 用 cocotb 2.x runner API
   （`from cocotb_tools.runner import get_runner`），覆盖率写 `06-checks/reports/rr_arbiter/cov/summary.json`；
   可参考 `.tools/sandbox` 里已跑通的版本（`--coverage-line --coverage-toggle`，
   注意 `coverage.dat` 由 verilator 写在**运行目录**而非 build_dir，格式是 `\x01`/`\x02` 分隔的文本）；
5. `gate 06` 的 `CHK-*` 里每个数字必须与 `06-checks/reports/` 的原始报告一致，未执行项如实列出。

## 10. 已知风险与坑

| 风险 | 说明 / 应对 |
|---|---|
| **`.vlt` 注释以工具名开头会让 lint 静默失效** | 已在 `verilator.vlt` 里写明；新增规则时不要在 `//` 注释行首写 `verilator` |
| **verible 同一规则只能写一行** | 重复 `+parameter-name-style=` 会互相覆盖并告警；多参数不支持逗号合并（会 fatal） |
| **Verilator 版本下限** | cocotb 2.x 要求 **≥ 5.036**；apt 的 5.020 会让 `gate 05` verilator 后端编译失败（icarus 可兜底） |
| **PATH 顺序** | `.venv/bin` 必须在 conda bin 之前，否则 `verilator_includer` 用错 Python → `AssertionError: SRE module mismatch` |
| **yosys `stat` 输出格式随版本变** | 解析已兼容新旧两种；换 yosys 版本后建议复核单元数/面积是否解析到 |
| **GitHub 限速** | 不要从 GitHub release 取工具；PDK 走 `conda.anaconda.org`，工具走清华 conda 镜像 |
| **`gate 05` 硬依赖 verilator** | 即使 `sim: icarus` 也会先检查 verilator 是否存在；纯 icarus 环境会被误判 skip |
| **sky130 liberty 路径随版本变化** | `sv.py` 先按 `PDK_ROOT` 自动 glob，找不到可用 `SKY130_LIB` 显式指定 |
| **placeholder 编码规范** | 团队规范到位后**直接替换** `standards/coding-standard.md` 并删除 `PLACEHOLDER` 标记 |
| **ID 语义** | 永不复用；作废标 `superseded` + `superseded_by`，否则历史报告对不上 |
| **索引一致性** | 每次产物变更后跑 `trace`，`INDEX.md` 的 diff 就是追溯变化证据 |
| **文档债** | `README.md` 仍写「本仓库不自建环境、不代装」，与 `setup.sh` 冲突；`README.md`/`AGENTS.md` 仍写「8 个技能」（实际 10 个）、`AGENTS.md` §8 命令速查漏 `new rtl`；`docs/setup/toolchain.md` §0 环境事实整段过时。**建议下一次一并修掉。** |

## 11. 变更记录

| 日期 | 变更 | 提交 |
|---|---|---|
| 2026-09-18 | 第一步交付：骨架 + CLI + 10 份模板 + 技能 + 安装文档；推送 GitHub | `3e9ff11` |
| 2026-09-18 | 新增交接文档（上一版） | `043a13e` |
| 2026-09-19 | 工具链接线修复（4 处静默失效 + 2 处配置缺口）+ 新增 `setup.sh` 一键环境构建 | `e131c48` |
| 2026-09-19 | 重写交接文档：工具链已就绪、gate 04/05/06 实跑验证、环境事实更新、文档债登记 | 见 `git log docs/handover/` |
