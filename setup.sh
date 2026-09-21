#!/usr/bin/env bash
# =============================================================================
# setup.sh —— 一键构建本仓的用户态工具链（.tools/ 与 .venv/）
#
# 定位：本脚本只做「环境供给」，不是流程入口。所有校验与报告仍然只走
#       `python3 tools/sv.py <子命令>`（AGENTS.md §1.7 / §9）；这里不实现任何
#       门禁逻辑，也不生成任何阶段产物。
#
# 安装来源分两类：
#   .venv/          PyYAML + cocotb（uv 优先，退回 python3 -m venv + pip）
#   .tools/eda/     conda-forge 的 verilator + verible + yosys
#                   默认走清华镜像；GitHub 直连实测仅 ~3 KB/s，故不再使用
#   .tools/pdk/     可选（--with-pdk）：litex-hub 的 open_pdks.sky130a，约 1.2 GB
#   系统基础包      apt + sudo：bzip2 build-essential python3-venv python3-pip
#
# sudo 策略：只在 apt-get 前按需加 `sudo`，请勿整体 `sudo ./setup.sh`
#           （否则 .tools/ 与 .venv/ 会变成 root 所有）。
#
# 为什么 EDA 仍走 conda-forge 而不是 apt（Ubuntu 26.04 索引实测）：
#   - verible 无 apt 包（universe 全索引 0 命中），而 gate 04 需要它；
#   - apt 的 verilator 只有 5.032 < cocotb 2.x 要求的 5.036，且 gate 05 硬依赖
#     verilator（tools/sv.py 无 icarus 分支），用 apt 版会让 cocotb 回归直接失败；
#   - apt 的 yosys 0.52 未在本仓 RTL 上验证（conda 的 0.69 已实跑通过）。
#   详见 docs/setup/toolchain.md。
#
# 无法执行 sudo 时的降级（或用 --no-sudo 显式禁用 apt）：
#   bzip2 缺失     → 用 Python tarfile 解包 micromamba
#   make/g++ 缺失  → gate 05 自动 skip（sv.py 现成行为，soft warn）
#   venv/pip 缺失  → 退回 uv；uv 也没有则报错并给安装指引
#   EDA / PDK      → 仍走 conda-forge（本就不需要 sudo）
#
# apt 在容器/WSL 里可能刷 systemd 触发器连不上 dbus 的报错
#   （Failed to connect to system scope bus / Transport endpoint is not
#    connected）：那是噪音，包其实已装好——脚本按「能力」复核而不是只看
#   apt 退出码。要静默可自行加 -o Dpkg::Options::=--no-triggers。
#
# 用法：
#   ./setup.sh                     # .venv + eda（verilator/verible/yosys）
#   ./setup.sh --with-pdk          # 追加 sky130 PDK（打通 gate 06）
#   ./setup.sh --no-sudo           # 禁用 apt 阶段，全走无 sudo 降级路径
#   ./setup.sh --mirror official   # conda-forge 源：tuna(默认)|bfsu|official|<url>
#   ./setup.sh --force             # 重建 .venv 与 .tools/eda
#   ./setup.sh --help
#
# 装完：
#   source .tools/env.sh
#   python3 tools/sv.py doctor
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS="$ROOT/.tools"
VENV="$ROOT/.venv"
EDA="$TOOLS/eda"
PDK_ENV="$TOOLS/pdk"
REQ="$ROOT/requirements.txt"

MIRROR="${MIRROR:-tuna}"
WITH_PDK=0
FORCE=0
PDK_ROOT=""          # 装完 PDK 后由探测填入

# --- 系统基础包：apt + sudo（可用 --no-sudo 整体禁用） -----------------------
USE_SUDO=1           # --no-sudo 置 0：不碰 apt，直接走降级路径
SUDO=""              # 由 detect_sudo() 填 "sudo" 或 ""（EUID==0 时为空）
SUDO_OK=0            # 1 = 可以执行 apt-get
BASE_PKGS=(bzip2 build-essential python3-venv python3-pip)

# 引导用 micromamba：优先取 conda-forge 上的 micromamba conda 包（与 EDA 同
# 渠道，实测 tuna 3.5 MB/s），取不到再退回官方 micro.mamba.pm API（几 KB/s
# 且抖动）。版本可用环境变量覆盖。
MICROMAMBA_VER="${MICROMAMBA_VER:-2.9.0-0}"

# --- 缓存与前缀全部落仓内（不写 $HOME） --------------------------------------
# 本机沙箱拒绝写 ~/.cache、~/.conda，这些重定向是必须的。
export UV_CACHE_DIR="${UV_CACHE_DIR:-$TOOLS/uv-cache}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$TOOLS/cache}"
export CONDA_PKGS_DIRS="${CONDA_PKGS_DIRS:-$TOOLS/conda-pkgs}"
export MAMBA_ROOT_PREFIX="${MAMBA_ROOT_PREFIX:-$TOOLS/mamba}"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$TOOLS/pip-cache}"
# micromamba 会往 $HOME/.conda/environments.txt 写东西，只对它的调用临时改 HOME
MAMBA_HOME="$TOOLS/home"

# litex-hub 渠道国内镜像普遍不镜像（实测 TUNA/BFSU 404），官方 CDN 实测 12.5 MB/s，够快
PDK_CHANNEL="${PDK_CHANNEL:-https://conda.anaconda.org/litex-hub}"

# --- 小工具 -----------------------------------------------------------------
log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ ok ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[警告]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[错误]\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  # 打印文件头注释块：跳过 shebang，遇第二条 `# ====` banner 即停
  awk 'NR>1 && /^# =====/{ if (++n==2) exit } NR>1 { sub(/^# ?/, ""); print }' \
    "${BASH_SOURCE[0]}"
}

# dl <url> <dest>
dl() {
  # 本函数只被 ensure_micromamba（用 $(...) 回传路径）调用，
  # 进度输出必须走 stderr，否则会被当成返回路径的一部分。
  log "下载 $(basename "$2")" >&2
  if have curl; then
    curl -fSL --retry 3 -o "$2" "$1"
  elif have wget; then
    wget -O "$2" "$1"
  else
    die "需要 curl 或 wget"
  fi
}

# conda-forge 渠道 URL：把 --mirror 名字解析成地址
resolve_channel() {
  case "$MIRROR" in
    tuna)     echo "https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge" ;;
    bfsu)     echo "https://mirrors.bfsu.edu.cn/anaconda/cloud/conda-forge" ;;
    official) echo "https://conda.anaconda.org/conda-forge" ;;
    http*|/*) echo "$MIRROR" ;;
    *) die "未知 --mirror：$MIRROR（可选 tuna|bfsu|official|<url>）" ;;
  esac
}

check_prereq() {
  local missing=()
  have tar || missing+=(tar)
  have python3 || missing+=(python3)
  { have curl || have wget; } || missing+=(curl)
  if (( ${#missing[@]} )); then
    die "缺少必要命令：${missing[*]}"
  fi
  mkdir -p "$TOOLS" "$UV_CACHE_DIR" "$XDG_CACHE_HOME" "$CONDA_PKGS_DIRS" \
           "$MAMBA_ROOT_PREFIX" "$PIP_CACHE_DIR" "$MAMBA_HOME"
}

# --- ⓪ 系统基础包（apt + sudo，失败即降级，不 die） --------------------------
# 决定用 $SUDO 还是直接跑，以及是否允许 apt。
detect_sudo() {
  if (( ! USE_SUDO )); then
    warn "已禁用 sudo（--no-sudo）：跳过 apt 系统包安装"
    return 0
  fi
  if (( EUID == 0 )); then
    SUDO=""
    SUDO_OK=1
    warn "以 root 运行：生成的 .tools/ 与 .venv/ 将属于 root（建议以普通用户运行，脚本内部按需调用 sudo）"
  elif have sudo; then
    SUDO="sudo"
    SUDO_OK=1
  else
    warn "未找到 sudo：跳过 apt 系统包安装，按降级路径继续"
  fi
}

# apt_install <pkg...>：只装缺的；失败返回 1，由调用方决定降级。
apt_install() {
  local p missing=()
  for p in "$@"; do
    dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
  done
  (( ${#missing[@]} )) || return 0

  log "apt 安装系统包：${missing[*]}"
  # 注意 $SUDO 故意不加引号：EUID==0 时它为空，需要展开成「没有这个命令」。
  $SUDO apt-get update -qq \
    || warn "apt-get update 失败（继续用现有索引尝试安装）"
  # 不加 `sudo -n`：由用户交互运行时允许弹密码提示。
  $SUDO env DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends "${missing[@]}" || return 1
}

# 装系统基础包，并复核关键能力是否就位（缺什么就按降级表走）。
setup_system_deps() {
  detect_sudo
  if (( ! SUDO_OK )); then
    warn "无 sudo/root 权限：跳过系统包安装，后续按降级路径继续"
    return 0
  fi

  local apt_rc=0
  apt_install "${BASE_PKGS[@]}" || apt_rc=1

  # 不只看 apt 退出码：容器/WSL 里 systemd 包的 dpkg 触发器连不上 system bus
  # （Failed to connect to system scope bus），apt 可能因此返回非 0，但包其实
  # 已经装好。所以这里按「能力」复核，而不是信退出码。
  local missing_caps=()
  have bzip2 || missing_caps+=(bzip2)
  have make  || missing_caps+=("make(build-essential)")
  { have g++ || have c++ || have clang++; } || missing_caps+=("g++(build-essential)")
  python3 -c 'import venv, ensurepip' >/dev/null 2>&1 || missing_caps+=("python3-venv")
  python3 -m pip --version >/dev/null 2>&1 || missing_caps+=("python3-pip")

  if (( ${#missing_caps[@]} )); then
    warn "系统基础能力仍缺：${missing_caps[*]}（按降级路径继续）"
    if (( apt_rc )); then
      warn "apt 未成功；若日志里有 systemd/dbus 触发器报错，可试：sudo apt-get -o Dpkg::Options::=--no-triggers install -y ${BASE_PKGS[*]}"
    fi
  else
    ok "系统基础包就绪：bzip2 / make / g++ / python3-venv / python3-pip"
    if (( apt_rc )); then
      warn "apt 返回非 0，但所需能力已全部就位 —— 多半是 systemd 触发器连不上 dbus 的噪音，可忽略"
    fi
  fi

  # 系统 PATH 里若已有过旧的 verilator（例如手动 apt 装的 5.032），
  # 提醒用 source .tools/env.sh 让 conda 版排在前面。
  if have verilator; then
    local sv_v
    sv_v="$(verilator --version 2>/dev/null | awk '{print $2}')"
    if [[ -n "$sv_v" && "$(printf '%s\n5.036\n' "$sv_v" | sort -V | head -1)" != "5.036" ]]; then
      warn "PATH 里的 verilator $sv_v < 5.036（cocotb 2.x 下限）：gate 05 请先 source .tools/env.sh 用 conda 版"
    fi
  fi
}

ensure_micromamba() {
  # 调用方式是 mm="$(ensure_micromamba)"：本函数用 stdout 回传路径，
  # 因此函数内（含它调用的 dl）任何进度/提示输出都必须走 stderr。
  local mm="$TOOLS/bin/micromamba"
  [[ -x "$mm" ]] && { echo "$mm"; return; }
  local mmarch
  case "$(uname -m)" in
    x86_64|amd64)  mmarch=linux-64 ;;
    aarch64|arm64) mmarch=linux-aarch64 ;;
    *) die "不支持的架构 $(uname -m)" ;;
  esac
  mkdir -p "$TOOLS/bin"
  local tmp="$TOOLS/micromamba.tar.bz2"

  # 引导二进制有两个来源，都是 .tar.bz2、解开就是 bin/micromamba：
  #   1) conda-forge 的 micromamba conda 包（与 EDA 同渠道，tuna 实测 3.5 MB/s）
  #   2) 官方 micro.mamba.pm API（实测几 KB/s 且抖动，只作兜底）
  local chan url_mirror
  chan="$(resolve_channel)"
  url_mirror="$chan/${mmarch}/micromamba-${MICROMAMBA_VER}.tar.bz2"
  if dl "$url_mirror" "$tmp"; then
    log "micromamba 引导包来源：$url_mirror" >&2
  else
    warn "镜像取 micromamba 失败（$url_mirror），退回 micro.mamba.pm（可能很慢）"
    dl "https://micro.mamba.pm/api/micromamba/${mmarch}/latest" "$tmp"
  fi

  # 官方包是 .tar.bz2。系统有 bzip2（优先由 apt 装）就用 tar；否则用
  # Python 自带的 bz2 模块解包（python3 已是前置依赖），不依赖外部 bzip2。
  if have bzip2; then
    tar -xjf "$tmp" -C "$TOOLS" bin/micromamba
  else
    log "系统无 bzip2，改用 Python tarfile 解包 micromamba" >&2
    python3 - "$tmp" "$TOOLS" <<'PY'
import sys, tarfile
arc, dest = sys.argv[1], sys.argv[2]
with tarfile.open(arc, "r:bz2") as tf:
    member = tf.getmember("bin/micromamba")
    try:
        tf.extract(member, dest, filter="data")
    except TypeError:          # Python < 3.12 没有 filter 参数
        tf.extract(member, dest)
PY
  fi

  rm -f "$tmp"
  chmod +x "$mm" 2>/dev/null || true
  [[ -x "$mm" ]] || die "micromamba 解包失败"
  echo "$mm"
}

# 在 conda 前缀里探测 sky130A 的位置，回显 PDK_ROOT（其父目录）
detect_pdk_root() {
  local sky
  sky="$(find "$PDK_ENV" -maxdepth 5 -type d -name sky130A 2>/dev/null | head -1)"
  [[ -n "$sky" ]] && dirname "$sky"
}

# --- ① .venv（PyYAML + cocotb） ----------------------------------------------
setup_venv() {
  # 只判存在不够：残缺的 .venv（有 bin/python 但没装包）会被误判成「已就绪」，
  # 于是跳过安装、到后面自检才炸。这里把「依赖可导入」一起当作就绪条件。
  if [[ -x "$VENV/bin/python" && $FORCE -eq 0 ]] \
     && "$VENV/bin/python" -c 'import yaml, cocotb' >/dev/null 2>&1; then
    log ".venv 已存在（$("$VENV/bin/python" --version 2>&1)），跳过"
  else
    rm -rf "$VENV"
    if have uv; then
      log "用 uv 创建 .venv"
      uv venv --python "${PYTHON:-python3}" "$VENV"
      uv pip install --python "$VENV/bin/python" -r "$REQ"
    else
      log "未找到 uv，退回 python3 -m venv + pip"
      python3 -m venv "$VENV" \
        || die "创建 venv 失败：先装 uv（curl -LsSf https://astral.sh/uv/install.sh | sh），或 sudo apt install python3-venv python3-pip"
      "$VENV/bin/python" -m pip install --upgrade pip
      "$VENV/bin/python" -m pip install -r "$REQ"
    fi
  fi
  "$VENV/bin/python" -c 'import yaml, cocotb' || die ".venv 自检失败：PyYAML/cocotb 不可导入"
  ok ".venv：$("$VENV/bin/python" -c 'import cocotb; print("cocotb " + cocotb.__version__)')"
}

# --- ② .tools/eda：conda-forge 的 verilator + verible + yosys -----------------
setup_eda() {
  local chan; chan="$(resolve_channel)"
  if [[ -x "$EDA/bin/verilator" && -x "$EDA/bin/verible-verilog-lint" \
        && -x "$EDA/bin/yosys" && $FORCE -eq 0 ]]; then
    log "eda 已存在（verilator $("$EDA/bin/verilator" --version | awk '{print $2}')，yosys $("$EDA/bin/yosys" -V 2>&1 | awk '{print $2}')），跳过"
  else
    local mm; mm="$(ensure_micromamba)"
    rm -rf "$EDA"
    log "从 conda-forge 安装 verilator + verible + yosys"
    log "渠道：$chan"
    HOME="$MAMBA_HOME" "$mm" create -y --no-rc -p "$EDA" -c "$chan" \
      verilator verible yosys
  fi

  local vv yv
  vv="$("$EDA/bin/verilator" --version | awk '{print $2}')"
  yv="$("$EDA/bin/yosys" -V 2>&1 | awk '{print $2}')"
  # cocotb 2.x 要求 Verilator ≥ 5.036
  if [[ "$(printf '%s\n5.036\n' "$vv" | sort -V | head -1)" != "5.036" ]]; then
    warn "cocotb 2.x 要求 Verilator ≥ 5.036，当前 $vv：gate 05 硬依赖 verilator 且没有 icarus 分支，回归会失败；请用 conda-forge 版（source .tools/env.sh 让 .tools/eda/bin 排在 PATH 前）"
  fi
  ok "eda：verilator $vv / yosys $yv"
}

# --- ③ 可选：.tools/pdk：sky130 PDK（litex-hub/open_pdks.sky130a） -------------
setup_pdk() {
  local mm; mm="$(ensure_micromamba)"
  if [[ -d "$PDK_ENV" && $FORCE -eq 0 ]]; then
    log "PDK 前缀已存在（$PDK_ENV），跳过下载"
  else
    rm -rf "$PDK_ENV"
    log "安装 sky130 PDK（open_pdks.sky130a，约 1.2 GB，来自 $PDK_CHANNEL）"
    HOME="$MAMBA_HOME" "$mm" create -y --no-rc -p "$PDK_ENV" -c "$PDK_CHANNEL" \
      open_pdks.sky130a
  fi

  # conda 包把 PDK 放在 <prefix>/share/pdk/sky130A；探测而不是硬编码
  PDK_ROOT="$(detect_pdk_root)"
  [[ -n "$PDK_ROOT" ]] || die "PDK 装好了但找不到 sky130A 目录（$PDK_ENV）"

  local hd="$PDK_ROOT/sky130A/libs.ref/sky130_fd_sc_hd"
  [[ -d "$hd" ]] || warn "未找到 $hd（gate 06 的 find_sky130 需要它）"
  ok "PDK：$PDK_ROOT"

  # 顺手写好 pdk.env（该文件在 .gitignore 中，含机器本地路径不入库）
  if [[ -f "$ROOT/06-checks/cfg/pdk.env.example" ]]; then
    sed "s|^PDK_ROOT=.*|PDK_ROOT=$PDK_ROOT|" \
      "$ROOT/06-checks/cfg/pdk.env.example" > "$ROOT/06-checks/cfg/pdk.env"
    ok "已写 06-checks/cfg/pdk.env（PDK_ROOT=$PDK_ROOT）"
  fi
}

# --- ④ 生成可 source 的环境文件 ----------------------------------------------
# 关键：.venv/bin 放在最前，使 python3 恒为 venv 解释器。
# verilator 的 verilator_includer 是 Python 脚本；若 PATH 里先命中别的 python3
# （如 conda 自带的 3.14），会出现 `AssertionError: SRE module mismatch`。
write_env_sh() {
  local f="$TOOLS/env.sh"
  {
    cat <<'EOF'
# 由 setup.sh 生成：`source .tools/env.sh` 启用本仓工具链
if [ -n "${BASH_SOURCE:-}" ]; then _self="${BASH_SOURCE[0]}"; else _self="$0"; fi
_root=$(CDPATH= cd -- "$(dirname -- "$_self")/.." && pwd)

# .venv/bin 必须在最前：python3 == venv 解释器（含 PyYAML + cocotb），
# 同时避免 verilator_includer 用错 Python 版本
PATH="$_root/.venv/bin:$_root/.tools/eda/bin:$PATH"
export PATH
EOF
    if [[ -n "$PDK_ROOT" ]]; then
      printf '\n# sky130 PDK（由 setup.sh 探测写入）\nexport PDK_ROOT=%q\n' "$PDK_ROOT"
    fi
    printf '\nunset _self _root\n'
  } > "$f"
  ok "已生成 $f（用 source .tools/env.sh 启用）"
}

# --- 主流程 -----------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-pdk)  WITH_PDK=1; shift ;;
    --no-sudo)   USE_SUDO=0; shift ;;
    --mirror)    MIRROR="${2:-}"; [[ -n "$MIRROR" ]] || die "--mirror 需要一个值"; shift 2 ;;
    --mirror=*)  MIRROR="${1#*=}"; shift ;;
    --force)     FORCE=1; shift ;;
    -h|--help)   usage; exit 0 ;;
    *) die "未知参数：$1（--help 查看用法）" ;;
  esac
done

check_prereq
log "仓库根：$ROOT"

# 系统基础包（apt + sudo）：缺 bzip2 micromamba 解不了包，缺 make/g++ 会让
# gate 05 被 skip，所以必须排在 venv / eda 之前。
setup_system_deps

# 幂等：这次没带 --with-pdk，也要把已装的 PDK 重新探测出来写进 env.sh
if [[ -d "$PDK_ENV" ]]; then
  PDK_ROOT="$(detect_pdk_root)"
fi

setup_venv
setup_eda
if (( WITH_PDK )); then
  setup_pdk
fi
write_env_sh

echo
log "环境自检（tools/sv.py doctor）"
# 注意：赋值前缀不能用展开出来的 `NAME=value`（bash 在展开前就判定赋值，
# 会把展开结果当命令执行），所以这里显式分支。
if [[ -n "$PDK_ROOT" ]]; then
  PATH="$VENV/bin:$EDA/bin:$PATH" PDK_ROOT="$PDK_ROOT" \
    "$VENV/bin/python" "$ROOT/tools/sv.py" doctor || true
else
  PATH="$VENV/bin:$EDA/bin:$PATH" \
    "$VENV/bin/python" "$ROOT/tools/sv.py" doctor || true
fi

cat <<EOF

工具链构建完成。后续使用：

  source .tools/env.sh
  python3 tools/sv.py gate all

未装 PDK 时 gate 06 会 skip 综合；用 ./setup.sh --with-pdk 追加。
EOF
