# spec-to-RTL：功能点到 RTL 的流程骨架

一个把 **功能点 → 系统方案 → 详细设计 → RTL 编写 → 代码自测 → lint/综合检查** 固化下来的仓库模板：
每阶段有模板与门禁，产出物带机器可读的 front-matter 追溯链，agent 逐阶段推进、人类在放行关口签核。

## 目录一眼看

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

## 先读这几份

- **[AGENTS.md](AGENTS.md)** — 流程总纲：铁律、ID 规则、front-matter 契约、门禁强度。人和 agent 都从这里开始。
- **各阶段目录下的 `README.md`** — 该阶段放什么、怎么命名、门禁怎么跑。
- **[docs/handover/HANDOVER.md](docs/handover/HANDOVER.md)** — 交接文档：现状、决策记录、验证状况与未完成项、接手步骤。

## 安装（本仓库不自建环境）

工具链与 PDK 都由使用者自行安装，仓库只提供说明与自检命令：

- **[docs/setup/toolchain.md](docs/setup/toolchain.md)** — Verilator / Yosys / Verible / slang / cocotb 安装
- **[docs/setup/sky130-pdk.md](docs/setup/sky130-pdk.md)** — sky130 PDK 获取与 `$PDK_ROOT` 约定
- **`requirements.txt`** — Python 侧依赖（PyYAML、cocotb）

装完后先自检：

```bash
python3 tools/sv.py doctor
```

`doctor` 会逐项报告工具是否就位、版本、以及缺失项的安装提示；缺工具不会让门禁崩掉，对应检查会 `skip` 并给出提示。

## 常用命令

```bash
python3 tools/sv.py doctor                       # 环境自检
python3 tools/sv.py new req --title "时钟域划分"  # 建新功能点（自动分配 REQ-xxx）
python3 tools/sv.py new module dma --short dma   # 建模块骨架（03/04/05 三处）
python3 tools/sv.py gate 01                      # 跑单阶段门禁
python3 tools/sv.py gate all                     # 01→06 顺序跑，遇 hard fail 停
python3 tools/sv.py trace                        # 重算追溯覆盖并更新 INDEX.md
```

- 门禁强度：结构与追溯断链 **hard fail**；lint/综合/覆盖率 **soft warn**（`--strict` 可升级）；缺工具 **skip**。
- `--dry-run` 只打印将要执行的工具命令，便于在未装工具时核对接线。
- 追溯快照见 **[INDEX.md](INDEX.md)**（由 `sv.py trace` 生成，需入库）。

## 当前状态

| 项 | 状态 |
|---|---|
| 目录骨架、模板、门禁 CLI、8 个技能 | ✅ 已就位 |
| 样例模块（参数化轮询仲裁器 `rr_arbiter`） | ⏳ 待填（第二步） |
| lint / 综合 / cocotb 三条链的本机实跑 | ⏳ 待使用者装完工具链后验证 |

本机（WSL）初始 **没有** make / g++ / gcc，也没有任何 EDA 工具与 PDK；跑 `./setup.sh --with-pdk` 可一键补齐（系统基础包按需 `sudo apt`，EDA 与 PDK 走用户态 conda；无 sudo 用 `--no-sudo` 降级），因此：

- **可实跑**：结构 + 追溯门禁（纯 Python，只需 PyYAML，本机已有 `python3-yaml`）。
- **未验证**：`gate 04`（lint）、`gate 05`（cocotb 仿真）、`gate 06`（Yosys + sky130 综合）三条链的脚本未经真实工具执行——装完工具链后请跑 `doctor` 与 `gate all` 回报结果。

## 设计取舍（为什么长这样）

| 选择 | 理由 |
|---|---|
| 阶段轴在外、模块在内 | 项目级产物（功能点/系统方案）有处安放，跨模块门禁可汇总 |
| Markdown + YAML front-matter | 人读正文、机器读头部，校验脚本只解析头部 |
| 单一 `tools/sv.py`，不设 Makefile | 无 make 也能跑；逻辑只有一份，避免双入口漂移 |
| front-matter 单向 `upstream` | 写入成本低，覆盖缺口由 `trace` 反算 |
| RTL 追溯锚定模块目录 | RTL 是代码不是文档，用「模块目录 ↔ 详设」代替给每个 .sv 编 ID |
| ID 不复用 | 历史报告与 commit 里的 ID 永远有效 |
