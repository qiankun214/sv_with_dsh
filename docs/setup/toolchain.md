# 工具链安装（Verilator / Yosys / Verible / slang / cocotb）

本仓库**不代装、不自建环境**：这里给出可复制的安装步骤，装完用 `python3 tools/sv.py doctor` 自检。

## 0. 本机现状（已核实，2026-xx 快照）

| 事实 | 影响 |
|---|---|
| 无 `verilator` `yosys` `verible-*` `slang` `iverilog` `vcs` `xrun` `spyglass` | 需要用下面的步骤自装 |
| 无 `make`、`g++`/`gcc`/`clang`/`cc` | **编译型仿真（cocotb + Verilator）跑不了** |
| `sudo` 被 `no_new_privs` 禁用，apt 装不了包 | 只能用户态解包预编译二进制 |
| 网络可达 github.com / pypi.org | 可以下载发布包 |
| `python3` 无 pip、无 ensurepip；但 `python3-yaml` 6.0.3 已存在 | 结构/追溯门禁开箱可用；Python 包需另装 |
| `tar` `curl` `wget` `git` 可用；**无 `unzip`** | 一律下载 `.tgz`/`.tar.gz`，别下 `.zip` |

关键区分：**lint 与综合不需要编译器**（Verilator `--lint-only`、Yosys、Verible、slang 都是预编译二进制或纯解析），**只有 cocotb 功能仿真需要 `make` + `g++`**。

## 1. OSS CAD Suite（推荐，一次拿到 Yosys + Verilator + slang + cocotb）

包含 Yosys、ABC、slang（及 yosys-slang 插件）、Verilator、Icarus、GTKWave、Surfer、cocotb，并自带 Python 3。
**不包含 Verible**，Verible 见第 2 节。

```bash
mkdir -p ~/opt && cd ~/opt

# 取最新 linux-x64 发布包的下载地址（资产名含日期，不要硬编码）
URL=$(curl -s https://api.github.com/repos/YosysHQ/oss-cad-suite-build/releases/latest \
      | grep -o 'https://[^"]*linux-x64[^"]*\.tgz' | head -1)
echo "$URL"

curl -L -o oss-cad-suite.tgz "$URL"
tar -xzf oss-cad-suite.tgz          # 解出 oss-cad-suite/ 目录
```

激活（二选一，建议写进 `~/.bashrc`）：

```bash
export PATH="$HOME/opt/oss-cad-suite/bin:$PATH"
# 或者：source ~/opt/oss-cad-suite/environment
```

> ⚠️ `source environment` 会把 OSS CAD Suite 自带的 `python3` 放到 PATH 最前，
> 使 `python3`/`pip` 变成它自带的那份（好处是自带 cocotb，坏处是与系统 python 混淆）。
> 只加 `bin` 到 PATH 时，用系统 `python3` 跑 `tools/sv.py` 更干净。

校验安装位置（示例，版本号会不同）：

```bash
yosys -V          # Yosys 0.5x+
verilator --version
slang --version
cocotb-config --version    # 仅当 python3 指向 suite 自带解释器时存在
```

## 2. Verible（风格与格式化，OSS CAD Suite 不含）

```bash
mkdir -p ~/opt/verible && cd ~/opt/verible
URL=$(curl -s https://api.github.com/repos/chipsalliance/verible/releases/latest \
      | grep -o 'https://[^"]*linux-static-x86_64\.tar\.gz' | head -1)
echo "$URL"
curl -L -o verible.tar.gz "$URL"
tar -xzf verible.tar.gz --strip-components=1
export PATH="$HOME/opt/verible/bin:$PATH"
verible-verilog-lint --version
```

（若该 release 没有 `linux-static-x86_64` 资产，到
<https://github.com/chipsalliance/verible/releases> 手动挑一个静态构建包。）

## 3. cocotb 与 Python 依赖

三种情况：

1. **用 OSS CAD Suite 自带的 python3**：已含 cocotb，直接用；
2. **用系统 python3**（本机是这种）：按 `requirements.txt` 建用户态环境，无需 sudo：

   ```bash
   # 方式 A：venv + pip（需要 pip，本机没有 → 先装 uv 或 get-pip.py）
   curl -LsSf https://astral.sh/uv/install.sh | sh   # 装 uv 到 ~/.local/bin
   uv venv .venv && . .venv/bin/activate
   uv pip install -r requirements.txt
   # 方式 B：pipx / volare 之类同理
   ```

   `PyYAML` 在本机已由系统包提供；若在别处部署，注意 `requirements.txt` 里那一行。
3. **完全不装 cocotb**：`gate 05` 会 skip 并给提示，前四个阶段与 lint/综合不受影响。

## 4. 编译器（仅 cocotb 功能仿真需要）

`make` 与 `g++` 缺失时，`gate 05` 会跳过并提示。可选路径：

- 有提权/有 sudo 的机器：`sudo apt install build-essential`；
- 本机（无 sudo）：换一台机器、用容器，或用用户态工具链（conda/nix 等，未在本仓验证）；
- 只要 lint + 综合：**什么都不用装**，第 1、2 节够了。

## 5. 环境变量速查

```bash
export PATH="$HOME/opt/oss-cad-suite/bin:$HOME/opt/verible/bin:$PATH"
export PDK_ROOT="$HOME/pdk"        # sky130 见 docs/setup/sky130-pdk.md
```

## 6. 自检

```bash
python3 tools/sv.py doctor
```

输出示例（未装工具时）：

```
[环境]
  python3            3.14.4                       ok
  pyyaml             6.0.3                        ok
[工具]
  verilator          -                            MISSING  → OSS CAD Suite 或 apt
  yosys              -                            MISSING  → OSS CAD Suite
  verible-verilog-lint -                          MISSING  → verible release
  slang              -                            MISSING  → OSS CAD Suite
  cocotb             -                            MISSING  → requirements.txt
  g++ / make         -                            MISSING  → 影响 gate 05
[PDK]
  PDK_ROOT           (未设置)                      MISSING  → docs/setup/sky130-pdk.md
[仓库]
  阶段目录            6/6                          ok
  waiver 过期         0                             ok
```

装完后 `doctor` 应全部 `ok`，然后：

```bash
python3 tools/sv.py gate all
```
