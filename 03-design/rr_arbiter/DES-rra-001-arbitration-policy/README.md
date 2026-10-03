# DES-rra-001 轮询仲裁策略 — 内部时序图目录

本目录与 `../DES-rra-001-arbitration-policy.md` **同名**，存放该详设的**内部时序图**：
**WaveDrom 图源（`.json`，唯一事实源）+ 渲染产物（`.svg`）**。属于**样例数据**（spec-to-RTL 流程演示）。

## 布局约定

- **端口时序不在本目录**：端口级时序以 `REQ-001` 硬件接口的 5 个场景为唯一权威；
  本目录只画 **③ 新增的内部信号**（端口保留作为时间基准）。
- 一个场景一对同名文件（`internal-N-<场景名>.json` ↔ `.svg`），改图只改 `.json` 再重渲，两者必须同步提交，并列入详设 front-matter 的 `artifacts`。
- 图内信号 = 端口 + 主要内部信号（`ptr_q` / `mask_lo` / `req_hi` / `idx_hi` / `idx_lo` / `sel_idx` / `wrap_hit` / `ptr_d`），参数取 `NUM_REQ=4`。

## 文件

| 图源 | 渲染产物 | 场景 |
|---|---|---|
| `internal-1-round-robin.json` | `internal-1-round-robin.svg` | 连续请求（`req_i=1111`）下的轮询推进与回绕 |
| `internal-2-idle-hold.json` | `internal-2-idle-hold.svg` | 空闲（`req_i=0`）指针保持与恢复、回绕段选择 |
| `internal-3-reset-pointer.json` | `internal-3-reset-pointer.svg` | 复位只同步复位指针、输出不被清零 |
| `internal-4-request-change.json` | `internal-4-request-change.svg` | 请求逐拍变化与回绕 |

## 渲染

```bash
# 一次性准备（用户态，不污染仓库依赖）：
python3 -m venv .tools/wdvenv && .tools/wdvenv/bin/pip install wavedrom

# 对每张图（路径均相对仓根；本目录即 03-design/rr_arbiter/DES-rra-001-arbitration-policy/）：
.tools/wdvenv/bin/wavedrompy -i 03-design/rr_arbiter/DES-rra-001-arbitration-policy/internal-1-round-robin.json \
                             -s 03-design/rr_arbiter/DES-rra-001-arbitration-policy/internal-1-round-robin.svg
```

## 记法与坑（与 `REQ-001` 图件目录一致）

1. **bit 信号不要重复写同一个值，要用 `.` 保持**（同一值连写会渲染出假 V 形毛刺）；bus 状态用 `"2.2.2.2."` 天然保持。
2. **图内文字只用 ASCII**（渲染环境可能无中文字库）；完整中文说明写在详设正文里。
3. **标题/脚注会被画布宽度截断**：统一 `hscale: 1.8`，文案 ≤ ~60 字符。
4. 每 2 个 tick = 1 个 `clk` 周期；寄存器 `ptr_q` 在上升沿（偶数 tick）更新，组合信号（`mask_lo` / `req_hi` / `idx_*` / `sel_idx` / `wrap_hit` / `ptr_d` / `grant_o` / `grant_valid_o`）与同拍的 `req_i` 和 `ptr_q` 对应。
5. `idx_hi` / `idx_lo` 在输入全 0 时编码为 `0`，该值被 `req_hi != 0` 的选择条件屏蔽，不影响 `sel_idx`。
