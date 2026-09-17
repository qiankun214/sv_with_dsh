---
name: spec-to-rtl-req
description: 阶段①功能点：把需求整理成一份 REQ-*.md 产物并通过 gate 01。当用户提出新功能、要澄清需求边界、或流程从零开始时使用。
---

# ① 功能点

产出**一份** `01-requirements/REQ-<nnn>-<slug>.md`，它是整条追溯链的源头，必须可被下游逐条引用。

## 步骤

```bash
python3 tools/sv.py new req --title "时钟域划分" --slug clk-domain
```

然后填写正文。写作要求：

| 小节 | 硬要求 |
|---|---|
| 功能描述 | 逐条编号（F1/F2…），每条是可验证的行为，不写「高性能」「灵活」这类不可判定词 |
| 约束 | 面积/功耗/时序/工艺都要有数字或明确的待定项 owner |
| 验收标准 | 每条 `AC-n` 都必须能被一个 `TC-*` 覆盖，写清「怎样算通过」 |
| non-goals | 至少写一条；不划边界，下游一定会自由发挥 |

同时把 `artifacts` 指向本阶段真实存在的支撑文件（框图、数据、参考文档），**不要填不存在的路径**。

## 自检

```bash
python3 tools/sv.py gate 01
python3 tools/sv.py trace --check
```

- 需求之间若有冲突：不要擅自裁决，列出来问用户。
- 需求若不可测：先问清楚「用什么观测手段判定通过」，再落笔。

## 完成定义

1. `gate 01` 无 hard fail；
2. 每条 AC 都有明确的观测方式；
3. 向用户请求放行（用 question 卡片列出 AC 与 non-goals 摘要）；
4. 用户同意后写入 `status: approved` + `reviewer` + `date`，再跑一次 `gate 01` 确认；
5. `python3 tools/sv.py trace` 更新 `INDEX.md`。

## 禁止

- 一个功能点拆成多份文件或把多条需求塞进一份文件（本仓约定：一功能点一文件）。
- 自行放行。
