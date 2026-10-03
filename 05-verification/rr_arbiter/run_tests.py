#!/usr/bin/env python3
"""rr_arbiter 自测入口 —— gate 05 的唯一执行契约（工作目录 = 本目录）。

做四件事：

1. 读 `regress.yaml`：得到 TC-* → cocotb 用例映射、参数档位、覆盖率档位；
2. 对每个参数档用 cocotb 的 Verilator runner 构建（只对覆盖率档加
   `--coverage-line --coverage-toggle`），再逐用例跑一遍 cocotb 回归；
3. 解析每个用例的 JUnit 结果，任一 failure/error 都计入失败；
4. 对覆盖率档把各用例的 `coverage.dat` 合并，调 `verilator_coverage --report summary`
   解析 line/toggle 百分比，写入 `06-checks/reports/rr_arbiter/cov/summary.json`。

退出码：0 = 全部通过；1 = 有用例失败/跳过构建/覆盖率无法产出。
构建产物放 `06-checks/reports/rr_arbiter/obj_dir/`（已被 .gitignore 覆盖）。
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml
from cocotb_tools.runner import get_runner

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MODULE = "rr_arbiter"
RTL_DIR = ROOT / "04-rtl" / MODULE
FLIST = RTL_DIR / f"{MODULE}.f"
REPORTS = ROOT / "06-checks" / "reports" / MODULE
BUILD_DIR = REPORTS / "obj_dir"
COV_DIR = REPORTS / "cov"
COV_DAT_DIR = BUILD_DIR / "cov"


def load_regress() -> dict:
    return yaml.safe_load((HERE / "regress.yaml").read_text(encoding="utf-8"))


def sources() -> list[Path]:
    out: list[Path] = []
    for line in FLIST.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if name and not name.startswith("#"):
            out.append(RTL_DIR / name)
    return out


def parse_results(xml_path: Path) -> tuple[bool, str]:
    """解析 cocotb 的 JUnit 结果；返回 (是否通过, 失败摘要)。"""
    if not xml_path.exists():
        return False, f"未生成结果文件 {xml_path}"
    try:
        tree = ET.parse(xml_path)
    except ET.ParseError as exc:
        return False, f"结果文件无法解析：{exc}"
    problems: list[str] = []
    for case in tree.iter("testcase"):
        for kind in ("failure", "error"):
            for node in case.findall(kind):
                text = (node.get("message") or node.text or "").strip().splitlines()
                problems.append(f"{case.get('name')}: {text[0] if text else kind}")
    return (not problems), "; ".join(problems)


def coverage_summary(dat_files: list[Path]) -> dict:
    """合并多个 coverage.dat 并解析 verilator_coverage 的 summary。"""
    COV_DIR.mkdir(parents=True, exist_ok=True)
    merged = COV_DAT_DIR / "coverage_merged.dat"
    subprocess.run(
        ["verilator_coverage", "--write", str(merged), *[str(p) for p in dat_files]],
        check=True,
        capture_output=True,
        text=True,
    )
    out = subprocess.run(
        ["verilator_coverage", "--report", "summary", str(merged)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    line = re.search(r"^\s*line\s*:\s*([\d.]+)%", out, re.M)
    toggle = re.search(r"^\s*toggle\s*:\s*([\d.]+)%", out, re.M)
    if not line or not toggle:
        raise RuntimeError(f"无法从 verilator_coverage 输出解析覆盖率：\n{out}")
    return {"line_pct": float(line.group(1)), "toggle_pct": float(toggle.group(1))}


def main() -> int:
    cfg = load_regress()
    tests: dict[str, str] = {str(k): str(v) for k, v in (cfg.get("tests") or {}).items()}
    params: list[int] = [int(p) for p in (cfg.get("params") or [4])]
    cov_param = int(cfg.get("coverage_param", params[0]))
    seed = int(cfg.get("seed", 1))
    top = str(cfg.get("toplevel", MODULE))
    srcs = sources()

    runner = get_runner("verilator")
    COV_DAT_DIR.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    cov_dats: list[Path] = []

    print(f"[info] 参数档位 {params}，覆盖率档位 NUM_REQ={cov_param}，用例 {len(tests)} 个")
    for param in params:
        build_dir = BUILD_DIR / f"n{param}"
        want_cov = param == cov_param
        build_args = ["--coverage-line", "--coverage-toggle"] if want_cov else []
        print(f"[build] NUM_REQ={param} -> {build_dir.relative_to(ROOT)}")
        runner.build(
            sources=srcs,
            hdl_toplevel=top,
            parameters={"NUM_REQ": param},
            build_dir=build_dir,
            always=True,
            build_args=build_args,
        )
        for tc_id, case_path in tests.items():
            case = case_path.split(".")[-1]
            xml = build_dir / f"results_{case}.xml"
            cov_dat = COV_DAT_DIR / f"coverage_n{param}_{case}.dat"
            plusargs = [f"+verilator+coverage+file+{cov_dat}"] if want_cov else []
            # 参数档位与种子通过环境变量传给 cocotb 用例（cocotb 侧读 os.environ）
            extra_env = {"RR_NUM_REQ": str(param), "RR_SEED": str(seed)}
            runner.test(
                test_module=case_path.rsplit(".", 1)[0],
                hdl_toplevel=top,
                parameters={"NUM_REQ": param},
                build_dir=build_dir,
                test_dir=HERE,
                testcase=case,
                seed=seed,
                plusargs=plusargs,
                extra_env=extra_env,
                results_xml=str(xml),
            )
            ok, why = parse_results(xml)
            print(f"[{'PASS' if ok else 'FAIL'}] NUM_REQ={param} {tc_id}")
            if not ok:
                failures.append(f"NUM_REQ={param} {tc_id}: {why}")
            if want_cov and cov_dat.exists():
                cov_dats.append(cov_dat)

    if cov_dats:
        cov = coverage_summary(cov_dats)
        COV_DIR.mkdir(parents=True, exist_ok=True)
        (COV_DIR / "summary.json").write_text(
            json.dumps(cov, indent=2) + "\n", encoding="utf-8"
        )
        print(f"[cov] line {cov['line_pct']}% / toggle {cov['toggle_pct']}% -> "
              f"{(COV_DIR / 'summary.json').relative_to(ROOT)}")
    else:
        failures.append("未产出任何 coverage.dat，无法生成覆盖率摘要")

    if failures:
        print("\n[FAIL] 回归未通过：")
        for item in failures:
            print(f"  - {item}")
        return 1
    print(f"\n[PASS] {len(tests)} 个用例 × {len(params)} 个参数档全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
