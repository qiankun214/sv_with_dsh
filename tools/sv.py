#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sv.py —— spec-to-RTL 仓库的唯一入口（门禁 / 追溯 / 建产物 / 环境自检）。

用法：
    python3 tools/sv.py doctor
    python3 tools/sv.py new <req|arch|module|des|regmap|iface|rtl|vp|chk> ...
    python3 tools/sv.py gate <01|02|03|04|05|06|all> [--module M] [--strict] [--dry-run]
    python3 tools/sv.py trace [--check] [--strict]

设计约束（与 AGENTS.md 对齐）：
  * 依赖只有 Python 3 与 PyYAML；不需要 make，不需要 pip 安装任何东西。
  * 结构与追溯断链 = hard fail；lint/综合/覆盖率 = soft warn（--strict 升级）；工具缺失 = skip。
  * 任何调用外部工具的地方都必须支持 --dry-run（只打印命令，不执行）。

注意：04/05/06 三条工具链（verilator / yosys / cocotb）的具体命令集中在本文件
      「工具接线」一节，并在 docs/setup/toolchain.md 里有对应的安装说明。
      这些命令在未安装工具的环境下只会被 skip 或 dry-run，不会执行。
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional

# ---------------------------------------------------------------------------
# 路径与常量
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "tools" / "templates"
CHECKS = ROOT / "06-checks"
CFG = CHECKS / "cfg"
REPORTS = CHECKS / "reports"
WAIVERS = CHECKS / "waivers"
STANDARDS = ROOT / "standards"
PLACEHOLDER_MARK = "PLACEHOLDER"

STAGE_DIRS = {
    "01": "01-requirements",
    "02": "02-architecture",
    "03": "03-design",
    "04": "04-rtl",
    "05": "05-verification",
    "06": "06-checks",
}
STAGE_TITLE = {
    "01": "功能点",
    "02": "系统方案",
    "03": "详细设计",
    "04": "RTL 编写",
    "05": "代码自测",
    "06": "检查汇总",
}
# 每个阶段允许的产物 ID 前缀
STAGE_PREFIX = {
    "01": ("REQ",),
    "02": ("ARCH",),
    "03": ("DES", "REGMAP", "IFACE"),
    "05": ("VP",),
    "06": ("CHK",),
}
# 每个阶段允许的上游 ID 前缀
UPSTREAM_PREFIX = {
    "01": (),
    "02": ("REQ",),
    "03": ("ARCH",),
    "04": ("DES", "REGMAP", "IFACE"),
    "05": ("DES", "REGMAP", "IFACE"),
    "06": ("VP", "DES", "REGMAP", "IFACE"),
}
MODULE_STAGES = ("03", "04", "05", "06")
REQUIRED_KEYS = ("id", "title", "status", "owner", "upstream", "artifacts")
STATUSES = ("draft", "in_review", "approved", "superseded")

PROJ_ID_RE = re.compile(r"^(REQ|ARCH)-\d{3}$")
MOD_ID_RE = re.compile(r"^(DES|REGMAP|IFACE|VP|TC|CHK)-([a-z][a-z0-9_]{1,7})-(\d{3})$")
SHORT_RE = re.compile(r"^[a-z][a-z0-9_]{1,7}$")

DEFAULT_THRESHOLDS = {
    "coverage": {"line_warn": 80, "toggle_warn": 60, "require_req_coverage": True},
    "lint": {"max_warnings": 0, "max_style_warnings": 0},
    "synth": {"area_warn_cells": 0, "require_success": True},
}

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover - PyYAML 通常由系统包提供
    yaml = None

GREEN, YELLOW, RED, DIM, RESET = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"
if not sys.stdout.isatty() or os.environ.get("NO_COLOR"):
    GREEN = YELLOW = RED = DIM = RESET = ""


# ---------------------------------------------------------------------------
# 报告
# ---------------------------------------------------------------------------
class Report:
    """收集 hard / warn / skip 三级发现，并决定退出码。"""

    def __init__(self, title: str) -> None:
        self.title = title
        self.hard: list[str] = []
        self.warn: list[str] = []
        self.skip: list[str] = []
        self.ok: list[str] = []
        if title:
            print(f"\n=== {title} ===")

    def h(self, msg: str) -> None:
        self.hard.append(msg)
        print(f"  {RED}[hard]{RESET} {msg}")

    def w(self, msg: str) -> None:
        self.warn.append(msg)
        print(f"  {YELLOW}[warn]{RESET} {msg}")

    def s(self, msg: str) -> None:
        self.skip.append(msg)
        print(f"  {DIM}[skip]{RESET} {msg}")

    def good(self, msg: str) -> None:
        self.ok.append(msg)
        print(f"  {GREEN}[ ok ]{RESET} {msg}")

    def info(self, msg: str) -> None:
        print(f"  {DIM}[info]{RESET} {msg}")

    def summary(self, strict: bool = False) -> int:
        print(
            f"\n  小结：{len(self.ok)} ok / {len(self.warn)} warn / "
            f"{len(self.skip)} skip / {len(self.hard)} hard"
        )
        if self.hard:
            print(f"  {RED}门禁失败（hard）{RESET}")
            return 1
        if strict and self.warn:
            print(f"  {RED}--strict：warn 视为失败{RESET}")
            return 1
        print(f"  {GREEN}通过{RESET}")
        return 0


# ---------------------------------------------------------------------------
# 基础工具
# ---------------------------------------------------------------------------
def rel(p: Path) -> str:
    try:
        return p.relative_to(ROOT).as_posix()
    except ValueError:
        return str(p)


def which(name: str) -> Optional[str]:
    return shutil.which(name)


def tool_version(name: str, args: Iterable[str] = ("--version",)) -> str:
    exe = which(name)
    if not exe:
        return "-"
    try:
        out = subprocess.run(
            [exe, *args], capture_output=True, text=True, timeout=20
        )
        text = (out.stdout or out.stderr).strip().splitlines()
        return text[0][:60] if text else "(无输出)"
    except Exception as exc:  # pragma: no cover
        return f"(探测失败: {exc})"


def run(
    cmd: list[str],
    cwd: Optional[Path] = None,
    dry: bool = False,
    log: Optional[Path] = None,
) -> tuple[int, str]:
    """执行命令；dry 时只打印。返回 (returncode, 合并输出)。"""
    shown = " ".join(cmd)
    print(f"  {DIM}$ (cd {rel(cwd) if cwd else '.'} && {shown}){RESET}")
    if dry:
        return 0, ""
    try:
        proc = subprocess.run(
            cmd, cwd=str(cwd) if cwd else None, capture_output=True, text=True
        )
    except FileNotFoundError as exc:
        return 127, f"{exc}"
    out = (proc.stdout or "") + (proc.stderr or "")
    if log is not None:
        log.parent.mkdir(parents=True, exist_ok=True)
        log.write_text(out, encoding="utf-8")
    if out and out.strip():
        for line in out.strip().splitlines()[:40]:
            print(f"    {line}")
        if len(out.strip().splitlines()) > 40:
            print(f"    {DIM}... （完整输出：{rel(log) if log else '未落盘'}）{RESET}")
    return proc.returncode, out


def load_yaml_file(path: Path):
    if yaml is None:
        raise RuntimeError("缺少 PyYAML：请参考 requirements.txt / docs/setup/toolchain.md")
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def dump_yaml(data) -> str:
    if yaml is None:
        raise RuntimeError("缺少 PyYAML")
    return yaml.safe_dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False)


def parse_front_matter(path: Path) -> tuple[Optional[dict], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None, text
    end = text.find("\n---", 3)
    if end == -1:
        return None, text
    raw = text[3:end]
    body = text[end + 4 :]
    if yaml is None:
        raise RuntimeError("缺少 PyYAML，无法解析 front-matter")
    meta = yaml.safe_load(raw)
    if meta is None:
        meta = {}
    if not isinstance(meta, dict):
        raise ValueError("front-matter 不是 YAML 映射（key: value）")
    return meta, body


def today() -> str:
    return _dt.date.today().isoformat()


def slugify(text: str) -> str:
    s = re.sub(r"[^0-9a-zA-Z]+", "-", text).strip("-").lower()
    return re.sub(r"-{2,}", "-", s)


def kebab(title: str, fallback: str) -> str:
    s = slugify(title)
    return s or fallback


# ---------------------------------------------------------------------------
# 产物模型
# ---------------------------------------------------------------------------
@dataclass
class Artifact:
    stage: str
    path: Path
    meta: dict
    body: str
    module: Optional[str] = None

    @property
    def id(self) -> str:
        return str(self.meta.get("id", ""))

    @property
    def status(self) -> str:
        return str(self.meta.get("status", ""))

    @property
    def upstream(self) -> list[str]:
        up = self.meta.get("upstream") or []
        if isinstance(up, str):
            return [up]
        return [str(x) for x in up]

    @property
    def artifacts(self) -> list[str]:
        a = self.meta.get("artifacts") or []
        if isinstance(a, str):
            return [a]
        return [str(x) for x in a]

    @property
    def rel(self) -> str:
        return rel(self.path)

    @property
    def prefix(self) -> str:
        return self.id.split("-", 1)[0] if "-" in self.id else ""


@dataclass
class Module:
    name: str
    contract_path: Path
    meta: dict
    short: str = ""
    problems: list[str] = field(default_factory=list)


def stage_files(stage: str) -> list[Path]:
    base = ROOT / STAGE_DIRS[stage]
    if not base.exists():
        return []
    if stage in ("01", "02"):
        return sorted(p for p in base.glob("*.md") if p.name != "README.md")
    if stage == "03":
        return sorted(p for p in base.glob("*/*.md") if p.name != "README.md")
    if stage == "05":
        return sorted(p for p in base.glob("*/*.md") if p.name != "README.md")
    if stage == "06":
        return sorted(
            p
            for p in base.glob("*/*.md")
            if p.parent.name not in ("cfg", "waivers", "reports") and p.name != "README.md"
        )
    return []


def collect_artifacts(rep: Report) -> tuple[list[Artifact], dict[str, Artifact]]:
    arts: list[Artifact] = []
    for stage in ("01", "02", "03", "05", "06"):
        for path in stage_files(stage):
            module = path.parent.name if stage in ("03", "05", "06") else None
            try:
                meta, body = parse_front_matter(path)
            except Exception as exc:
                rep.h(f"{rel(path)} front-matter 解析失败：{exc}")
                continue
            if meta is None:
                rep.w(f"{rel(path)} 没有 front-matter，未纳入追溯（文件名应以 ID 开头）")
                continue
            arts.append(Artifact(stage, path, meta, body, module))

    by_id: dict[str, Artifact] = {}
    for a in arts:
        if not a.id:
            rep.h(f"{a.rel} front-matter 缺少可用 id")
            continue
        if a.id in by_id:
            rep.h(f"ID 重复：{a.id} 同时出现在 {by_id[a.id].rel} 与 {a.rel}")
            continue
        by_id[a.id] = a
    return arts, by_id


# ---------------------------------------------------------------------------
# 模块契约
# ---------------------------------------------------------------------------
def load_modules(rep: Report) -> dict[str, Module]:
    mods: dict[str, Module] = {}
    design_root = ROOT / STAGE_DIRS["03"]
    if design_root.exists():
        for d in sorted(p for p in design_root.iterdir() if p.is_dir()):
            contract = d / "module.yaml"
            if not contract.exists():
                rep.h(f"缺少 {rel(d)}/module.yaml（模块契约是 03/04/05 的唯一身份来源）")
                continue
            try:
                meta = load_yaml_file(contract) or {}
            except Exception as exc:
                rep.h(f"{rel(contract)} 解析失败：{exc}")
                continue
            if not isinstance(meta, dict):
                rep.h(f"{rel(contract)} 不是 YAML 映射")
                continue
            m = Module(d.name, contract, meta, str(meta.get("id_short", "") or ""))
            mods[d.name] = m

    # 04-rtl / 05-verification 下的目录必须有对应模块契约
    for stage in ("04", "05"):
        base = ROOT / STAGE_DIRS[stage]
        if not base.exists():
            continue
        for d in sorted(p for p in base.iterdir() if p.is_dir()):
            if d.name not in mods:
                rep.h(f"{rel(d)}/ 没有对应的 03-design/{d.name}/module.yaml")
    return mods


def validate_modules(rep: Report, mods: dict[str, Module], by_id: dict[str, Artifact]) -> None:
    seen_short: dict[str, str] = {}
    for name, m in mods.items():
        c = rel(m.contract_path)
        if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
            rep.w(f"{c}: 模块目录名 '{name}' 建议只用小写字母/数字/下划线")
        if not m.short:
            rep.h(f"{c}: 缺少 id_short")
        elif not SHORT_RE.match(m.short):
            rep.h(f"{c}: id_short '{m.short}' 不合法（应为 ^[a-z][a-z0-9_]{{1,7}}$）")
        elif m.short in seen_short:
            rep.h(f"{c}: id_short '{m.short}' 与 {seen_short[m.short]} 冲突（必须全仓唯一）")
        else:
            seen_short[m.short] = c
        if not m.meta.get("owner"):
            rep.w(f"{c}: 缺少 owner")
        if m.meta.get("rtl_toplevel") and m.meta["rtl_toplevel"] != name:
            rep.w(f"{c}: rtl_toplevel 与目录名不一致（应为 {name}）")

        impl = m.meta.get("implements") or []
        if not isinstance(impl, list):
            rep.h(f"{c}: implements 必须是列表")
            impl = []
        for i in impl:
            art = by_id.get(str(i))
            if art is None:
                rep.h(f"{c}: implements 引用了不存在的 {i}")
            elif art.module != name:
                rep.h(f"{c}: implements 的 {i} 不属于本模块（在 {art.rel}）")
            elif art.prefix not in ("DES", "REGMAP", "IFACE"):
                rep.h(f"{c}: implements 的 {i} 不是详设类产物")

        files = m.meta.get("files") or []
        if not isinstance(files, list):
            rep.h(f"{c}: files 必须是列表")
            files = []
        rtl_dir = ROOT / STAGE_DIRS["04"] / name
        for f in files:
            if not (rtl_dir / str(f)).exists():
                rep.h(f"{c}: files 里的 {f} 在 04-rtl/{name}/ 下不存在")

        # 同模块的 DES/REGMAP/IFACE 必须使用本模块短名
        for a in mods_artifacts(by_id, name):
            idm = MOD_ID_RE.match(a.id)
            if idm and idm.group(2) != m.short:
                rep.h(f"{a.rel}: ID '{a.id}' 的短名 '{idm.group(2)}' 与 module.yaml 的 '{m.short}' 不一致")

        if not impl:
            rep.w(f"{c}: implements 为空（④ 门禁要求本模块详设已列入）")


def mods_artifacts(by_id: dict[str, Artifact], module: str) -> list[Artifact]:
    return [a for a in by_id.values() if a.module == module]


def validate_module_progress(rep: Report, mods: dict[str, Module], by_id: dict[str, Artifact]) -> None:
    """模块维度的推进一致性：RTL 需要已 approved 的详设；自测需要 RTL。"""
    for name, m in mods.items():
        des = [
            a
            for a in mods_artifacts(by_id, name)
            if a.prefix in ("DES", "REGMAP", "IFACE")
        ]
        approved = [a for a in des if a.status == "approved"]
        rtl_dir = ROOT / STAGE_DIRS["04"] / name
        ver_dir = ROOT / STAGE_DIRS["05"] / name

        if not des:
            rep.w(f"模块 {name}: 目录存在但没有任何详设（DES-*）")
        if rtl_dir.exists() and rtl_dir.is_dir():
            if not approved:
                rep.h(
                    f"04-rtl/{name}/ 已存在，但 03-design/{name}/ 没有 approved 的详设"
                    "（RTL 的上游契约未放行）"
                )
        if ver_dir.exists() and ver_dir.is_dir() and not (rtl_dir / f"{name}.f").exists():
            rep.h(f"05-verification/{name}/ 已存在，但缺少 04-rtl/{name}/{name}.f")


# ---------------------------------------------------------------------------
# 产物校验
# ---------------------------------------------------------------------------
def validate_artifact(rep: Report, a: Artifact, by_id: dict[str, Artifact]) -> None:
    m = a.meta
    for key in REQUIRED_KEYS:
        if key not in m or m[key] in (None, "") and key not in ("upstream", "artifacts"):
            if key in ("upstream", "artifacts"):
                continue
            rep.h(f"{a.rel}: front-matter 缺少必填字段 `{key}`")

    if not a.id:
        return
    if a.stage in ("01", "02"):
        if not PROJ_ID_RE.match(a.id):
            rep.h(f"{a.rel}: ID '{a.id}' 不合法（应为 REQ-001 / ARCH-001 形式）")
    elif a.stage in ("03", "05", "06"):
        idm = MOD_ID_RE.match(a.id)
        if not idm:
            rep.h(f"{a.rel}: ID '{a.id}' 不合法（应为 <PREFIX>-<short>-001 形式）")
        elif idm.group(1) not in STAGE_PREFIX[a.stage]:
            rep.h(
                f"{a.rel}: ID 前缀 '{idm.group(1)}' 不属于阶段 {a.stage}"
                f"（允许：{', '.join(STAGE_PREFIX[a.stage])}）"
            )

    if a.status not in STATUSES:
        rep.h(f"{a.rel}: status '{a.status}' 非法（允许：{', '.join(STATUSES)}）")
    if a.status == "approved":
        if not m.get("reviewer"):
            rep.h(f"{a.rel}: status=approved 但缺少 reviewer（放行者必须是真实的人）")
        if not m.get("date"):
            rep.h(f"{a.rel}: status=approved 但缺少 date")
    if a.status == "superseded" and not m.get("superseded_by"):
        rep.w(f"{a.rel}: status=superseded 但未填 superseded_by")

    allowed_up = UPSTREAM_PREFIX.get(a.stage, ())
    for up in a.upstream:
        up_art = by_id.get(up)
        if up_art is None:
            rep.h(f"{a.rel}: upstream 引用了不存在的 {up}")
            continue
        if allowed_up and up_art.prefix not in allowed_up:
            rep.h(
                f"{a.rel}: upstream {up} 的前缀不属于允许的 {', '.join(allowed_up)}"
            )
        if up_art.status != "approved":
            hint = "（已 superseded）" if up_art.status == "superseded" else ""
            rep.h(f"{a.rel}: 上游 {up} 尚未 approved（当前 {up_art.status}）{hint}")

    if a.stage in ("02", "03", "05", "06") and not a.upstream:
        rep.w(f"{a.rel}: upstream 为空（本阶段应当引用上游产物）")

    for path_str in a.artifacts:
        if not (ROOT / path_str).exists():
            rep.h(f"{a.rel}: artifacts 指向的 {path_str} 不存在")

    if a.prefix == "VP":
        tcs = m.get("test_cases")
        if not tcs or not isinstance(tcs, list):
            rep.h(f"{a.rel}: VP 产物必须提供 test_cases 列表")
        else:
            des_ids = {
                x.id
                for x in by_id.values()
                if x.module == a.module and x.prefix in ("DES", "REGMAP", "IFACE")
            }
            for tc in tcs:
                if not isinstance(tc, dict):
                    rep.h(f"{a.rel}: test_cases 的条目必须是映射（id/covers/desc）")
                    continue
                tcid = str(tc.get("id", ""))
                if not MOD_ID_RE.match(tcid) or not tcid.startswith("TC-"):
                    rep.h(f"{a.rel}: 测试点 ID '{tcid}' 不合法（应为 TC-<short>-001）")
                elif MOD_ID_RE.match(tcid).group(2) != (a.module or ""):
                    pass
                covers = tc.get("covers") or []
                if not isinstance(covers, list):
                    rep.h(f"{a.rel}: {tcid} 的 covers 必须是列表")
                    continue
                for c in covers:
                    if not PROJ_ID_RE.match(str(c)) or not str(c).startswith("REQ-"):
                        rep.h(f"{a.rel}: {tcid} 的 covers 引用了非 REQ 的 {c}")
                    elif str(c) not in by_id:
                        rep.h(f"{a.rel}: {tcid} 的 covers 引用了不存在的 {c}")
            if not des_ids:
                rep.w(f"{a.rel}: 本模块没有详设，测试点无上游依据")


def validate_module_yaml_short(rep: Report, a: Artifact, mods: dict[str, Module]) -> None:
    """03/05/06 下的产物要求其模块契约存在（load_modules 已报错），此处只做短名一致性。"""
    if a.module and a.module in mods:
        m = mods[a.module]
        idm = MOD_ID_RE.match(a.id)
        if idm and m.short and idm.group(2) != m.short:
            rep.h(f"{a.rel}: ID 短名 '{idm.group(2)}' 与 module.yaml 的 '{m.short}' 不一致")


# ---------------------------------------------------------------------------
# waiver
# ---------------------------------------------------------------------------
def load_waivers(rep: Report) -> list[dict]:
    entries: list[dict] = []
    if not WAIVERS.exists():
        return entries
    today_str = today()
    for path in sorted(WAIVERS.glob("*.yaml")):
        try:
            data = load_yaml_file(path) or []
        except Exception as exc:
            rep.h(f"{rel(path)} 解析失败：{exc}")
            continue
        if data and not isinstance(data, list):
            rep.h(f"{rel(path)} 顶层必须是列表")
            continue
        for i, e in enumerate(data or []):
            where = f"{rel(path)} 第 {i + 1} 条"
            if not isinstance(e, dict):
                rep.h(f"{where}: 必须是映射")
                continue
            missing = [k for k in ("rule", "scope", "reason", "owner", "expires") if not e.get(k)]
            if missing:
                rep.h(f"{where}: 缺少字段 {', '.join(missing)}")
                continue
            try:
                exp = _dt.date.fromisoformat(str(e["expires"]))
            except ValueError:
                rep.h(f"{where}: expires '{e['expires']}' 不是 YYYY-MM-DD")
                continue
            if exp < _dt.date.fromisoformat(today_str):
                rep.h(f"{where}: waiver 已过期（{e['expires']}），请修复或续期")
            entries.append(e)
    return entries


def waiver_covers(waivers: list[dict], rule: str, location: str) -> bool:
    for e in waivers:
        if str(e.get("rule", "")).upper() != rule.upper():
            continue
        scope = str(e.get("scope", ""))
        if scope and scope not in location:
            continue
        return True
    return False


# ---------------------------------------------------------------------------
# 工具接线（04 / 05 / 06）
# ---------------------------------------------------------------------------
def read_filelist(path: Path) -> tuple[list[str], list[str]]:
    files: list[str] = []
    flags: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("//", 1)[0].split("#", 1)[0].strip()
        if not line:
            continue
        if line.startswith("+") or line.startswith("-"):
            flags.append(line)
        else:
            files.append(line)
    return files, flags


def thresholds() -> dict:
    path = CFG / "thresholds.yaml"
    data = dict(DEFAULT_THRESHOLDS)
    if path.exists():
        try:
            loaded = load_yaml_file(path) or {}
            for k, v in loaded.items():
                if isinstance(v, dict) and isinstance(data.get(k), dict):
                    data[k].update(v)
                else:
                    data[k] = v
        except Exception:
            pass
    return data


def write_summary_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def module_filelist(module: str) -> Optional[Path]:
    f = ROOT / STAGE_DIRS["04"] / module / f"{module}.f"
    return f if f.exists() else None


def missing_tool(rep: Report, name: str, hint: str, dry: bool) -> bool:
    """工具缺失时：--dry-run 下不跳过（仍打印将要执行的命令），否则 skip 并提示安装。"""
    if which(name):
        return False
    if dry:
        rep.info(f"{name} 未安装：--dry-run 仍打印将要执行的命令（{hint}）")
        return False
    rep.s(f"{name} 未安装 → 跳过（{hint}）")
    return True


def check_rtl_files(rep: Report, module: str, f: Path) -> list[str]:
    files, _flags = read_filelist(f)
    if not files:
        rep.h(f"{rel(f)}: filelist 为空")
        return []
    rtl_dir = f.parent
    resolved: list[str] = []
    for name in files:
        p = (rtl_dir / name).resolve()
        if not p.exists():
            rep.h(f"{rel(f)}: 引用的 {name} 不存在")
            continue
        resolved.append(name)
    if resolved and not any(
        re.search(rf"\bmodule\s+{re.escape(module)}\b", (rtl_dir / n).read_text(encoding="utf-8"))
        for n in resolved
    ):
        rep.h(f"04-rtl/{module}/: 文件里找不到顶层模块 `module {module}`（顶层名必须等于目录名）")
    return resolved


# --- ④ lint ---------------------------------------------------------------
WARN_RE = re.compile(r"^%Warning-([A-Z0-9_]+):", re.MULTILINE)
ERR_RE = re.compile(r"^%Error(?:-([A-Z0-9_]+))?:", re.MULTILINE)


def tool_lint(rep: Report, module: str, dry: bool, waivers: list[dict]) -> None:
    f = module_filelist(module)
    if f is None:
        rep.h(f"04-rtl/{module}/{module}.f 不存在（lint/综合/自测都依赖它）")
        return
    check_rtl_files(rep, module, f)

    if missing_tool(rep, "verilator", "见 docs/setup/toolchain.md", dry):
        pass
    else:
        out_dir = REPORTS / module / "lint"
        log = out_dir / "verilator.log"
        cmd = [
            which("verilator") or "verilator",
            "--lint-only",
            "-Wall",
            "-Wno-style",
            "-Wno-fatal",
            "--top-module",
            module,
            str(CFG / "verilator.vlt"),
            "-f",
            f.name,
        ]
        rc, out = run(cmd, cwd=f.parent, dry=dry, log=log)
        warns = WARN_RE.findall(out)
        errs = ERR_RE.findall(out)
        waived = 0
        remaining: dict[str, int] = {}
        for rule in warns:
            # 缩进的续行里含文件路径；用整段输出定位比较粗糙，故按规则名匹配 scope
            if waiver_covers(waivers, rule, out):
                waived += 1
            else:
                remaining[rule] = remaining.get(rule, 0) + 1
        used = sum(remaining.values())
        cfg = thresholds()["lint"]
        data = {
            "module": module,
            "tool": "verilator --lint-only",
            "errors": len(errs),
            "warnings": len(warns),
            "waived": waived,
            "counted": used,
            "by_rule": remaining,
            "returncode": rc,
        }
        if dry:
            rep.s("--dry-run：未实际执行 lint（未写报告）")
        else:
            write_summary_json(out_dir / "summary.json", data)
            (out_dir / "summary.md").write_text(
                f"# {module} lint 摘要\n\n"
                f"- 工具：verilator --lint-only\n"
                f"- 错误：{len(errs)}\n- 警告：{len(warns)}（waiver 放行 {waived}，计入 {used}）\n"
                f"- 规则分布：{', '.join(f'{k}×{v}' for k, v in sorted(remaining.items())) or '无'}\n"
                f"- 原始日志：`{rel(log)}`\n",
                encoding="utf-8",
            )
        if dry:
            pass
        elif errs:
            rep.w(f"{module}: verilator 报 {len(errs)} 个错误（soft warn，详见 {rel(log)}）")
        elif used > int(cfg.get("max_warnings", 0)):
            rep.w(
                f"{module}: verilator 警告 {used} 个，超过阈值 {cfg.get('max_warnings')}"
                f"（waiver 已放行 {waived} 个）"
            )
        else:
            rep.good(f"{module}: verilator lint 通过（警告 {len(warns)}，waiver {waived}）")

    if missing_tool(rep, "verible-verilog-lint", "OSS CAD Suite 不含，见安装文档", dry):
        pass
    else:
        out_dir = REPORTS / module / "lint"
        log = out_dir / "verible-lint.log"
        files, _ = read_filelist(f)
        cmd = [
            which("verible-verilog-lint") or "verible-verilog-lint",
            f"--rules_config={CFG / 'verible.rules'}",
            *files,
        ]
        rc, out = run(cmd, cwd=f.parent, dry=dry, log=log)
        n = len(re.findall(r"^.*?:\d+:\d+:", out, re.MULTILINE))
        if dry:
            rep.s("--dry-run：未实际执行风格 lint（未写报告）")
        else:
            write_summary_json(
                out_dir / "verible-lint.json",
                {"module": module, "tool": "verible-verilog-lint", "findings": n, "returncode": rc},
            )
            if rc != 0:
                rep.w(f"{module}: verible 风格 lint 有 {n} 条发现（soft warn，{rel(log)}）")
            else:
                rep.good(f"{module}: verible 风格 lint 通过")

    if missing_tool(rep, "verible-verilog-format", "verible release", dry):
        pass
    else:
        files, _ = read_filelist(f)
        bad: list[str] = []
        for name in files:
            src = f.parent / name
            cmd = [which("verible-verilog-format") or "verible-verilog-format", src.name]
            rc, out = run(cmd, cwd=f.parent, dry=dry)
            if dry:
                bad = []
                break
            if rc == 0 and out.strip() != src.read_text(encoding="utf-8").strip():
                bad.append(name)
        if dry:
            rep.s("--dry-run：未实际执行格式检查")
        elif bad:
            rep.w(
                f"{module}: 以下文件格式不符合 verible 规范，请运行 "
                f"`verible-verilog-format --inplace <文件>`：{', '.join(bad)}"
            )
        else:
            rep.good(f"{module}: 格式检查通过")


# --- ⑤ 自测 ---------------------------------------------------------------
def tool_sim(rep: Report, module: str, by_id: dict[str, Artifact], dry: bool) -> None:
    ver_dir = ROOT / STAGE_DIRS["05"] / module
    runner = ver_dir / "run_tests.py"
    if not runner.exists():
        rep.h(f"05-verification/{module}/run_tests.py 不存在（自测入口，见阶段 README）")
        return
    regress = ver_dir / "regress.yaml"
    tests: dict = {}
    if not regress.exists():
        rep.h(f"05-verification/{module}/regress.yaml 不存在（TC ↔ 用例映射）")
    else:
        try:
            data = load_yaml_file(regress) or {}
            for key in ("module", "sim", "toplevel", "tests"):
                if key not in data:
                    rep.h(f"{rel(regress)} 缺少字段 `{key}`")
            tests = data.get("tests") or {}
            if not isinstance(tests, dict):
                rep.h(f"{rel(regress)}: tests 必须是 映射（TC-* → 用例名）")
                tests = {}
        except Exception as exc:
            rep.h(f"{rel(regress)} 解析失败：{exc}")

        # TC-* ↔ regress.yaml 双向核对（AGENTS.md §3：缺用例是 hard fail）
        tc_ids = [
            str(tc.get("id"))
            for vp in by_id.values()
            if vp.prefix == "VP" and vp.module == module
            for tc in (vp.meta.get("test_cases") or [])
            if isinstance(tc, dict) and tc.get("id")
        ]
        for tc in tc_ids:
            if tc not in tests:
                rep.h(f"{rel(regress)}: 测试点 {tc} 没有对应的 cocotb 用例")
        for name in tests:
            if tc_ids and str(name) not in tc_ids:
                rep.w(f"{rel(regress)}: 用例 {name} 在 VP 里没有对应测试点（孤立用例）")
        if tc_ids and tests:
            rep.good(f"{module}: {len(tc_ids)} 个测试点均已映射到用例")

    if missing_tool(rep, "verilator", "见 docs/setup/toolchain.md", dry):
        return
    if not (which("make") and (which("g++") or which("c++") or which("clang++"))):
        if dry:
            rep.info("make / C++ 编译器缺失：--dry-run 仍打印将要执行的命令")
        else:
            rep.s(
                "make / C++ 编译器缺失 → 跳过 cocotb 回归"
                "（cocotb+Verilator 需要编译生成的 C++ 模型）"
            )
            return

    log = REPORTS / module / "cov" / "cocotb.log"
    rc, out = run([sys.executable, "run_tests.py"], cwd=ver_dir, dry=dry, log=log)
    if dry:
        rep.s("--dry-run：未实际执行 cocotb")
        return
    cov_path = REPORTS / module / "cov" / "summary.json"
    if rc != 0:
        rep.w(f"{module}: cocotb 回归未通过（soft warn，详见 {rel(log)}）")
    else:
        rep.good(f"{module}: cocotb 回归通过")

    if not cov_path.exists():
        rep.w(f"{module}: 未生成覆盖率数据 {rel(cov_path)}（run_tests.py 应写入该文件）")
        return
    try:
        cov = json.loads(cov_path.read_text(encoding="utf-8"))
    except Exception as exc:
        rep.h(f"{rel(cov_path)} 不是合法 JSON：{exc}")
        return
    cfg = thresholds()["coverage"]
    line = float(cov.get("line_pct", 0.0))
    toggle = float(cov.get("toggle_pct", 0.0))
    if line < float(cfg["line_warn"]):
        rep.w(f"{module}: 行覆盖率 {line:.1f}% < 阈值 {cfg['line_warn']}%（soft warn）")
    if toggle < float(cfg["toggle_warn"]):
        rep.w(f"{module}: 翻转覆盖率 {toggle:.1f}% < 阈值 {cfg['toggle_warn']}%（soft warn）")
    if line >= float(cfg["line_warn"]) and toggle >= float(cfg["toggle_warn"]):
        rep.good(f"{module}: 覆盖率达标（line {line:.1f}% / toggle {toggle:.1f}%）")


# --- ⑥ 综合 ---------------------------------------------------------------
def read_pdk_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = CFG / "pdk.env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    for k in ("PDK_ROOT", "SKY130_LIB", "SKY130_VERILOG"):
        if os.environ.get(k):
            env.setdefault(k, os.environ[k])
    return env


def find_sky130(env: dict[str, str]) -> tuple[Optional[str], Optional[str], str]:
    """返回 (liberty, verilog 模型, 说明)。"""
    lib = env.get("SKY130_LIB") or ""
    vlog = env.get("SKY130_VERILOG") or ""
    root = env.get("PDK_ROOT") or ""
    if lib and Path(lib).exists() and vlog and Path(vlog).exists():
        return lib, vlog, "来自 pdk.env / 环境变量"
    if root:
        base = Path(root) / "sky130A" / "libs.ref" / "sky130_fd_sc_hd"
        if base.exists():
            cands = sorted((base / "lib").glob("*.lib")) if (base / "lib").exists() else []
            pref = [c for c in cands if "tt_025C_1v80" in c.name]
            lib2 = str((pref or cands)[0]) if (pref or cands) else None
            vcands = sorted((base / "verilog").glob("sky130_fd_sc_hd.v")) if (base / "verilog").exists() else []
            vlog2 = str(vcands[0]) if vcands else None
            if lib2:
                return lib2, vlog2, f"由 PDK_ROOT 自动发现（{base}）"
        return None, None, f"PDK_ROOT={root} 下未找到 sky130A/libs.ref/sky130_fd_sc_hd"
    return None, None, "未设置 PDK_ROOT，也未找到 06-checks/cfg/pdk.env"


def tool_synth(rep: Report, module: str, dry: bool) -> None:
    f = module_filelist(module)
    if f is None:
        rep.h(f"04-rtl/{module}/{module}.f 不存在，无法综合")
        return
    env = read_pdk_env()
    lib, _vlog, note = find_sky130(env)
    if not lib:
        if dry:
            rep.info(f"sky130 PDK 未就位（{note}）：--dry-run 用占位 <SKY130_LIB> 打印命令")
            lib = "<SKY130_LIB>"
        else:
            rep.s(f"sky130 PDK 未就位 → 跳过综合（{note}；见 docs/setup/sky130-pdk.md）")
            return
    if missing_tool(rep, "yosys", "见 docs/setup/toolchain.md", dry):
        return

    files, _ = read_filelist(f)
    out_dir = REPORTS / module / "synth"
    netlist = out_dir / f"{module}.netlist.v"
    tpl = (CFG / "synth_sky130.ys").read_text(encoding="utf-8")
    read_lines = "\n".join(
        f"read_verilog -sv {f.parent / n}" for n in files
    )
    script = (
        tpl.replace("{{FILES}}", read_lines)
        .replace("{{TOP}}", module)
        .replace("{{SKY130_LIB}}", lib)
        .replace("{{NETLIST}}", str(netlist))
    )
    if not dry:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "run.ys").write_text(script, encoding="utf-8")

    log = out_dir / "yosys.log"
    rc, out = run(
        [which("yosys") or "yosys", "-s", str(out_dir / "run.ys")],
        cwd=out_dir,
        dry=dry,
        log=log,
    )
    if dry:
        rep.s("--dry-run：未实际执行综合")
        return
    cells = re.findall(r"Number of cells:\s+(\d+)", out)
    area_match = re.search(r"Chip area for module '\\?[^']*':\s+([0-9.]+)", out)
    data = {
        "module": module,
        "tool": "yosys + sky130_fd_sc_hd",
        "liberty": lib,
        "returncode": rc,
        "cells": int(cells[-1]) if cells else None,
        "area": float(area_match.group(1)) if area_match else None,
    }
    write_summary_json(out_dir / "summary.json", data)
    (out_dir / "summary.md").write_text(
        f"# {module} 综合摘要（sky130）\n\n"
        f"- Liberty：`{lib}`\n- 返回码：{rc}\n"
        f"- 单元数：{data['cells'] if data['cells'] is not None else '未解析到'}\n"
        f"- 面积：{data['area'] if data['area'] is not None else '未解析到'}\n"
        f"- 原始日志：`{rel(log)}`\n",
        encoding="utf-8",
    )
    cfg = thresholds()["synth"]
    if rc != 0:
        rep.w(f"{module}: Yosys 综合失败（soft warn，详见 {rel(log)}）")
    else:
        limit = int(cfg.get("area_warn_cells", 0) or 0)
        if limit and data["cells"] and data["cells"] > limit:
            rep.w(f"{module}: 单元数 {data['cells']} 超过阈值 {limit}（soft warn）")
        else:
            rep.good(f"{module}: Yosys + sky130 综合完成（单元数 {data['cells']}）")


# ---------------------------------------------------------------------------
# 子命令：doctor / new / gate / trace
# ---------------------------------------------------------------------------
def row(name: str, value: str, state: str) -> None:
    """doctor 输出的一行：名称 / 值 / 状态（列宽固定，便于比对）。"""
    print(f"  {name:<24}{value:<28}{state}")


def cmd_doctor(args: argparse.Namespace) -> int:
    print("\n=== 环境自检 (doctor) ===")
    print("[env]")
    py = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    row("python3", py, "ok")
    yv = getattr(yaml, "__version__", None) if yaml else None
    row("pyyaml", yv or "-", "ok" if yv else "MISSING  → requirements.txt / python3-yaml")
    row("repo root", str(ROOT), "ok")

    print("[tools]")
    tools = [
        ("verilator", ("--version",), "OSS CAD Suite 或 apt"),
        ("yosys", ("-V",), "OSS CAD Suite"),
        ("slang", ("--version",), "OSS CAD Suite"),
        ("verible-verilog-lint", ("--version",), "verible release"),
        ("verible-verilog-format", ("--version",), "verible release"),
        ("make", ("--version",), "build-essential（cocotb 需要）"),
        ("g++", ("--version",), "build-essential（cocotb 需要）"),
    ]
    for name, vargs, hint in tools:
        ver = tool_version(name, vargs)
        row(name, ver, "ok" if ver != "-" else f"MISSING  → {hint}")
    try:
        import cocotb  # type: ignore

        row("cocotb", getattr(cocotb, "__version__", "?"), "ok")
    except Exception:
        row("cocotb", "-", "MISSING  → requirements.txt")

    print("[pdk]")
    env = read_pdk_env()
    lib, vlog, note = find_sky130(env)
    row("PDK_ROOT", env.get("PDK_ROOT") or "(unset)",
        "ok" if env.get("PDK_ROOT") else "MISSING  → docs/setup/sky130-pdk.md")
    row("sky130 liberty", lib or "-", "ok" if lib else "MISSING")
    row("sky130 cell verilog", vlog or "-", "ok" if vlog else "MISSING")
    print(f"  {DIM}{note}{RESET}")

    print("[repo]")
    stage_ok = sum(1 for s in STAGE_DIRS.values() if (ROOT / s).exists())
    row("stage dirs", f"{stage_ok}/6", "ok" if stage_ok == 6 else "MISSING")
    std = STANDARDS / "coding-standard.md"
    if not std.exists():
        row("coding-standard", "-", "MISSING")
    elif PLACEHOLDER_MARK in std.read_text(encoding="utf-8"):
        row("coding-standard", "placeholder", "warn  → 放入公司规范后删除 PLACEHOLDER 标记")
    else:
        row("coding-standard", "team standard", "ok")

    rep = Report("")
    waivers = load_waivers(rep)
    expired = [w for w in rep.hard if "已过期" in w]
    row("waivers", str(len(waivers)), "ok" if not expired else f"EXPIRED ×{len(expired)}")
    arts, by_id = collect_artifacts(Report(""))
    row("artifacts", str(len(arts)), "ok")

    print("\n  下一步：装好工具后跑 `python3 tools/sv.py gate all`\n")
    return 0


def _next_id(prefix: str, by_id: dict[str, Artifact], short: str = "") -> str:
    pat = re.compile(rf"^{prefix}-{re.escape(short)}-(\d{{3}})$") if short else re.compile(rf"^{prefix}-(\d{{3}})$")
    nums = [int(m.group(1)) for i in by_id if (m := pat.match(i))]
    return f"{prefix}-{short}-{max(nums, default=0) + 1:03d}" if short else f"{prefix}-{max(nums, default=0) + 1:03d}"


def _render(template: str, subs: dict[str, str]) -> str:
    out = template
    for k, v in subs.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def _upstream_default(stage: str, by_id: dict[str, Artifact], module: Optional[str]) -> list[str]:
    allowed = UPSTREAM_PREFIX.get(stage, ())
    res = []
    for a in by_id.values():
        if a.prefix not in allowed or a.status != "approved":
            continue
        if stage in ("05", "06") and module and a.module != module:
            continue
        res.append(a.id)
    return sorted(res)


def cmd_new(args: argparse.Namespace) -> int:
    if not args.module and getattr(args, "name", ""):
        args.module = args.name
    _arts, by_id = collect_artifacts(Report(""))
    mods = load_modules(Report(""))
    up = args.upstream if args.upstream else None

    def upstream_for(stage: str, module: Optional[str]) -> str:
        ids = up if up is not None else _upstream_default(stage, by_id, module)
        return "[" + ", ".join(ids) + "]"

    kind = args.kind
    title = args.title or "(待填写)"
    slug = args.slug or kebab(title, "draft")
    md_subs = {"TITLE": title, "DATE": today(), "UPSTREAM": ""}

    if kind in ("req", "arch"):
        stage = "01" if kind == "req" else "02"
        prefix = "REQ" if kind == "req" else "ARCH"
        new_id = _next_id(prefix, by_id)
        subs = dict(md_subs, ID=new_id, UPSTREAM=upstream_for(stage, None))
        tpl = TEMPLATES / ("REQ.template.md" if kind == "req" else "ARCH.template.md")
        dest = ROOT / STAGE_DIRS[stage] / f"{new_id}-{slug}.md"
    elif kind == "module":
        name = args.module
        if not name:
            print("  new module 需要 --module <模块名>")
            return 2
        if not args.short:
            print("  new module 需要 --short <短名>（见 AGENTS.md §2）")
            return 2
        if name in mods:
            print(f"  模块 {name} 已存在")
            return 2
        d3 = ROOT / STAGE_DIRS["03"] / name
        d4 = ROOT / STAGE_DIRS["04"] / name
        d5 = ROOT / STAGE_DIRS["05"] / name
        for d in (d3, d4, d5, d5 / "tb", d5 / "tests"):
            d.mkdir(parents=True, exist_ok=True)
        (d3 / "module.yaml").write_text(
            _render((TEMPLATES / "MODULE.template.yaml").read_text(encoding="utf-8"),
                    {"MODULE": name, "SHORT": args.short}),
            encoding="utf-8",
        )
        (d4 / f"{name}.f").write_text(
            _render((TEMPLATES / "FILELIST.template.f").read_text(encoding="utf-8"),
                    {"MODULE": name}),
            encoding="utf-8",
        )
        print(f"  已创建模块 {name}（id_short={args.short}）：03-design / 04-rtl / 05-verification")
        print("  下一步：python3 tools/sv.py new des --module " + name + " --title ...")
        return 0
    elif kind == "rtl":
        name = args.module
        if not name or name not in mods:
            print("  new rtl 需要已存在的 --module（先跑 new module）")
            return 2
        d4 = ROOT / STAGE_DIRS["04"] / name
        d4.mkdir(parents=True, exist_ok=True)
        dest = d4 / f"{name}.sv"
        if dest.exists():
            print(f"  {rel(dest)} 已存在，未覆盖")
            return 2
        tpl_files = sorted(p.name for p in d4.glob("*.sv"))
        dest.write_text(
            _render((TEMPLATES / "RTL.template.sv").read_text(encoding="utf-8"),
                    {"MODULE": name, "TITLE": title,
                     "UPSTREAM": upstream_for("04", name) if up is None else "[" + ", ".join(up) + "]"}),
            encoding="utf-8",
        )
        flist = d4 / f"{name}.f"
        if not flist.exists():
            flist.write_text(
                _render((TEMPLATES / "FILELIST.template.f").read_text(encoding="utf-8"), {"MODULE": name}),
                encoding="utf-8",
            )
        print(f"  已创建 {rel(dest)}（模板含 TODO，端口必须依据详设填写）")

        # RTL 文件自动登记到 module.yaml 的 files（与 new des 追加 implements 对称）
        contract = ROOT / STAGE_DIRS["03"] / name / "module.yaml"
        meta = load_yaml_file(contract) or {}
        files = list(meta.get("files") or [])
        have = sorted({*files, *(p.name for p in d4.glob("*.sv"))})
        if have != files:
            meta["files"] = have
            contract.write_text(dump_yaml(meta), encoding="utf-8")
            print(f"  已把 {', '.join(have)} 登记到 {rel(contract)} 的 files")
        return 0
    else:
        # 模块级产物
        name = args.module
        if not name:
            print(f"  new {kind} 需要 --module <模块名>")
            return 2
        if name not in mods:
            print(f"  模块 {name} 不存在：先跑 new module {name} --short <短名>")
            return 2
        short = mods[name].short
        mapping = {
            "des": ("03", "DES", "DES.template.md"),
            "regmap": ("03", "REGMAP", "REGMAP.template.md"),
            "iface": ("03", "IFACE", "IFACE.template.md"),
            "vp": ("05", "VP", "VP.template.md"),
            "chk": ("06", "CHK", "CHK.template.md"),
        }
        stage, prefix, tpl_name = mapping[kind]
        tpl = TEMPLATES / tpl_name
        new_id = _next_id(prefix, by_id, short)
        subs = dict(md_subs, ID=new_id, MODULE=name, SHORT=short,
                    UPSTREAM=upstream_for(stage, name))
        dest = ROOT / STAGE_DIRS[stage] / name / f"{new_id}-{slug}.md"

    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        print(f"  {rel(dest)} 已存在，未覆盖")
        return 2
    dest.write_text(_render(tpl.read_text(encoding="utf-8"), subs), encoding="utf-8")
    print(f"  已创建 {rel(dest)}")

    # 详设类产物自动追加到 module.yaml 的 implements
    if kind in ("des", "regmap", "iface"):
        contract = ROOT / STAGE_DIRS["03"] / args.module / "module.yaml"
        meta = load_yaml_file(contract) or {}
        impl = list(meta.get("implements") or [])
        new_id = subs["ID"]
        if new_id not in impl:
            impl.append(new_id)
            meta["implements"] = impl
            contract.write_text(dump_yaml(meta), encoding="utf-8")
            print(f"  已把 {new_id} 追加到 {rel(contract)} 的 implements")
    return 0


def _modules_to_check(args: argparse.Namespace, rep: Report) -> list[str]:
    if args.module:
        return [args.module]
    base4 = ROOT / STAGE_DIRS["04"]
    mods = sorted(p.name for p in base4.iterdir() if p.is_dir()) if base4.exists() else []
    if not mods:
        rep.w("没有任何模块目录（04-rtl/ 下为空），工具类检查跳过")
    return mods


def _validate_all(rep: Report, arts: list[Artifact], by_id: dict[str, Artifact],
                  mods: dict[str, Module], targets: Optional[set[str]] = None) -> None:
    for a in arts:
        if targets is not None and a.stage not in targets:
            continue
        validate_artifact(rep, a, by_id)
        validate_module_yaml_short(rep, a, mods)
    validate_modules(rep, mods, by_id)
    validate_module_progress(rep, mods, by_id)


def cmd_gate(args: argparse.Namespace) -> int:
    stage = args.stage
    if stage != "all" and stage not in STAGE_DIRS:
        print(f"  未知阶段 {stage}（允许：{'/'.join(STAGE_DIRS)}/all）")
        return 2
    if stage in ("04", "05", "06") and not args.module:
        print(f"  gate {stage} 需要 --module <模块名>（或用 gate all）")
        return 2

    rep = Report(f"门禁 gate {stage}" + (f" --module {args.module}" if args.module else ""))
    arts, by_id = collect_artifacts(rep)
    mods = load_modules(rep)

    targets = None if stage == "all" else {stage}
    _validate_all(rep, arts, by_id, mods, targets)
    waivers = load_waivers(rep)

    # 编码规范挂载点状态
    std = STANDARDS / "coding-standard.md"
    placeholder = True
    if std.exists():
        placeholder = PLACEHOLDER_MARK in std.read_text(encoding="utf-8")
    if placeholder and (stage in ("04", "05", "06", "all")):
        rep.w("standards/coding-standard.md 仍是 PLACEHOLDER 占位规范：产物需标注「依赖 placeholder 规范」")

    # 覆盖率（trace 维度）soft warn
    if stage in ("05", "06", "all"):
        for req in _req_without_tc(arts, by_id):
            rep.w(f"{req}: 没有任何 TC-* 覆盖（soft warn）")

    # 工具类检查：结构/追溯已经 hard fail 时不再调用工具（AGENTS.md §5：遇 hard fail 立即停）
    tool_stages = {"04", "05", "06"}
    if stage in tool_stages or stage == "all":
        if rep.hard:
            rep.s(f"已有 {len(rep.hard)} 项 hard fail，跳过 ④/⑤/⑥ 工具检查（先修结构/追溯）")
        else:
            for module in _modules_to_check(args, rep):
                if module not in mods:
                    rep.s(f"模块 {module} 没有 module.yaml，跳过工具检查")
                    continue
                print(f"\n  --- 模块 {module} ---")
                if stage in ("04", "all"):
                    print("\n  [④ lint]")
                    tool_lint(rep, module, args.dry_run, waivers)
                if stage in ("05", "all"):
                    print("\n  [⑤ 自测]")
                    tool_sim(rep, module, by_id, args.dry_run)
                if stage in ("06", "all"):
                    print("\n  [⑥ 综合]")
                    tool_synth(rep, module, args.dry_run)

    return rep.summary(args.strict)


def _req_without_tc(arts: list[Artifact], by_id: dict[str, Artifact]) -> list[str]:
    reqs = sorted(a.id for a in arts if a.prefix == "REQ")
    covered: set[str] = set()
    for a in arts:
        if a.prefix != "VP":
            continue
        for tc in a.meta.get("test_cases") or []:
            if isinstance(tc, dict):
                for c in tc.get("covers") or []:
                    covered.add(str(c))
    return [r for r in reqs if r not in covered]


def _trace_model(arts: list[Artifact], by_id: dict[str, Artifact]) -> dict:
    reqs = sorted((a for a in arts if a.prefix == "REQ"), key=lambda a: a.id)
    archs = sorted((a for a in arts if a.prefix == "ARCH"), key=lambda a: a.id)
    des = sorted((a for a in arts if a.prefix in ("DES", "REGMAP", "IFACE")), key=lambda a: a.id)
    vps = sorted((a for a in arts if a.prefix == "VP"), key=lambda a: a.id)
    chks = sorted((a for a in arts if a.prefix == "CHK"), key=lambda a: a.id)

    def covers_via(req_id: str) -> tuple[list[Artifact], list[Artifact], list[tuple[str, str]], list[Artifact]]:
        a_ok = [a for a in archs if req_id in a.upstream]
        arch_ids = {a.id for a in a_ok}
        d_ok = [a for a in des if set(a.upstream) & arch_ids or any(u in arch_ids for u in a.upstream)]
        d_ids = {a.id for a in d_ok}
        tcs: list[tuple[str, str]] = []
        for vp in vps:
            for tc in vp.meta.get("test_cases") or []:
                if isinstance(tc, dict) and req_id in [str(c) for c in (tc.get("covers") or [])]:
                    tcs.append((str(tc.get("id", "?")), vp.id))
        mods_with_vp = {vp.module for vp in vps}
        c_ok = [c for c in chks if c.module in mods_with_vp]
        _ = d_ids
        return a_ok, d_ok, tcs, c_ok

    return {"reqs": reqs, "archs": archs, "des": des, "vps": vps, "chks": chks,
            "covers": {r.id: covers_via(r.id) for r in reqs}}


def cmd_trace(args: argparse.Namespace) -> int:
    rep = Report("追溯 (trace)")
    arts, by_id = collect_artifacts(rep)
    mods = load_modules(rep)
    _validate_all(rep, arts, by_id, mods, None)
    load_waivers(rep)

    model = _trace_model(arts, by_id)
    reqs = model["reqs"]
    rows = []
    for r in reqs:
        a_ok, d_ok, tcs, c_ok = model["covers"][r.id]
        rows.append(
            {
                "req": r.id,
                "title": str(r.meta.get("title", "")),
                "status": r.status,
                "arch": ", ".join(a.id for a in a_ok) or "—",
                "des": ", ".join(a.id for a in d_ok) or "—",
                "tc": ", ".join(t[0] for t in tcs) or "—",
                "chk": ", ".join(c.id for c in c_ok) or "—",
            }
        )
        if not a_ok:
            rep.w(f"{r.id}: 没有被任何 ARCH-* 覆盖")
        if not tcs:
            rep.w(f"{r.id}: 没有被任何 TC-* 覆盖")

    # 状态汇总
    stage_stat: dict[str, dict[str, int]] = {}
    for a in arts:
        d = stage_stat.setdefault(a.stage, {})
        d[a.status] = d.get(a.status, 0) + 1

    lines: list[str] = []
    lines.append("# INDEX — 追溯与覆盖索引")
    lines.append("")
    lines.append("> 本文件由 `python3 tools/sv.py trace` 生成，**请入库**（评审时直接看 diff）。")
    lines.append(f"> 生成时间：{_dt.datetime.now().isoformat(timespec='seconds')}")
    lines.append("")
    lines.append("## 阶段产物统计")
    lines.append("")
    lines.append("| 阶段 | 目录 | draft | in_review | approved | superseded | 合计 |")
    lines.append("|---|---|---|---|---|---|---|")
    for st in ("01", "02", "03", "05", "06"):
        d = stage_stat.get(st, {})
        total = sum(d.values())
        lines.append(
            f"| {st} {STAGE_TITLE[st]} | `{STAGE_DIRS[st]}` | {d.get('draft',0)} | "
            f"{d.get('in_review',0)} | {d.get('approved',0)} | {d.get('superseded',0)} | {total} |"
        )
    lines.append("")
    lines.append("## 需求覆盖矩阵")
    lines.append("")
    lines.append("| 功能点 | 标题 | 状态 | 系统方案 | 详细设计 | 测试点 | 检查 |")
    lines.append("|---|---|---|---|---|---|---|")
    for row in rows:
        lines.append(
            f"| {row['req']} | {row['title']} | {row['status']} | {row['arch']} | "
            f"{row['des']} | {row['tc']} | {row['chk']} |"
        )
    if not rows:
        lines.append("| （暂无功能点） | | | | | | |")
    lines.append("")
    lines.append("## 模块清单")
    lines.append("")
    lines.append("| 模块 | 短名 | 详设 | RTL 目录 | 自测目录 | 检查汇总 |")
    lines.append("|---|---|---|---|---|---|")
    for name, m in sorted(mods.items()):
        d = [a.id for a in arts if a.module == name and a.prefix in ("DES", "REGMAP", "IFACE")]
        rtl = "有" if (ROOT / STAGE_DIRS["04"] / name).exists() else "—"
        ver = "有" if (ROOT / STAGE_DIRS["05"] / name).exists() else "—"
        chk = [a.id for a in arts if a.module == name and a.prefix == "CHK"]
        lines.append(
            f"| {name} | {m.short or '—'} | {', '.join(d) or '—'} | {rtl} | {ver} | {', '.join(chk) or '—'} |"
        )
    if not mods:
        lines.append("| （暂无模块） | | | | | |")
    lines.append("")
    lines.append("## 未覆盖清单")
    lines.append("")
    uncovered = [r.id for r in reqs if not model["covers"][r.id][2]]
    no_arch = [r.id for r in reqs if not model["covers"][r.id][0]]
    lines.append(f"- 无系统方案覆盖的需求：{', '.join(no_arch) or '无'}")
    lines.append(f"- 无测试点覆盖的需求：{', '.join(uncovered) or '无'}")

    text = "\n".join(lines) + "\n"
    if args.check:
        rep.info("--check：只校验，不写 INDEX.md")
    else:
        (ROOT / "INDEX.md").write_text(text, encoding="utf-8")
        rep.good(f"已生成 {rel(ROOT / 'INDEX.md')}")
    return rep.summary(args.strict)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="sv.py",
        description="spec-to-RTL 仓库的唯一入口：门禁 / 追溯 / 建产物 / 环境自检",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    pd = sub.add_parser("doctor", help="环境与工具自检，并给出安装提示")
    pd.set_defaults(func=cmd_doctor)

    pn = sub.add_parser("new", help="从模板创建产物")
    pn.add_argument("kind", choices=["req", "arch", "module", "des", "regmap", "iface", "rtl", "vp", "chk"])
    pn.add_argument("name", nargs="?", default="", help="模块名（new module / new rtl 可位置传参）")
    pn.add_argument("--title", default="")
    pn.add_argument("--slug", default="", help="文件名短描述（中文标题建议显式给出）")
    pn.add_argument("--module", default="", help="模块目录名（模块级产物必填）")
    pn.add_argument("--short", default="", help="模块短名（new module 必填）")
    pn.add_argument("--upstream", nargs="*", default=[], help="显式指定上游 ID；默认取已 approved 的候选")
    pn.set_defaults(func=cmd_new)

    pg = sub.add_parser("gate", help="跑门禁")
    pg.add_argument("stage", help="01|02|03|04|05|06|all")
    pg.add_argument("--module", default="", help="模块名（04/05/06 必填）")
    pg.add_argument("--strict", action="store_true", help="warn 也视为失败")
    pg.add_argument("--dry-run", action="store_true", help="只打印将执行的工具命令，不执行")
    pg.set_defaults(func=cmd_gate)

    pt = sub.add_parser("trace", help="重算追溯覆盖并写 INDEX.md")
    pt.add_argument("--check", action="store_true", help="只校验，不写文件")
    pt.add_argument("--strict", action="store_true", help="warn 也视为失败")
    pt.set_defaults(func=cmd_trace)

    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if yaml is None and args.cmd != "doctor":
        print("缺少 PyYAML：请参考 requirements.txt 与 docs/setup/toolchain.md")
        return 2
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
