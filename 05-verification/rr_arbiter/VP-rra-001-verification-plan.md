---
id: VP-rra-001
title: 轮询仲裁器验证计划
status: approved
owner: agent
reviewer: qiankun214（样例评审）
date: 2026-10-03
upstream: [DES-rra-001]
artifacts:
  - 05-verification/rr_arbiter/regress.yaml
  - 05-verification/rr_arbiter/run_tests.py
  - 05-verification/rr_arbiter/tb/tb_rr_arbiter.py
  - 05-verification/rr_arbiter/tests/test_rr_arbiter.py
test_cases:
  - id: TC-rra-001
    covers: [REQ-001]
    desc: 单请求者持续请求时每拍授权同一位（F1/F4，REQ 场景 1）
  - id: TC-rra-002
    covers: [REQ-001]
    desc: 全部请求者持续请求时按轮询顺序循环授权（F2/F3，REQ 场景 2）
  - id: TC-rra-003
    covers: [REQ-001]
    desc: 无请求时不授权且指针保持，恢复后从原指针继续（F5，REQ 场景 3）
  - id: TC-rra-004
    covers: [REQ-001]
    desc: 复位只同步复位指针、不清零输出（F6/F8，REQ 场景 4）
  - id: TC-rra-005
    covers: [REQ-001]
    desc: 请求逐拍变化时的选择与回绕（F2/F3，REQ 场景 5；N=4 定向波形，其余档位为等价快速核对）
  - id: TC-rra-006
    covers: [REQ-001]
    desc: 随机激励下的接口不变式 I1/I2/I3 与 DES 黄金模型逐拍一致（F7）
  - id: TC-rra-007
    covers: [REQ-001]
    desc: 全部请求者持续请求时不饿死：每 NUM_REQ 拍各授权一次（F2 量化）
  - id: TC-rra-008
    covers: [REQ-001]
    desc: 参数档位 2/3/4/5/8（含非 2 的幂）的回绕正确且授权位永不越界（DES 边界条件）
---

# VP-rra-001 轮询仲裁器验证计划

> 模块：`rr_arbiter`　短名：`rra`　上游：`DES-rra-001`（已 approved）

> 本产物是 ⑤ 阶段的**验证计划**：把「什么算通过」从 `REQ-001` 的 `F1~F8`、接口不变式 `I1~I3`
> 与 5 个时序场景**扇出**成验收标准与 `TC-*` 测试点。接口契约以 `REQ-001` 为唯一权威、
> 内部结构以 `DES-rra-001` 为唯一权威，本文**不复述**它们的行为描述，只写验收判据与用例映射。

## 验证范围与策略

- **测什么**：`rr_arbiter` 顶层黑盒（`ARCH-001` 定的验证深度）——从端口驱动 `req_i`/`rst_n`，观测 `grant_o`/`grant_valid_o`。
- **不测什么**：不测 RTL 内部信号（不做白盒/覆盖率驱动的定向补点，只按端口判据断言）；不测 `NUM_REQ<2/>8`（`DES-rra-001` 写明这是 elaboration 期 `$error` 行为，**不可用激励覆盖**，由 ④ 的静态检查核对）；不测背压/流控（`REQ-001` non-goals，接口无此类信号）。
- **策略**：**定向为主**——5 个 REQ 时序场景 + 空闲/复位/参数档边界各一条用例；
  再加 1 条**固定种子**的随机用例，用 `DES-rra-001` 的 Python 黄金模型逐拍比对并检查 `I1~I3`。
  随机种子固定在 `regress.yaml`（`seed: 20261003`），保证可复现。
- **与 ⑥ 的分工**：本阶段测**功能正确性**；lint/综合/覆盖率的「质量结论」在 ⑥ 的 `CHK-*` 汇总。
- **与 ④ 的分工**：④ 已做静态检查（verilator `-Wall` 在 `NUM_REQ=2/3/4/5/8` 下 0 警告、`NUM_REQ=1` 如期报错、Yosys 可读入展开、verible lint/format 通过）。

## 验收标准（从 REQ 扇出）

| 验收标准 | 来源（F* / 接口不变式 / 时序场景） | 激励 | 观测点 | 量化判据 | 对应 TC-* |
|---|---|---|---|---|---|
| AC-1 | F1（至多授权一个，one-hot） | 定向（单/全请求）+ 随机 | `grant_o` | 每拍 `grant_o` 为 one-hot 或全 0；`grant_valid_o=1` 时恰有 1 位 | TC-rra-001 / 002 / 006 |
| AC-2 | F2（指针起点优先、其后循环降低） | 全请求、逐拍变化、非 2 幂档 | `grant_o` 序列 | 每拍选中「从指针起循环扫描到的第一个有效请求位」；与黄金模型一致 | TC-rra-002 / 005 / 006 / 008 |
| AC-3 | F3（授权后推进到被授权者下家） | 全请求连续多拍 | `grant_o` 序列 | 连续 `NUM_REQ` 拍内命中索引严格递增，末位后回绕到 0 | TC-rra-002 / 007 |
| AC-4 | F4（授权可连续，不强制空档） | 单请求持续请求 | `grant_o`/`grant_valid_o` | 持续请求期间每拍 `grant_valid_o=1` 且授权位不变 | TC-rra-001 |
| AC-5 | F5（无请求不授权、指针保持） | 含 3 拍空闲的序列 | 输出 + 空闲后首拍 | 空闲期间输出全 0；空闲后按**保持的**指针授权（不回到 index0） | TC-rra-003 |
| AC-6 | F6（复位释放后指针指向索引 0） | 复位断言 + 释放 | 释放后首拍授权 | 释放后按索引 0 优先，随后正常轮询 | TC-rra-004 |
| AC-7 | F7（输出由输入与状态唯一确定） | 随机序列（含一次复位断言） | 同拍输出 | 与黄金模型逐拍一致，无第三态、无振荡 | TC-rra-006 |
| AC-8 | F8（复位只同步复位指针、不清零输出） | 复位断言期间的 `req_i` 全 1 | 断言期间的输出 + 复位后指针 | 断言期间 `grant_o != 0` 且 `grant_valid_o=1`；复位后指针被清零（授权回到索引 0） | TC-rra-004 |
| AC-9 | I1（`grant_o & (grant_o-1) == 0`） | 随机 + 定向 | `grant_o` | 每拍成立 | TC-rra-006 |
| AC-10 | I2（`grant_o != 0 ⟺ grant_valid_o == 1`） | 随机 + 定向 | `grant_o`/`grant_valid_o` | 每拍等价成立 | TC-rra-006 |
| AC-11 | I3（`(grant_o & ~req_i) == 0`） | 随机 + 定向 | `grant_o`/`req_i` | 每拍成立（不授权未请求者） | TC-rra-006 |
| AC-12 | 场景 1（`req_i=0100` 持续） | 定向 | 逐拍端口 | 与 `REQ-001` 场景 1 一致：`grant_o` 恒 `0100`、`grant_valid_o` 恒 1 | TC-rra-001 |
| AC-13 | 场景 2（`req_i=1111`） | 定向 | 逐拍端口 | 与 `REQ-001` 场景 2 一致：`0001→0010→0100→1000→0001` | TC-rra-002 |
| AC-14 | 场景 3（请求全 0 与恢复） | 定向 | 逐拍端口 | 与 `REQ-001` 场景 3 一致：`0001,0000,0000,0000,0010,0010` | TC-rra-003 |
| AC-15 | 场景 4（复位断言与释放） | 定向 | 逐拍端口 | 与 `REQ-001` 场景 4 一致：`0010,0001,0001,0010,0100`（断言期间输出不清零） | TC-rra-004 |
| AC-16 | 场景 5（请求逐拍变化） | 定向 | 逐拍端口 | 与 `REQ-001` 场景 5 一致：`0001,0010,1000,0000,1000` | TC-rra-005 |
| AC-17 | F2「持续请求者获得服务的次数趋于均等」（量化） | 全请求 4 轮 | 滑动窗口 | 任意连续 `NUM_REQ` 拍内每个请求者**恰好授权一次**；4 轮内各请求者计数相等 | TC-rra-007 |
| AC-18 | `DES-rra-001` 边界：非 2 的幂与参数极值 | `NUM_REQ=2/3/5/8` 全请求 | `grant_o` 序列 | 回绕发生在 `NUM_REQ-1 → 0`；任何拍都不出现 ≥ `NUM_REQ` 的授权位 | TC-rra-008 |

## 测试点清单

| 测试点 | 覆盖的功能点 | 描述 | 预期 |
|---|---|---|---|
| TC-rra-001 | `REQ-001` | 单请求者持续请求（`req_i` 只置 index `min(2,N-1)`，`N=4` 即场景 1 的 `0100`） | 每拍 `grant_o` = 该位、`grant_valid_o=1` |
| TC-rra-002 | `REQ-001` | 全请求持续 `2*NUM_REQ` 拍 | `grant_o` 每拍 one-hot 且索引按 `0,1,…,N-1` 循环 |
| TC-rra-003 | `REQ-001` | 前 6 拍复现场景 3；再空转 3 拍后用全请求探针 | 空闲输出全 0；探针从**保持的**指针起授权 |
| TC-rra-004 | `REQ-001` | 预跑一拍把指针推到 index1，再按场景 4 的 `rst_n` 时序跑 5 拍 | 与场景 4 逐拍一致；断言期间输出不清零、复位后指针清零 |
| TC-rra-005 | `REQ-001` | `req_i` 逐拍 `0011→0010→1010→0000→1000`（`NUM_REQ=4` 的定向波形） | 与场景 5 逐拍一致；其余档位退化为「单请求逐拍保持」的等价快速核对（完整覆盖见 TC-rra-002/006/008） |
| TC-rra-006 | `REQ-001` | 固定种子随机 `req_i` 60 拍，第 17/18 拍插入复位断言 | 每拍 `I1/I2/I3` 成立，且与黄金模型逐拍一致 |
| TC-rra-007 | `REQ-001` | 全请求 `4*NUM_REQ` 拍 | 每个 `NUM_REQ` 长滑窗都是全排列；各请求者计数相等 |
| TC-rra-008 | `REQ-001` | 各参数档全请求 `2*NUM_REQ` 拍 | 序列为 `0,1,…,N-1` 循环；观察到 `N-1→0` 回绕；无越界位 |

## 边界与异常

对照 `DES-rra-001`「边界条件」逐条落点：

| 边界场景（`DES-rra-001`） | 对应 TC-* |
|---|---|
| `req_i` 全 0（不授权、指针保持） | TC-rra-003 |
| 同时多个请求（指针起点优先 + 回绕） | TC-rra-002 / 005 / 006 |
| 请求在授权当拍撤销 | TC-rra-005 / 006 |
| 被授权者持续请求（连续授权） | TC-rra-001 / 002 |
| 参数极值 `NUM_REQ=2` / `NUM_REQ=8` | TC-rra-008（参数扫描含 2/8） |
| 非 2 的幂 `NUM_REQ=3/5` | TC-rra-008（参数扫描含 3/5） |
| 非法参数 `NUM_REQ<2` 或 `>8` | **无 TC**：`DES-rra-001` 定义为 elaboration 期 `$error`，不可用激励覆盖；由 ④ 静态检查核对（已实测 Verilator 退出码 1、Yosys 报 `ERROR`） |
| 背压 / 流控 | 不适用：接口无背压信号（`REQ-001` non-goals） |
| 复位断言期间的输入 | TC-rra-004（断言期间 `req_i` 全 1） |

## 覆盖率目标

| 指标 | 目标 | 依据 |
|---|---|---|
| 行覆盖 | ≥ 80% | `regress.yaml` 的 `coverage.line_warn` |
| 翻转覆盖 | ≥ 60% | `regress.yaml` 的 `coverage.toggle_warn` |
| 需求覆盖 | 100%（`REQ-001` 至少被一个 `TC-*` 覆盖） | 8 个 `TC-*` 全部 `covers: [REQ-001]` |
| 参数档位 | `NUM_REQ=2/3/4/5/8` | `ARCH-001` 回归档 2/4/8 + `DES-rra-001` 非 2 幂边界 3/5 |
| 覆盖率口径 | 只统计 `NUM_REQ=4` 档 | 多档合并会混淆不同参数下的分支（VP 口径，`regress.yaml` 的 `coverage_param`） |

## 运行方式

```bash
source .tools/env.sh                            # 让 verilator/cocotb/make/g++ 进入 PATH
python3 tools/sv.py gate 05 --module rr_arbiter # gate 05 只执行 run_tests.py
```

`run_tests.py`（gate 05 的唯一执行契约）按 `regress.yaml` 构建并逐用例运行 cocotb，
把覆盖率写到 `06-checks/reports/rr_arbiter/cov/summary.json`；
构建产物落在 `06-checks/reports/rr_arbiter/obj_dir/`（已被 `.gitignore` 覆盖，不入库）。

## 变更历史

| 日期 | 变更 | 影响 |
|---|---|---|
| 2026-10-03 | 初稿：由 ⑤ `grill-me` 讨论产出——定向为主 + 1 条固定种子随机用例；8 个 `TC-*`；参数档 `2/3/4/5/8`；覆盖率只对 `NUM_REQ=4` 采、阈值 80/60；断言只写在 cocotb 侧 | 回归实现（`regress.yaml`/`run_tests.py`/`tb`/`tests`）按本计划落地 |
| 2026-10-03 | **人类放行**：`status: approved`，`reviewer: qiankun214（样例评审）`（样例数据，如实标注为样例评审，非真实项目评审记录）。放行时回归为 8 用例 × 5 参数档 = 40/40 通过，覆盖率 line 100.0% / toggle 96.9%（④ 按新编码风格重写 RTL 后复跑，结果与重写前一致） | 解锁 ⑥ 检查汇总；`REQ-001` 的需求覆盖由 `TC-rra-001~008` 完成 |
