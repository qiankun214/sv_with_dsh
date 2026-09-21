# REQ-001 轮询仲裁 — 图件目录

本目录与 `../REQ-001-rr-arbitration.md` **同名**，存放该 REQ 的全部图件：**WaveDrom 图源（`.json`，唯一事实源）+ 渲染产物（`.svg`，供评审直接查看）**。
属于**样例数据**（spec-to-RTL 流程演示）。

## 布局约定

- 每个 REQ 的图件放 `<阶段>/<REQ 文件名去扩展名>/`，与本 REQ 的 `.md` 同名、同级；
- 图源 `.json` 与渲染产物 `.svg` **同放这一个目录**，两件都入库并列入该 REQ front-matter 的 `artifacts`；
- 一个场景一对同名文件（`scenario-N-<场景名>.json` ↔ `.svg`），改图只改 `.json` 再重渲，两者必须同步提交。

## 文件

| 图源 | 渲染产物 | 对应场景 |
|---|---|---|
| `scenario-1-single-request.json` | `scenario-1-single-request.svg` | 单请求者持续请求 `req_i=4'b0100` |
| `scenario-2-round-robin.json` | `scenario-2-round-robin.svg` | 四请求者持续请求 `req_i=4'b1111`，授权在 4 个 bit 间轮转 |
| `scenario-3-idle-pointer-hold.json` | `scenario-3-idle-pointer-hold.svg` | 请求全 0 期间不授权，随后恢复 |
| `scenario-4-reset.json` | `scenario-4-reset.svg` | 复位断言（`req_i` 仍有效）与释放 |
| `scenario-5-request-change.json` | `scenario-5-request-change.svg` | 请求逐周期变化 |

> 图里**只画端口信号**（`clk` / `rst_n` / `req_i` / `grant_o` / `grant_valid_o`），不放任何内部状态——
> 接口协议只描述接口，内部实现与「为什么给这个授权」属于 `REQ-001` 的「功能描述」。

## 渲染

```bash
# 一次性准备（用户态，不污染仓库依赖）：
python3 -m venv .tools/wdvenv && .tools/wdvenv/bin/pip install wavedrom

# 对每张图（路径均相对仓根；本目录即 01-requirements/REQ-001-rr-arbitration/）：
.tools/wdvenv/bin/wavedrompy -i 01-requirements/REQ-001-rr-arbitration/scenario-2-round-robin.json \
                             -s 01-requirements/REQ-001-rr-arbitration/scenario-2-round-robin.svg
```

## 本仓踩过的三个坑（改图时必须遵守）

1. **bit 信号不要重复写同一个值，要用 `.` 保持。**
   WaveDrom 的 Python 渲染器对 `"1100001111"` 这种「同一值连写」会在每个 tick 交界画出假的 V 形毛刺
   （波形看起来像有脉冲）。正确写法是 `"1.0...1..."`——只在**电平变化**处写新值，其余用 `.` 保持。
   bus 状态（`"2.2.2.2."`）本身就用 `.` 保持，不受影响。
2. **图内文字只用 ASCII（英文）。**
   渲染环境不一定有中文字库（本机 `cairosvg` 渲染时中文变成方框）。场景的完整中文说明写在
   `../REQ-001-rr-arbitration.md` 正文里，图内只放简短的英文标签。
3. **标题/脚注会被画布宽度截断。**
   画布宽度由 tick 数 × `hscale` 决定；`head`/`foot` 过长会被裁掉。本目录统一用 `hscale: 1.8`，
   文案控制在 ~60 字符内。

## 记法

- 每个 `clk` 周期 = 2 个 tick；图中顶部数字是 tick 序号，相邻两个 tick 构成一拍。
- 图内**只画端口信号**，不含内部状态；内部实现（指针、算法、公平性）不在接口协议范围内。
- 波形是需求级接口契约（如「输出以 `clk` 为基准有效」「复位期强制 0」「无请求不授权」），不约束实现细节。
