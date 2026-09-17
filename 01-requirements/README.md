# ① 功能点（Requirements）

**放什么**：项目要做什么，以「一个功能点一份文件」为单位。这是整条追溯链的源头。

## 命名

```
REQ-001-clk-domain.md
REQ-002-burst-split.md
```

- ID：`REQ-<三位序号>`，全仓唯一，**永不复用**。
- 文件名 = `ID + kebab 短描述`，排序即 ID 顺序。
- 新建：`python3 tools/sv.py new req --title "时钟域划分" --slug clk-domain`

## front-matter（必填）

```yaml
---
id: REQ-001
title: 时钟域划分
status: draft            # draft | in_review | approved | superseded
owner: agent
reviewer:                # approved 时必填（人类）
date:                    # approved 时必填
upstream: []             # 功能点是源头，允许为空
artifacts: []
---
```

## 正文该写什么

| 小节 | 要求 |
|---|---|
| 背景与目标 | 为什么需要这个功能点，解决什么问题 |
| 功能描述 | 可验证的行为描述，避免「高性能」这类不可判定的词 |
| 接口/交互 | 与外部世界的边界（信号、协议、时序约束的**需求级**描述） |
| 约束 | 面积/功耗/时序/工艺约束 |
| 验收标准 | 每条都要能被 ⑤ 阶段的测试点覆盖，写清「怎样算通过」 |
| 不做的事 | 明确的 non-goals，防止下游自由发挥 |

## 门禁

```bash
python3 tools/sv.py gate 01
```

- hard fail：front-matter 字段缺失/非法、ID 重复、`artifacts` 指向不存在的文件。
- warn：本阶段暂无产物；上游覆盖为空。

## 放行

人类评审后把 `status` 改为 `approved` 并填写 `reviewer`、`date`。**只有 approved 才能被 ② 系统方案引用。**
