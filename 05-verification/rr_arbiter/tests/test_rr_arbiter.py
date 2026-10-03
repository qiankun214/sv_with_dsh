"""rr_arbiter 的 cocotb 用例（TC-rra-001 ~ TC-rra-008）。

用例与 `VP-rra-001-verification-plan.md` 的 `test_cases` 一一对应，
并在 `regress.yaml` 里有同名映射（gate 05 据此核对）。
每个断言都带拍号与实际值，失败可直接定位。
"""

from __future__ import annotations

import random

import cocotb

from tb.tb_rr_arbiter import (
    Golden,
    all_req,
    bit,
    fmt,
    num_req,
    run,
    start_env,
    step,
)

SEED = int(__import__("os").environ.get("RR_SEED", "20261003"))


@cocotb.test()
async def tc_rra_001_single_request_holds(dut):
    """TC-rra-001：单请求者持续请求时每拍授权同一位（F1/F4；REQ 场景 1）。"""
    n = num_req()
    idx = min(2, n - 1)  # NUM_REQ=4 时即 REQ 场景 1 的 req_i=0100
    req = bit(idx, n)
    await start_env(dut)
    obs = await run(dut, [(req, 1)] * 5)
    for i, (grant, valid) in enumerate(obs):
        assert valid == 1, f"第 {i} 拍 grant_valid_o 应为 1，实际 {valid}（req_i={fmt(req, n)}）"
        assert grant == req, (
            f"第 {i} 拍 grant_o 应为 {fmt(req, n)}（持续请求期间授权不变），实际 {fmt(grant, n)}"
        )


@cocotb.test()
async def tc_rra_002_full_request_round_robin(dut):
    """TC-rra-002：全部请求者持续请求时按轮询顺序循环授权（F2/F3；REQ 场景 2）。"""
    n = num_req()
    cycles = 2 * n
    await start_env(dut)
    obs = await run(dut, [(all_req(n), 1)] * cycles)
    for i, (grant, valid) in enumerate(obs):
        exp = bit(i % n, n)
        assert valid == 1, f"第 {i} 拍 grant_valid_o 应为 1，实际 {valid}"
        assert grant == exp, (
            f"第 {i} 拍应轮询到 index {i % n}（{fmt(exp, n)}），实际 {fmt(grant, n)}"
        )


@cocotb.test()
async def tc_rra_003_idle_hold(dut):
    """TC-rra-003：无请求时不授权且指针保持，恢复后从原指针继续（F5；REQ 场景 3）。

    前 6 拍逐拍复现 REQ-001 场景 3 的波形；后 4 拍再空转 3 拍后用「全请求」探针，
    证明空闲期间指针确实保持（而不是被复位回 index0）。
    """
    n = num_req()
    probe = bit(0, n) | bit(1, n)
    reqs = [probe, 0, 0, 0, bit(1, n), bit(1, n), 0, 0, 0, all_req(n)]
    await start_env(dut)

    golden = Golden(n)
    exp = []
    ptr_before_probe = 0
    for i, r in enumerate(reqs):
        if i == len(reqs) - 1:
            ptr_before_probe = golden.ptr
        exp.append(golden.step(r, 1))

    obs = await run(dut, [(r, 1) for r in reqs])
    for i, got in enumerate(obs):
        assert got == exp[i], (
            f"第 {i} 拍与黄金模型不符（req_i={fmt(reqs[i], n)}）："
            f"实际 {fmt(got[0], n)}/{got[1]}，模型 {fmt(exp[i][0], n)}/{exp[i][1]}"
        )
    for i in (1, 2, 3, 6, 7, 8):
        assert obs[i] == (0, 0), (
            f"空闲第 {i} 拍应 grant_o=0 且 grant_valid_o=0，实际 {fmt(obs[i][0], n)}/{obs[i][1]}"
        )
    assert obs[9] == (bit(ptr_before_probe, n), 1), (
        f"空闲后指针应保持在 index {ptr_before_probe}，实际授 {fmt(obs[9][0], n)}"
    )
    if n == 4:
        exp4 = [0b0001, 0b0000, 0b0000, 0b0000, 0b0010, 0b0010]
        got4 = [g for g, _ in obs[:6]]
        assert got4 == exp4, (
            f"与 REQ-001 场景 3 不一致：期望 {[format(v, '04b') for v in exp4]}，"
            f"实际 {[format(v, '04b') for v in got4]}"
        )


@cocotb.test()
async def tc_rra_004_reset_only_resets_pointer(dut):
    """TC-rra-004：复位只同步复位指针、不清零输出（F6/F8；REQ 场景 4）。"""
    n = num_req()
    req = all_req(n)
    await start_env(dut)
    await step(dut, req, 1)  # 预跑一拍，把指针推到 index1（复现场景 4 的中途状态）
    obs = await run(dut, [(req, 0), (req, 0), (req, 1), (req, 1), (req, 1)])

    assert obs[0] == (bit(1, n), 1), (
        f"复位断言前的第 0 拍应授 index1（{fmt(bit(1, n), n)}），实际 {fmt(obs[0][0], n)}/{obs[0][1]}"
    )
    # 复位断言期间输出不被清零
    assert obs[1][1] == 1 and obs[1][0] != 0, (
        f"复位断言期间 grant_o 不应被清零（F8），实际 {fmt(obs[1][0], n)}/{obs[1][1]}"
    )
    # 复位后的第一个上升沿把指针清零：应授 index0（若未复位，本应轮到 index2）
    assert obs[1][0] == bit(0, n), (
        f"复位后指针应被清零、授 index0，实际 {fmt(obs[1][0], n)}"
    )
    assert obs[2] == (bit(0, n), 1), f"释放前应继续授 index0，实际 {fmt(obs[2][0], n)}/{obs[2][1]}"
    # 释放后从索引 0 起正常轮询
    assert obs[3][0] == bit(1, n), f"释放后第 1 拍应授 index1，实际 {fmt(obs[3][0], n)}"
    if n == 4:
        # 与 REQ-001 场景 4 的端口波形逐拍一致
        exp = [0b0010, 0b0001, 0b0001, 0b0010, 0b0100]
        got = [g for g, _ in obs]
        assert got == exp, f"与 REQ-001 场景 4 不一致：期望 {[format(v,'04b') for v in exp]}，实际 {[format(v,'04b') for v in got]}"


@cocotb.test()
async def tc_rra_005_request_change(dut):
    """TC-rra-005：请求逐拍变化时的选择与回绕（F2/F3；REQ 场景 5）。

    `REQ-001` 场景 5 是 `NUM_REQ=4` 的定向波形；其余参数档退化为「单请求逐拍保持」
    的快速核对（该类行为在 TC-002/006/008 已有完整覆盖）。
    """
    n = num_req()
    await start_env(dut)
    if n != 4:
        req = bit(n - 1, n)
        obs = await run(dut, [(req, 1)] * 3)
        for i, (grant, valid) in enumerate(obs):
            assert (grant, valid) == (req, 1), (
                f"NUM_REQ={n} 的替代核对失败：第 {i} 拍应为 {fmt(req, n)}/1，"
                f"实际 {fmt(grant, n)}/{valid}"
            )
        return
    seq = [(0b0011, 1), (0b0010, 1), (0b1010, 1), (0b0000, 1), (0b1000, 1)]
    exp_grant = [0b0001, 0b0010, 0b1000, 0b0000, 0b1000]
    exp_valid = [1, 1, 1, 0, 1]
    obs = await run(dut, seq)
    for i, (grant, valid) in enumerate(obs):
        assert (grant, valid) == (exp_grant[i], exp_valid[i]), (
            f"与 REQ-001 场景 5 不一致：第 {i} 拍应为 {format(exp_grant[i],'04b')}/{exp_valid[i]}，"
            f"实际 {fmt(grant, n)}/{valid}"
        )


@cocotb.test()
async def tc_rra_006_interface_invariants_random(dut):
    """TC-rra-006：随机激励下的接口不变式 I1/I2/I3 与 DES 黄金模型（F7）。"""
    n = num_req()
    rng = random.Random(SEED)
    golden = Golden(n)
    await start_env(dut)
    for i in range(60):
        req = rng.randrange(0, 1 << n)
        rst_n = 0 if i in (17, 18) else 1  # 随机序列里也插一次复位断言
        grant, valid = await step(dut, req, rst_n)
        exp_grant, exp_valid = golden.step(req, rst_n)

        assert (grant & (grant - 1)) == 0, (
            f"I1 违反：第 {i} 拍 grant_o={fmt(grant, n)} 不是 one-hot 也不是全 0"
        )
        assert (grant != 0) == (valid == 1), (
            f"I2 违反：第 {i} 拍 grant_o={fmt(grant, n)} 与 grant_valid_o={valid} 不等价"
        )
        assert (grant & ~req) == 0, (
            f"I3 违反：第 {i} 拍授权了未请求者（grant_o={fmt(grant, n)}, req_i={fmt(req, n)}）"
        )
        assert (grant, valid) == (exp_grant, exp_valid), (
            f"第 {i} 拍与 DES 黄金模型不符：实际 {fmt(grant, n)}/{valid}，"
            f"模型 {fmt(exp_grant, n)}/{exp_valid}（req_i={fmt(req, n)}, rst_n={rst_n}）"
        )


@cocotb.test()
async def tc_rra_007_fairness_no_starvation(dut):
    """TC-rra-007：全部请求者持续请求时「趋于均等」——每 NUM_REQ 拍各授权一次（F2）。"""
    n = num_req()
    rounds = 4
    await start_env(dut)
    obs = await run(dut, [(all_req(n), 1)] * (rounds * n))
    grants = [g for g, _ in obs]
    assert all(v == 1 for _, v in obs), "全请求期间每拍都应有有效授权"
    for w in range(rounds):
        window = grants[w * n : (w + 1) * n]
        assert sorted(window) == sorted(bit(k, n) for k in range(n)), (
            f"第 {w} 个滑动窗口内未做到每个请求者各授权一次："
            f"{[fmt(g, n) for g in window]}"
        )
    counts = [grants.count(bit(k, n)) for k in range(n)]
    assert len(set(counts)) == 1, f"各请求者获得授权的次数不均等：{counts}"


@cocotb.test()
async def tc_rra_008_parameter_sweep_wrap(dut):
    """TC-rra-008：各参数档（含非 2 的幂）的回绕正确、永不越界（DES 边界条件）。"""
    n = num_req()
    req = all_req(n)
    await start_env(dut)
    obs = await run(dut, [(req, 1)] * (2 * n))
    grants = [g for g, _ in obs]
    for i, grant in enumerate(grants):
        assert (grant & ~req) == 0, (
            f"第 {i} 拍出现 >= NUM_REQ({n}) 的授权位：{fmt(grant, max(n, 4))}"
        )
        assert grant == bit(i % n, n), (
            f"第 {i} 拍应授 index {i % n}，实际 {fmt(grant, n)}（NUM_REQ={n}）"
        )
    last, first = bit(n - 1, n), bit(0, n)
    wrap_seen = any(
        grants[i] == last and grants[i + 1] == first for i in range(len(grants) - 1)
    )
    assert wrap_seen, f"未观察到 NUM_REQ-1({fmt(last, n)}) -> 0({fmt(first, n)}) 的回绕"
