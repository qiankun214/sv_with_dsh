# 交接文档 — spec-to-RTL 流程骨架 + rr_arbiter 样例（①→⑥ 全链路已放行，检查项无遗留）

| 项 | 值 |
|---|---|
| 生成日期 | 2026-10-03 |
| 仓库 | `/home/alpaca/sv_with_dsh` ↔ <https://github.com/qiankun214/sv_with_dsh>（public，默认分支 `main`） |
| 上一版交接文档 | 提交 `0faaede` 时的内容（① ② ③ 已放行、④ 未开始）；本文件取代它，旧版仍在 git 历史里 |
| 本次提交 | `466d5c1`（④ RTL 初版）、`2507c6d`（⑤ `VP-rra-001` 放行 + ④ 按新编码风格重写）、`9572ec5`（⑥ `CHK-rra-001` 放行）、`75232d1`（交接文档）、`401de21`（⑥ 接入 OpenSTA 补齐时序）、`30223d3`（交接文档）、`286e51a`（⑥ 接入 slang 补齐 SV 语义）、本文件随后补提交 |
| 进度 | **① `REQ-001`、② `ARCH-001`、③ `DES-rra-001`、⑤ `VP-rra-001`、⑥ `CHK-rra-001` 全部 `approved`**；④ RTL 已完成并通过 `gate 04`（④ 无单独人工关口，放行体现在 ③ 已 approved） |

> 本文件取代上一版交接文档。凡与旧版冲突处，以本版为准。

---

## 1. 一句话现状

`rr_arbiter` 样例已**从功能点推到检查汇总，并且时序也核验过了**：
`REQ-001`（轮询仲裁 IPO）→ `ARCH-001`（单模块）→ `DES-rra-001`（详设 + 4 张内部时序图）→
`04-rtl/rr_arbiter/rr_arbiter.sv` → `VP-rra-001`（8 个 `TC-*`，40/40 通过）→
`CHK-rra-001`（lint 0 告警、**slang 语义 0 errors / 0 warnings**、sky130 综合 **26 cells**、**OpenSTA 时序 WNS 8.71 ns / 推算 Fmax 775.2 MHz**、覆盖率 line 100.0% / toggle 96.9%）。
`gate all` = **9 ok / 1 warn / 0 skip / 0 hard**，`trace` 0 warn，覆盖链完整、未覆盖清单为空。
**六项检查（lint / 格式 / SV 语义 / 综合 / 时序 / 覆盖率）全部有实测结论，没有待补检查项。**

## 2. 本轮（2026-10-03）做了什么

### 2.1 产出

| 产物 | 状态 | 说明 |
|---|---|---|
| `01-requirements/REQ-001-rr-arbitration.md` | `approved` | 按 ③ 讨论返工：删 `I4`、`F8` 改为「复位只同步复位指针、不清零输出」、场景 4 重绘；两次作废放行、两次重放行 |
| `02-architecture/ARCH-001-arb-arch.md` | `approved` | 内容未变（单模块、≤500 行分解、无模块间连接、预算口径），本轮签核 |
| `03-design/rr_arbiter/module.yaml` + `DES-rra-001-arbitration-policy.md` + 图件目录 | `approved` | 数据/控制通路实现概要、实现规划（寄存器 + 全部组合变量）、端口时序（引用 `REQ-001`）、内部时序 4 图、边界条件、时序假设、可综合性 |
| `04-rtl/rr_arbiter/rr_arbiter.sv` + `rr_arbiter.f` | — | 可综合 RTL（4 `assign` + 4 单变量 `always_comb` + 1 `always_ff`）；依赖 placeholder 编码规范（已标注） |
| `05-verification/rr_arbiter/` | `VP-rra-001` `approved` | `VP` + `regress.yaml` + `run_tests.py` + `tb/tb_rr_arbiter.py`（驱动/黄金模型）+ `tests/test_rr_arbiter.py`（8 用例） |
| `06-checks/cfg/sta_sky130.tcl` | 新增 | OpenSTA 脚本模板（目标周期、I/O 外部延时 0、报告格式契约） |
| `06-checks/rr_arbiter/CHK-rra-001-lint-synth.md` + `06-checks/reports/rr_arbiter/{lint,synth,sta,cov}/` | `approved` | lint（verilator/verible/**slang**）/ 综合 / 时序 / 覆盖率证据汇总，附未执行项说明 |
| `docs/setup/opensta.md`、`docs/setup/slang.md` | 新增 | 两个工具的安装、校验与排障 |
| `tools/sv.py` / `setup.sh` / `06-checks/cfg/thresholds.yaml` | 已改 | `tool_sta()` 接入 `gate 06`；lint 阶段接入 `slang`；`setup_sta()`/`setup_slang()` 一键构建；`sta.*` 与 `lint.max_slang_warnings` 阈值 |
| `INDEX.md` | — | `trace` 重算：01/02/03/05/06 各 1 份 `approved`；覆盖矩阵完整 |

### 2.2 关键结论

- **③ 设计**：二进制指针 `ptr_q`（`$clog2(NUM_REQ)` 位）+ 两段掩码优先级编码；授权**组合透传**；**不用 FSM**
  （每拍独立授权，无跨周期相位；另加状态寄存器会是死逻辑或破坏当拍推进）；只同步复位 `ptr_q`；
  非法 `NUM_REQ` 在 elaboration 期用 `generate` + `$error` 拒绝。
- **④ 编码风格（人类评审要求）**：一个 `always` 块 / `assign` **只给一个变量赋值**，只有**强关联**信号可同块
  （例：优先编码器的 `idx_hi`/`idx_lo` 与扫描标志 `hi_found`/`lo_found`）；**禁止嵌套三目**，多级条件用 `if`/`else`。
- **⑤ 验证**：验收标准 18 条（`AC-1~AC-18`）从 `REQ-001` 的 `F1~F8`、`I1~I3`、5 个时序场景扇出；8 个 `TC-*`；
  参数档 `NUM_REQ=2/3/4/5/8`（含非 2 的幂）；覆盖率只对 `NUM_REQ=4` 采，阈值 80/60；断言只写在 cocotb 侧。
- **⑥ 检查**：面积 **26 cells**（预算 ≤150，预期 25~60）；时序 **WNS 8.71 ns @10 ns（MET）、TNS 0.00 ns、
  推算 Fmax 775.2 MHz**（单时钟理想网络、I/O 外部延时 0；最差路径 `ptr_q` → 5 级组合 → `ptr_q`/D）；
  slang 语义 **0 errors / 0 warnings**；无告警故**不登记 waiver**。

### 2.3 返工留痕（重要）

1. **`REQ-001` 复位口径返工 ×2**：③ 讨论发现「复位断言期间输出必须为 0」会强制输出门控 → 回改 `REQ-001`；
   随后修正场景 4 图的**一拍错位**（同步复位在第一个上升沿即生效）并再次作废/重放行。两次都写进变更历史。
2. **`DES-rra-001` 结构返工 ×2**：先按评审意见新增「数据通路/控制通路实现概要 + 实现规划」与「端口/内部时序」；
   再按编码风格要求改实现描述（最终定为**不新增信号**、强关联同块）。
3. **RTL 风格返工 ×1**：由「一个大 `always_comb` 赋 11 个变量 + 三目」改为 4 条 `assign` + 4 个单变量
   `always_comb` + 1 个 `always_ff`；回归结果与改前完全一致（40/40、100.0%/96.9%）→ 行为等价。
4. **`CHK-rra-001` 时序补齐 ×1**：原放行时 STA 是未执行项；本轮装 OpenSTA、接入工具链、回填结论并重放行。
5. **`CHK-rra-001` SV 语义补齐 ×1**：同上，装 slang、接入 `gate 04` 的 lint 阶段、回填 0 errors / 0 warnings 并重放行；
   至此六项检查（lint / 格式 / SV 语义 / 综合 / 时序 / 覆盖率）全部有实测结论。

### 2.4 回流到合同文件的内容（约定 #7）

| 文件 | 本轮改动 |
|---|---|
| `tools/templates/DES.template.md` | 新增「端口时序 / 内部时序 / 数据通路实现概要 / 控制通路实现概要 / 实现规划」骨架与列定义 |
| `tools/templates/RTL.template.sv` | 头部写明两条硬性风格；组合逻辑骨架改为「一信号一块」 |
| `tools/templates/CHK.template.md` | 结论摘要新增「静态时序」行；补时序建模口径说明 |
| `.dsh/skills/spec-to-rtl-design/SKILL.md` | 「完善」判定扩到 12 条（含实现规划、时序已规划） |
| `.dsh/skills/spec-to-rtl-rtl/SKILL.md` | 编码要求第 1、2 条：一变量一块 / 强关联可同块 / 禁止嵌套三目 |
| `.dsh/skills/spec-to-rtl-check/SKILL.md` | 检查矩阵/纪律/完成定义加入 STA（WNS/TNS + 与目标频率对照） |
| `03-design/README.md` | 图件同名目录布局；修正原示例把 `04-rtl/...sv` 写进 ③ `artifacts` 的错误 |
| `06-checks/README.md` + `06-checks/cfg/thresholds.yaml` | 新增 `sta_sky130.tcl` 与 `sta.*` 阈值；检查矩阵加时序行 |
| `AGENTS.md` | §5 门禁强度与 §6 豁免范围加入「时序」 |
| `standards/review-checklist.md` | §D 增 4 条（数据通路/控制通路/实现规划/时序图）；§E 增 2 条（分块风格 / 禁嵌套三目）；§G 增时序核对 |
| `docs/setup/opensta.md` + `docs/setup/toolchain.md` | OpenSTA 安装与排障；toolchain 加指引 |
| `setup.sh` | 新增 `setup_sta()`/`setup_slang()`（默认构建，`--no-sta`/`--no-slang` 跳过）与 `.tools/{sta,slang}/bin` PATH |
| `.dsh/skills/spec-to-rtl-check/SKILL.md` | 检查矩阵明确 `slang --lint-only`；纪律加入「时序与目标频率对照」 |
| `.dsh/skills/spec-to-rtl-rtl/SKILL.md` | 自检说明补上 slang（lint/格式/SV 语义三类 soft warn） |
| `docs/setup/slang.md` + `toolchain.md` | slang 安装（LiteX-Hub 渠道）与排障；toolchain 加指引 |

### 2.5 图件与工具链

- `.tools/wdvenv`（**gitignored，换机需重建**）：`wavedrom` + 本地截图用 `cairosvg`；
  ```bash
  python3 -m venv .tools/wdvenv && .tools/wdvenv/bin/pip install wavedrom
  ```
- `.tools/sta`（**gitignored，`./setup.sh` 会重建**）：OpenSTA 3.1.0；构建依赖在 `.tools/stabuild`
  （conda-forge 的 swig/eigen + **vsc 渠道**的 cudd），Tcl/flex 复用 `.tools/eda`。
- `.tools/slang`（**gitignored，`./setup.sh` 会重建**）：slang 3.0.0，来自 **LiteX-Hub 渠道**（与 PDK 同源）；
  包内可执行文件叫 `slang-driver`，安装后补了 `slang` 软链。
- `REQ-001` 5 张端口时序图 + `DES-rra-001` 4 张内部时序图，图源 `.json` 与渲染 `.svg` 都放与产物**同名的目录**，
  两件都计入 `artifacts` 并入库。改图只改 `.json` 再重渲。

## 3. 当前门禁与追溯状态（诚实清单）

```bash
source .tools/env.sh         # 不 source 会让 doctor 把 verilator/yosys/verible/sta/cocotb 全判 MISSING
python3 tools/sv.py gate all # 9 ok / 1 warn / 0 skip / 0 hard（唯一 warn：coding-standard 仍为 PLACEHOLDER）
python3 tools/sv.py trace    # 0 warn
```

`INDEX.md`：`REQ-001 → ARCH-001 → DES-rra-001 → TC-rra-001…008 → CHK-rra-001`，未覆盖清单为空；
模块 `rr_arbiter`（短名 `rra`）。

## 4. 未完成 / 可选的后续

1. **团队编码规范**：`standards/coding-standard.md` 仍是 PLACEHOLDER；RTL 产物已标注依赖它。
2. **文档债**：`README.md`、`docs/setup/toolchain.md` 的部分环境事实待更新（本轮只加了 OpenSTA/slang 指引）。
3. **CI**：按此前决定不做。
4. 若时序口径要更严：可在 `sta_sky130.tcl` 里加真实 I/O 约束（`set_input_transition`、负载 `set_load`）
   或扫描多个周期求精确 Fmax；当前口径（理想时钟、I/O 延时 0）已写进 CHK，改口径要重跑并重新放行 ⑥。
5. 若要把 `slang` 做强约束：可给它加外部规则配置（当前用默认规则集，只在 `sv.py` 里追加命令行开关）。

## 5. 已知的坑与风险

| 风险 | 说明 / 应对 |
|---|---|
| **模块骨架时序坑** | `new module` 会建 `04-rtl/<m>/`，而门禁要求「`04-rtl/` 存在 ⇒ 同模块有 approved 详设」；详设放行前 `gate 03/05` 必然 hard fail。**这是预期行为**：③ 要一次性走完「建骨架 → 写详设 → 人类放行」 |
| **同步复位波形坑** | 同步复位在 `rst_n` 拉低后的**第一个**上升沿生效；画 WaveDrom 时把 `rst_n` 的断言/释放沿放在上升沿**之前**，否则「边沿是否采到复位」有歧义（场景 4 曾因此错一拍） |
| **cocotb 2.1 没有 `cocotb.skip`** | 只有 `skipif` 装饰器；运行期条件跳过要么用等价替代用例，要么直接返回。另：`runner.test()` 前必须先 `runner.build()`（同一 runner 对象），否则报 `AttributeError: '_vhdl_sources'` |
| **参数/种子要经 `extra_env` 传给用例** | cocotb runner 的 `extra_env={"RR_NUM_REQ": …, "RR_SEED": …}`；用例侧读 `os.environ`。漏传会在用例里 `KeyError` |
| **构建产物放 `06-checks/reports/<m>/obj_dir/`** | 该路径已被 `.gitignore` 覆盖（`06-checks/reports/**/obj_dir/`），避免新增忽略规则；覆盖率 `.dat` 也放其下，只有 `cov/summary.json` 入库 |
| **OpenSTA 的 cudd 不在 conda-forge** | cudd 在 **`vsc` 渠道**（`https://conda.anaconda.org/vsc`）；`FindCUDD.cmake` 会把 `CUDD_LIB-NOTFOUND` 传给 target，缺 cudd 时 **configure 直接失败**（虽然它逻辑上是可选依赖）。conda 包的 `cudd.h` 在 `include/cudd/cudd.h`，命中 FindCUDD 的第三个搜索路径 |
| **OpenSTA 源码获取** | GitHub 直连/`raw`/release 资产在本机实测不可达，`codeload` 可用；`setup.sh` 的 `setup_sta()` 先 `git clone`，失败回退 `codeload` tarball |
| **`sta` 要能在 PATH 里找到** | `setup.sh` 会把 `.tools/sta/bin` 写进 `.tools/env.sh`；老环境可临时 `ln -s ../../sta/bin/sta .tools/eda/bin/sta` |
| **slang 不在 conda-forge** | conda-forge 的 `slang` 是 **S-Lang**（完全无关的库）；SV slang 在 **LiteX-Hub 渠道**（`-c https://conda.anaconda.org/litex-hub`，与本仓 PDK 同源）。包内可执行文件叫 `slang-driver`，装后需补 `slang` 软链（`sv.py` 两个名字都认） |
| **yosys `ltp` 不能当时序代理** | 映射到 sky130 后 `ltp -noff` 与 `ltp` 都只报 `length=0`；时序只能靠 STA（已接入） |
| **`.tools/wdvenv` 不入库** | 换机必须重建（见 §2.5） |
| **门禁/doctor 需先 `source .tools/env.sh`** | 否则 verilator/yosys/verible/sta/cocotb 全报 MISSING（实际都在 `.venv`/`.tools`） |
| **③ 的 `artifacts` 不能写 ④ 才生成的 RTL** | 门禁要求 `artifacts` 路径**此刻存在** |
| WaveDrom 三个坑 | ① bit 信号只在电平变化处写值、其余用 `.`；② 图内文字只用 ASCII；③ `head`/`foot` ≤ ~60 字符、`hscale: 1.8` |
| `.vlt` 注释坑 | `06-checks/cfg/verilator.vlt` 的 `//` 注释不能以工具名开头，否则整个 `.vlt` 被当源码、lint 静默失效 |
| verible 同一规则只能一行 | 重复 `+parameter-name-style=` 会互相覆盖并告警 |
| `gate 05` 硬依赖 verilator | 即使 `regress.yaml` 写 `sim: icarus` 也先检查 verilator |
| yosys `stat` 输出随版本变 | 解析已兼容新旧两种写法 |
| sky130 liberty 路径随版本变化 | 先按 `PDK_ROOT` 自动 glob，找不到用 `SKY130_LIB` 显式指定 |
| placeholder 编码规范 | RTL 产物必须显式标注「依赖 placeholder 规范」 |
| ID 语义 / 索引一致性 | ID 永不复用；每次产物变更后跑 `trace`，`INDEX.md` 的 diff 即追溯证据 |

## 6. 遗留项

| 项 | 说明 |
|---|---|
| ~~`slang` 未接线~~ | **已完成**：slang 3.0.0 已装并接入 `gate 04` 的 lint 阶段（见 §2、§7） |
| 公司编码规范 | `standards/coding-standard.md` 仍是 PLACEHOLDER |
| 文档债 | `README.md`、`docs/setup/toolchain.md` 部分环境事实待更新 |
| CI | 按决定不做 |

## 7. 环境事实（2026-10-03 快照）

| 事实 | 值 / 影响 |
|---|---|
| 解释器 | 系统 `python3` 3.12.3；仓库 `.venv`（PyYAML 6.0.3、cocotb 2.1.0）。`sv.py` 用系统 `python3` 即可；`run_tests.py` 由 `gate 05` 以 `sys.executable` 调用 |
| EDA 工具 | `.tools/eda/bin`：verilator **5.052**（含 `verilator_coverage`）、verible、yosys **0.69**、tcl 8.6、flex；另有 iverilog 12.0。**需 `source .tools/env.sh`** |
| 时序工具 | `.tools/sta/bin/sta`：**OpenSTA 3.1.0**（本轮源码构建）；构建依赖 `.tools/stabuild`（swig 4.5.1 / eigen 3.4 / cudd 3.0.0） |
| 语义工具 | `.tools/slang/bin/slang`（软链到包内 `slang-driver`）：**slang 3.0.0+7efcca2e**（LiteX-Hub 渠道） |
| 缺失工具 | 无（`doctor` 全 ok，仅 `coding-standard` 为 PLACEHOLDER warn） |
| 图件工具 | `.tools/wdvenv`：`wavedrom`（本地截图另装 `cairosvg`）；gitignored |
| PDK | `PDK_ROOT=.tools/pdk/share/pdk`（sky130A，`sky130_fd_sc_hd__tt_025C_1v80`），`doctor` 3/3 ok |
| 忽略规则 | `.tools/`、`.venv/`、`06-checks/reports/**/obj_dir/`、`reports/**/*.log` 等；`06-checks/cfg/pdk.env` 不入库 |
| Git | `origin` = `sv_with_dsh.git`，`gh` 已登录 `qiankun214`（`repo` scope） |

## 8. 变更记录

| 日期 | 变更 | 提交 |
|---|---|---|
| 2026-09-18 | 第一步交付：骨架 + CLI + 模板 + 技能 + 安装文档 | `3e9ff11` |
| 2026-09-18 | 新增交接文档（上一版） | `043a13e` |
| 2026-09-19 | 工具链接线修复 + `setup.sh` 一键环境构建 | `e131c48` |
| 2026-09-19 | 重写交接文档（工具链就绪 + gate 04/05/06 实跑） | `d3837c6` |
| 2026-09-21 | 修 `setup.sh` | `d25e831` |
| 2026-09-21 | 第二步启动：`REQ-001` + `ARCH-001` 草稿；写作约定固化；WaveDrom 图件链 | `f2395aa` |
| 2026-09-21 | 验收标准从 ① 扇出到 ⑤ | `fe6542d` |
| 2026-09-21 | ②③ 技能改为强制 `grill-me` 产出 | `8780bd2` |
| 2026-09-23 | 放行 `REQ-001` | `3d12c72` |
| 2026-09-23 | ② `grill-me` + `ARCH-001` 重写 | `b41112b` |
| 2026-09-23 | `ARCH-001` 去废话（上游改引用） | `61bbac9` |
| 2026-09-23 | 安装 handoff 技能 | `b92d9e2` |
| 2026-10-03 | 放行 `ARCH-001`；③ `grill-me` 产出 `DES-rra-001`；`REQ-001` 复位口径返工并两次重放行；DES 结构与时序规范回流 | `e6018bb` |
| 2026-10-03 | 交接文档（②③ 已放行、④ 为下一步） | `0faaede` |
| 2026-10-03 | ④ RTL 初版（gate 04 通过） | `466d5c1` |
| 2026-10-03 | ⑤ `VP-rra-001` 放行 + 回归实现；④ 按人类编码风格重写（一变量一块 / 禁嵌套三目）并回流合同文件 | `2507c6d` |
| 2026-10-03 | ⑥ `CHK-rra-001` 放行（lint/综合 26 cells/覆盖率 100.0%、96.9%）；`gate all` 全绿 | `9572ec5` |
| 2026-10-03 | 重写交接文档（①→⑥ 全链路已放行） | `75232d1` |
| 2026-10-03 | **⑥ 接入 OpenSTA 补齐时序**：`tool_sta()` + `sta_sky130.tcl` + `setup.sh` 的 `setup_sta()` + `docs/setup/opensta.md`；`CHK-rra-001` 回填 WNS 8.71 ns / TNS 0 / Fmax 775.2 MHz 并重放行 | `401de21` |
| 2026-10-03 | 交接文档更新（含时序核验与 OpenSTA 工具链） | `30223d3` |
| 2026-10-03 | **⑥ 接入 slang 补齐 SV 语义**：lint 阶段加 `slang --lint-only` + `setup.sh` 的 `setup_slang()` + `docs/setup/slang.md`；`CHK-rra-001` 回填 errors 0 / warnings 0 并重放行（六项检查全部有实测结论） | `286e51a` |
| 2026-10-03 | 交接文档更新（slang 与「无待补检查项」） | 本文件提交 |
