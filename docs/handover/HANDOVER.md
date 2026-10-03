# 交接文档 — spec-to-RTL 流程骨架 + rr_arbiter 样例（①→⑥ 全链路已放行）

| 项 | 值 |
|---|---|
| 生成日期 | 2026-10-03 |
| 仓库 | `/home/alpaca/sv_with_dsh` ↔ <https://github.com/qiankun214/sv_with_dsh>（public，默认分支 `main`） |
| 上一版交接文档 | 提交 `0faaede` 时的内容（① ② ③ 已放行、④ 未开始）；本文件取代它，旧版仍在 git 历史里 |
| 本次提交 | `466d5c1`（④ RTL 初版）、`2507c6d`（⑤ `VP-rra-001` 放行 + ④ 按新编码风格重写）、`9572ec5`（⑥ `CHK-rra-001` 放行）、本文件随后补提交 |
| 进度 | **① `REQ-001`、② `ARCH-001`、③ `DES-rra-001`、⑤ `VP-rra-001`、⑥ `CHK-rra-001` 全部 `approved`**；④ RTL 已完成并通过 `gate 04`（④ 无单独人工关口，放行体现在 ③ 已 approved） |

> 本文件取代上一版交接文档。凡与旧版冲突处，以本版为准。

---

## 1. 一句话现状

`rr_arbiter` 样例已**从功能点一路推到检查汇总**：`REQ-001`（轮询仲裁 IPO）→ `ARCH-001`（单模块）→ `DES-rra-001`（详设 +
4 张内部时序图）→ `04-rtl/rr_arbiter/rr_arbiter.sv` → `VP-rra-001`（8 个 `TC-*`，40/40 通过）→ `CHK-rra-001`
（lint 0 告警、sky130 综合 26 cells、覆盖率 line 100.0% / toggle 96.9%）。
`gate all` = **7 ok / 1 warn / 0 skip / 0 hard**，`trace` 0 warn，覆盖链完整、未覆盖清单为空。
**唯一遗留：100 MHz 时序未核验**（本机无 STA 工具）。

## 2. 本轮（2026-10-03）做了什么

### 2.1 产出

| 产物 | 状态 | 说明 |
|---|---|---|
| `01-requirements/REQ-001-rr-arbitration.md` | `approved` | 按 ③ 讨论返工：删 `I4`、`F8` 改为「复位只同步复位指针、不清零输出」、场景 4 重绘；两次作废放行、两次重放行 |
| `02-architecture/ARCH-001-arb-arch.md` | `approved` | 内容未变（单模块、≤500 行分解、无模块间连接、预算口径），本轮签核 |
| `03-design/rr_arbiter/module.yaml` + `DES-rra-001-arbitration-policy.md` + 图件目录 | `approved` | 数据/控制通路实现概要、实现规划（寄存器 + 全部组合变量）、端口时序（引用 `REQ-001`）、内部时序 4 图、边界条件、时序假设、可综合性 |
| `04-rtl/rr_arbiter/rr_arbiter.sv` + `rr_arbiter.f` | — | 可综合 RTL；顶层名 = 目录名；依赖 placeholder 编码规范（已标注） |
| `05-verification/rr_arbiter/` | `VP-rra-001` `approved` | `VP` + `regress.yaml` + `run_tests.py` + `tb/tb_rr_arbiter.py`（驱动/黄金模型）+ `tests/test_rr_arbiter.py`（8 用例） |
| `06-checks/rr_arbiter/CHK-rra-001-lint-synth.md` + `06-checks/reports/rr_arbiter/{lint,synth,cov}/` | `approved` | lint / 综合 / 覆盖率证据汇总，含未执行项 |
| `INDEX.md` | — | `trace` 重算：01/02/03/05/06 各 1 份 `approved`；覆盖矩阵完整 |

### 2.2 关键结论

- **③ 设计**：二进制指针 `ptr_q`（`$clog2(NUM_REQ)` 位）+ 两段掩码优先级编码；授权**组合透传**；**不用 FSM**
  （每拍独立授权，无跨周期相位；另加状态寄存器会是死逻辑或破坏当拍推进）；只同步复位 `ptr_q`；非法 `NUM_REQ` 在
  elaboration 期用 `generate` + `$error` 拒绝。
- **④ 编码风格（人类评审要求）**：一个 `always` 块 / `assign` **只给一个变量赋值**，只有**强关联**信号可同块
  （例：优先编码器的 `idx_hi`/`idx_lo` 与扫描标志 `hi_found`/`lo_found`）；**禁止嵌套三目**，多级条件用 `if`/`else`。
- **⑤ 验证**：验收标准 18 条（`AC-1~AC-18`）从 `REQ-001` 的 `F1~F8`、`I1~I3`、5 个时序场景扇出；8 个 `TC-*`；
  参数档 `NUM_REQ=2/3/4/5/8`（含非 2 的幂）；覆盖率只对 `NUM_REQ=4` 采，阈值 80/60；断言只写在 cocotb 侧。
- **⑥ 检查**：面积 **26 cells**（`ARCH-001` 预算 ≤150，预期 25~60）；无告警故**不登记 waiver**；
  时序核验缺失已如实列入未执行项。

### 2.3 返工留痕（重要）

1. **`REQ-001` 复位口径返工 ×2**：③ 讨论发现「复位断言期间输出必须为 0」会强制输出门控 → 回改 `REQ-001`；
   随后修正场景 4 图的**一拍错位**（同步复位在第一个上升沿即生效）并再次作废/重放行。两次都写进变更历史。
2. **`DES-rra-001` 结构返工 ×2**：先按评审意见新增「数据通路/控制通路实现概要 + 实现规划」与「端口/内部时序」；
   再按编码风格要求改实现描述（最终定为**不新增信号**、强关联同块）。
3. **RTL 风格返工 ×1**：由「一个大 `always_comb` 赋 11 个变量 + 三目」改为 4 条 `assign` + 4 个单变量
   `always_comb` + 1 个 `always_ff`；回归结果与改前完全一致（40/40、100.0%/96.9%）→ 行为等价。

### 2.4 回流到合同文件的内容（约定 #7）

| 文件 | 本轮改动 |
|---|---|
| `tools/templates/DES.template.md` | 新增「端口时序 / 内部时序 / 数据通路实现概要 / 控制通路实现概要 / 实现规划」骨架与列定义 |
| `tools/templates/RTL.template.sv` | 头部写明两条硬性风格；组合逻辑骨架改为「一信号一块」 |
| `tools/templates/VP.template.md`、`tools/templates/CHK.template.md` | 沿用（本阶段未改） |
| `.dsh/skills/spec-to-rtl-design/SKILL.md` | 「完善」判定扩到 12 条（含实现规划、时序已规划） |
| `.dsh/skills/spec-to-rtl-rtl/SKILL.md` | 编码要求第 1、2 条：一变量一块 / 强关联可同块 / 禁止嵌套三目 |
| `03-design/README.md` | 图件同名目录布局；修正原示例把 `04-rtl/...sv` 写进 ③ `artifacts` 的错误 |
| `standards/review-checklist.md` | §D 增 4 条（数据通路/控制通路/实现规划/时序图）；§E 增 2 条（分块风格 / 禁嵌套三目） |

### 2.5 图件与工具链

- `.tools/wdvenv`（**gitignored，换机需重建**）：`wavedrom` + 本地截图用 `cairosvg`；
  ```bash
  python3 -m venv .tools/wdvenv && .tools/wdvenv/bin/pip install wavedrom
  ```
- `REQ-001` 5 张端口时序图 + `DES-rra-001` 4 张内部时序图，图源 `.json` 与渲染 `.svg` 都放与产物**同名的目录**，
  两件都计入 `artifacts` 并入库。改图只改 `.json` 再重渲。

## 3. 当前门禁与追溯状态（诚实清单）

```bash
source .tools/env.sh         # 不 source 会让 doctor 把 verilator/yosys/verible/cocotb 全判 MISSING
python3 tools/sv.py gate all # 7 ok / 1 warn / 0 skip / 0 hard（唯一 warn：coding-standard 仍为 PLACEHOLDER）
python3 tools/sv.py trace    # 0 warn
```

`INDEX.md`：`REQ-001 → ARCH-001 → DES-rra-001 → TC-rra-001…008 → CHK-rra-001`，未覆盖清单为空；模块 `rr_arbiter`（短名 `rra`）。

## 4. 未完成 / 可选的后续

1. **补时序核验（唯一实质性遗留）**：装 OpenSTA 后对 `06-checks/reports/rr_arbiter/synth/rr_arbiter.netlist.v`
   做 `NUM_REQ=4`、10 ns 时钟的 STA，把结果回填 `CHK-rra-001` 的「频率」行；回填属内容变更，需重新放行 ⑥。
2. **补 `slang` 语义检查**：装 `slang` 后接入（当前 `sv.py` 未调用它）。
3. **团队编码规范**：`standards/coding-standard.md` 仍是 PLACEHOLDER；RTL 产物已标注依赖它。
4. **文档债**：`README.md`、`docs/setup/toolchain.md` 的部分环境事实待更新。
5. **CI**：按此前决定不做。

## 5. 已知的坑与风险

| 风险 | 说明 / 应对 |
|---|---|
| **模块骨架时序坑** | `new module` 会建 `04-rtl/<m>/`，而门禁要求「`04-rtl/` 存在 ⇒ 同模块有 approved 详设」；详设放行前 `gate 03/05` 必然 hard fail。**这是预期行为**：③ 要一次性走完「建骨架 → 写详设 → 人类放行」 |
| **同步复位波形坑** | 同步复位在 `rst_n` 拉低后的**第一个**上升沿生效；画 WaveDrom 时把 `rst_n` 的断言/释放沿放在上升沿**之前**，否则「边沿是否采到复位」有歧义（场景 4 曾因此错一拍） |
| **cocotb 2.1 没有 `cocotb.skip`** | 只有 `skipif` 装饰器；运行期条件跳过要么用等价替代用例，要么直接返回。另：`runner.test()` 前必须先 `runner.build()`（同一 runner 对象），否则报 `AttributeError: '_vhdl_sources'` |
| **参数/种子要经 `extra_env` 传给用例** | cocotb runner 的 `extra_env={"RR_NUM_REQ": …, "RR_SEED": …}`；用例侧读 `os.environ`。漏传会在用例里 `KeyError` |
| **构建产物放 `06-checks/reports/<m>/obj_dir/`** | 该路径已被 `.gitignore` 覆盖（`06-checks/reports/**/obj_dir/`），避免新增忽略规则；覆盖率 `.dat` 也放其下，只有 `cov/summary.json` 入库 |
| **yosys `ltp` 做不了时序代理** | 映射到 sky130 后 `ltp -noff` 与 `ltp` 都只报 `length=0`；时序结论只能靠 STA |
| **本机无 STA / slang** | `sta`/`opensta`/`slang` 均 MISSING；时序与 SV 语义检查为未执行项，见 `CHK-rra-001` |
| **`.tools/wdvenv` 不入库** | 换机必须重建（见 §2.5） |
| **门禁/doctor 需先 `source .tools/env.sh`** | 否则 verilator/yosys/verible/cocotb 全报 MISSING（实际都在 `.venv`/`.tools/eda`） |
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
| 时序核验（STA） | 本机无 OpenSTA；`CHK-rra-001` 已列补跑条件 |
| `slang` 未接线 | `doctor` 列为 MISSING，`sv.py` 从不调用 |
| 公司编码规范 | `standards/coding-standard.md` 仍是 PLACEHOLDER |
| 文档债 | `README.md`、`docs/setup/toolchain.md` 部分环境事实待更新 |
| CI | 按决定不做 |

## 7. 环境事实（2026-10-03 快照）

| 事实 | 值 / 影响 |
|---|---|
| 解释器 | 系统 `python3` 3.12.3；仓库 `.venv`（PyYAML 6.0.3、cocotb 2.1.0）。`sv.py` 用系统 `python3` 即可；`run_tests.py` 由 `gate 05` 以 `sys.executable` 调用 |
| EDA 工具 | `.tools/eda/bin`：verilator **5.052**（含 `verilator_coverage`）、verible（lint/format）、yosys **0.69**；另有 iverilog 12.0。**需 `source .tools/env.sh`** |
| 缺失工具 | `slang`、`sta`/`opensta`（→ 未执行项） |
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
| 2026-10-03 | 重写交接文档（①→⑥ 全链路已放行） | 本文件提交 |
