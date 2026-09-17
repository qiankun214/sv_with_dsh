---
name: spec-to-rtl
description: spec-to-RTL 编排技能：把功能点一路推进到 lint/综合检查，在每个人工放行关口停下等签核。当用户说「从功能点做到底」「推进这个需求」「跑完整流程」时使用。
---

# spec-to-RTL 编排

把一条（或一组）功能点从 ① 推到 ⑥，**每个放行关口都必须停下来等人签核**。

## 开始前必读

1. `AGENTS.md` —— 铁律、ID 规则、front-matter 契约、门禁强度。它与本技能冲突时，以 `AGENTS.md` 为准。
2. `INDEX.md` —— 当前追溯状态与未覆盖清单（没有就先跑 `python3 tools/sv.py trace`）。
3. `standards/coding-standard.md` —— 若仍是 PLACEHOLDER，向用户说明「RTL 将依据占位规范」。

## 流程

```bash
python3 tools/sv.py doctor          # 先确认工具与 PDK 状态，把 skip 项告诉用户
python3 tools/sv.py trace           # 拿到当前覆盖矩阵
```

然后按顺序逐阶段推进；每一阶段**加载对应技能**（`spec-to-rtl-req/arch/design/rtl/verify/check`），不要在本技能里凭记忆代替它们：

| 阶段 | 技能 | 门禁 | 输出 |
|---|---|---|---|
| ① 功能点 | `spec-to-rtl-req` | `gate 01` | `REQ-*` |
| ② 系统方案 | `spec-to-rtl-arch` | `gate 02` | `ARCH-*` |
| ③ 详细设计 | `spec-to-rtl-design` | `gate 03` | `DES-*` / `REGMAP-*` / `IFACE-*` |
| ④ RTL | `spec-to-rtl-rtl` | `gate 04 --module M` | `04-rtl/M/*` |
| ⑤ 自测 | `spec-to-rtl-verify` | `gate 05 --module M` | `VP-*` + cocotb |
| ⑥ 检查 | `spec-to-rtl-check` | `gate 06 --module M` | `CHK-*` + 报告 |

## 人工放行关口（必须停）

在下列位置**用 `ask_user_question` 停下**，把该阶段的关键结论与评审要点列给用户，让用户决定是否放行；**不得**自行把 `status` 改成 `approved`，也不得代填 `reviewer`：

- ① 功能点写完（验收标准是否可测？non-goals 是否清楚？）
- ② 系统方案写完（模块划分与预算是否认可？）
- ③ 详细设计写完（端口表与 FSM 是否可作为 RTL 契约？）
- ⑤ 自测计划与回归结果（覆盖率是否接受？）
- ⑥ 检查结论（面积/告警/waiver 是否接受？）

④ 阶段不需要单独关口，它的放行体现在 ③ 的 approved 上（RTL 必须建立于已放行的详设）。

用户放行时：把 `status: approved` + `reviewer` + `date` 写入 front-matter（这是唯一合法的放行动作），然后重跑门禁确认。

## 每阶段收尾

```bash
python3 tools/sv.py gate <stage> [--module M]
python3 tools/sv.py trace            # 更新 INDEX.md（必须入库）
```

- hard fail：立刻修，不要继续推进；也不要用 waiver 掩盖（waiver 不能豁免结构与追溯）。
- soft warn（lint/覆盖率/综合）：记录下来，进入 ⑥ 的 `CHK-*`；要不要修由用户决定。
- skip（工具缺失）：在最终交付摘要里逐条列出，不要假装跑过。

## 结束时的交付摘要（必须包含）

1. 本次新增/修改的产物清单（含 ID）；
2. `INDEX.md` 里该功能点这一行的覆盖链（REQ→ARCH→DES→TC→CHK）；
3. **未执行项**：哪些检查因工具/PDK 缺失被 skip，以及补跑命令；
4. 仍为 `draft`/`in_review` 的产物（即尚未放行的部分）。

## 禁止

- 跳过任何阶段；跳过就是断链，门禁也会拦。
- 伪造放行（自己写 `reviewer` / `date`）。
- 改 `tools/sv.py`、`06-checks/cfg/*`、`standards/review-checklist.md` 来让门禁通过。
- 在 `06-checks/reports/` 下提交波形/网表等大产物。
