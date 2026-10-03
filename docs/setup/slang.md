# slang（SystemVerilog 语义检查，gate 04 / 06）

`gate 04` 的 lint 阶段除了 verilator（可综合性）与 verible（风格/格式）之外，还用
**slang** 做 SV 语义检查（`slang --lint-only`），报告写到
`06-checks/reports/<module>/lint/slang.json` 与 `slang.log`（`.log` 已 gitignore）。
`06-checks/cfg/thresholds.yaml` 的 `lint.max_slang_warnings` 控制 soft warn 上限。

## 一键安装

`./setup.sh` 默认就装 slang（装到 `.tools/slang/`）；不需要时用 `--no-slang` 跳过。

```bash
./setup.sh                # .venv + eda + OpenSTA + slang
./setup.sh --no-slang     # 跳过 slang
```

## 手工步骤（等价于 `setup.sh` 的 `setup_slang()`）

slang（MikePopoloski 的 SystemVerilog 前端）**不在 conda-forge**（conda-forge 的 `slang`
是 S-Lang，完全不同的库）。这里取 **LiteX-Hub** 渠道的包（与本仓 sky130 PDK 同源）：

```bash
# 渠道可与 PDK 共用：https://conda.anaconda.org/litex-hub
.tools/bin/micromamba create -y --no-rc -p .tools/slang \
  -c https://conda.anaconda.org/litex-hub slang

# 包内可执行文件叫 slang-driver（老命名），补一个 slang 软链
ln -sf slang-driver .tools/slang/bin/slang
```

> 其它渠道也有同名包：`SymbiFlow/slang`（0.5）、`antmicro/slang`（0.6）；
> 本仓用 LiteX-Hub 的 **3.0**（`slang version 3.0.0+7efcca2e`）。
> 若要走源码：`git clone https://github.com/MikePopoloski/slang` 后用 CMake 构建（需 C++20 编译器）。

## 校验

```bash
source .tools/env.sh
slang --version                                   # slang version 3.0.0+...
python3 tools/sv.py doctor                        # [tools] 里应看到 slang ... ok
python3 tools/sv.py gate 04 --module rr_arbiter   # lint 阶段会跑 slang
cat 06-checks/reports/rr_arbiter/lint/slang.json
```

`slang.json` 形如：

```json
{ "module": "rr_arbiter", "tool": "slang --lint-only", "errors": 0, "warnings": 0, "returncode": 0 }
```

## 说明与排障

- `tools/sv.py` **同时认 `slang` 与 `slang-driver` 两个可执行文件名**；
  若 `doctor` 报 slang MISSING，确认 `.tools/slang/bin` 在 `PATH`（`source .tools/env.sh`）。
- `--lint-only` 只做语法/语义/类型检查，不展开完整层次；参数覆盖可用 `-G <name>=<value>`。
- 目前只对 `.f` 里列出的 RTL 源文件执行，未接入 verible 那样的外部规则配置文件；
  要加规则可在 `tools/sv.py` 的 lint 分支里给 `slang` 追加命令行开关。
