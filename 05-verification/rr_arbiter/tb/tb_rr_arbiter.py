"""rr_arbiter 的 cocotb 驱动与检查器（⑤ 代码自测）。

本模块只放「驱动/工具/黄金模型」，用例在 `tests/test_rr_arbiter.py`：

- 时钟与复位、逐拍激励 `step()` / `run()`；
- 位向量小工具；
- `Golden`：按 `DES-rra-001` 的「数据通路实现概要 / 控制通路实现概要」写的
  Python 黄金模型（两段掩码优先级编码 + 指针推进 + **只复位指针**），
  供随机与参数档用例做参考比对。

逐拍时序约定（与 `DES-rra-001` 内部时序图一致）：
每个 `clk` 周期 = 10 ns；`step()` 在**下降沿**驱动 `req_i`/`rst_n`，
等待组合稳定后读取本拍输出；**下一个上升沿**按本拍的 `(req_i, rst_n)` 更新指针
（`rst_n == 0` 时指针被同步清零，且输出不被门控）。
"""

from __future__ import annotations

import os

import cocotb
from cocotb.clock import Clock
from cocotb.triggers import FallingEdge, RisingEdge, Timer

CLK_PERIOD_NS = 10  # 100 MHz，来自 REQ-001 约束
SETTLE_NS = 1  # 组合输出稳定等待


# --- 参数与位向量工具 ------------------------------------------------------
def num_req() -> int:
    """当前参数档位由 run_tests.py 通过环境变量注入。"""
    return int(os.environ["RR_NUM_REQ"])


def bit(idx: int, n: int | None = None) -> int:
    """返回第 idx 位为 1 的 one-hot 掩码。"""
    n = num_req() if n is None else n
    if not 0 <= idx < n:
        raise ValueError(f"索引 {idx} 超出 NUM_REQ={n} 的范围")
    return 1 << idx


def all_req(n: int | None = None) -> int:
    """全部请求者都请求。"""
    n = num_req() if n is None else n
    return (1 << n) - 1


def fmt(value: int, n: int | None = None) -> str:
    """按 NUM_REQ 位宽格式化成二进制串，便于失败诊断。"""
    n = num_req() if n is None else n
    return format(value, f"0{n}b")


def lowest_set_index(value: int) -> int:
    """最低有效 1 的索引；输入为 0 时返回 0（与 RTL 的优先编码零输入口径一致）。"""
    if value == 0:
        return 0
    return (value & -value).bit_length() - 1


# --- DES-rra-001 黄金模型 ---------------------------------------------------
class Golden:
    """`DES-rra-001` 的行为模型（只描述接口可观测行为）。"""

    def __init__(self, n: int, ptr: int = 0):
        self.n = n
        self.ptr = ptr

    def step(self, req: int, rst_n: int = 1) -> tuple[int, int]:
        """吃进本拍激励，返回 (grant_o, grant_valid_o)，并按 RTL 顺序推进指针。

        指针推进顺序与 RTL 一致：上升沿先看同步复位（`rst_n == 0` → 0），
        否则装次态（有授权时推进到被授权者下家，末位回绕到 0；无请求保持）。
        """
        n = self.n
        mask_lo = (1 << self.ptr) - 1
        req_hi = req & ~mask_lo & all_req(n)
        sel_idx = lowest_set_index(req_hi) if req_hi else lowest_set_index(req)
        valid = 1 if req else 0
        grant = bit(sel_idx, n) if valid else 0

        if rst_n == 0:
            self.ptr = 0
        elif valid:
            self.ptr = 0 if sel_idx == n - 1 else sel_idx + 1
        return grant, valid


# --- 时钟、复位与逐拍激励 ---------------------------------------------------
async def start_env(dut, reset_cycles: int = 3) -> None:
    """启动时钟、把输入拉 0、复位 DUT；返回时复位已释放且指针为 0。"""
    dut.rst_n.value = 0
    dut.req_i.value = 0
    cocotb.start_soon(Clock(dut.clk, CLK_PERIOD_NS, unit="ns").start())
    for _ in range(reset_cycles):
        await RisingEdge(dut.clk)
    await FallingEdge(dut.clk)
    dut.rst_n.value = 1


async def step(dut, req: int, rst_n: int = 1) -> tuple[int, int]:
    """驱动一拍激励并返回该拍观测到的 (grant_o, grant_valid_o)。"""
    await FallingEdge(dut.clk)
    dut.req_i.value = req
    dut.rst_n.value = rst_n
    await Timer(SETTLE_NS, unit="ns")
    return int(dut.grant_o.value), int(dut.grant_valid_o.value)


async def run(dut, seq) -> list[tuple[int, int]]:
    """按 seq = [(req_i, rst_n), ...] 逐拍驱动，返回逐拍观测列表。"""
    obs = []
    for req, rst_n in seq:
        obs.append(await step(dut, req, rst_n))
    return obs
