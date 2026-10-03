# OpenSTA（静态时序分析，gate 06）

`gate 06` 在 Yosys 综合出 sky130 网表之后，用 **OpenSTA** 做静态时序分析，产出
**WNS / TNS / 推算 Fmax**（`06-checks/reports/<module>/sta/`）。
建模口径写在 `06-checks/cfg/sta_sky130.tcl`：单时钟、理想时钟网络、I/O 外部延时 0，
目标周期取自 `06-checks/cfg/thresholds.yaml` 的 `sta.period_ns`。

## 一键安装

`./setup.sh` 默认就会构建 OpenSTA（装到 `.tools/sta/`）；不需要时用 `--no-sta` 跳过，
此时 `gate 06` 的时序分析会 skip（soft warn + 安装提示）。

```bash
./setup.sh                # .venv + eda + OpenSTA
./setup.sh --no-sta       # 只装 .venv + eda
./setup.sh --force        # 重建 .venv / .tools/eda / .tools/sta
```

## 手工步骤（等价于 `setup.sh` 的 `setup_sta()`）

依赖：

| 依赖 | 来源 | 说明 |
|---|---|---|
| `cmake` ≥ 3.20、`g++`（C++20） | 系统 apt | `build-essential` + `cmake` |
| `tcl` 8.6（含头文件与 stub 库） | `.tools/eda`（conda-forge） | `libtcl8.6.so`、`include/tcl.h` |
| `flex` / `bison` | `.tools/eda` / 系统 | `find_package(FLEX/BISON)` |
| `swig` ≥ 3.0 | conda-forge | 生成 Tcl 绑定 |
| `eigen` 3.4 | conda-forge | 头文件库，`share/eigen3/cmake` |
| `cudd` 3.0.0 | **`vsc` 渠道**（conda-forge 无此包） | 条件时序弧/常量传播 |

```bash
source .tools/env.sh            # 让 .tools/eda/bin 生效（tcl/flex/make）

# 1) 构建依赖前缀（swig + eigen + cudd）
.tools/bin/micromamba create -y --no-rc -p .tools/stabuild \
  -c <conda-forge 渠道> -c https://conda.anaconda.org/vsc \
  swig eigen=3.4 cudd

# 2) 源码（tag 3.1.0）
git clone --depth 1 --branch 3.1.0 https://github.com/parallaxsw/OpenSTA.git .tools/src/OpenSTA
#    若 GitHub 直连失败，可改用 codeload：
#    curl -fSL -o /tmp/opensta.tar.gz \
#      https://codeload.github.com/parallaxsw/OpenSTA/tar.gz/refs/tags/3.1.0
#    mkdir -p .tools/src/OpenSTA && tar -xzf /tmp/opensta.tar.gz -C .tools/src/OpenSTA --strip-components=1

# 3) 配置 + 编译 + 安装
cmake -S .tools/src/OpenSTA -B .tools/build/opensta \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PWD/.tools/sta" \
  -DCMAKE_INSTALL_RPATH="$PWD/.tools/eda/lib:$PWD/.tools/stabuild/lib" \
  -DUSE_TCL_READLINE=OFF \
  -DCUDD_DIR="$PWD/.tools/stabuild" \
  -DEigen3_DIR="$PWD/.tools/stabuild/share/eigen3/cmake" \
  -DSWIG_EXECUTABLE="$PWD/.tools/stabuild/bin/swig" \
  -DFLEX_EXECUTABLE="$PWD/.tools/eda/bin/flex" \
  -DTCL_LIBRARY="$PWD/.tools/eda/lib/libtcl8.6.so" \
  -DTCL_INCLUDE_PATH="$PWD/.tools/eda/include"
cmake --build .tools/build/opensta -j"$(nproc)"
cmake --install .tools/build/opensta      # 安装出 .tools/sta/bin/sta
```

## 校验

```bash
source .tools/env.sh
sta -version                       # 3.1.0
python3 tools/sv.py doctor         # [tools] 里应看到 sta ... ok
python3 tools/sv.py gate 06 --module rr_arbiter
cat 06-checks/reports/rr_arbiter/sta/summary.md
```

## 排障

- **`CUDD_LIB` 报 `NOTFOUND` 导致 CMake 失败**：OpenSTA 的 `FindCUDD.cmake` 会把
  `CUDD_LIB-NOTFOUND` 传给 target，所以 cudd **必须**装（它本身是可选依赖，但缺了 configure 过不去）。
  cudd 只在 `vsc` 渠道：`-c https://conda.anaconda.org/vsc`。
- **Tcl 找不到**：显式给 `-DTCL_LIBRARY` / `-DTCL_INCLUDE_PATH` 指向 `.tools/eda`；
  运行期靠 `CMAKE_INSTALL_RPATH` 找到 `libtcl8.6.so`，所以 `source .tools/env.sh` 不是必须，但建议照做。
- **`git clone` 失败**（GitHub 直连不稳）：改用上面的 codeload tarball（`setup.sh` 已内置该回退）。
- **`sta` 在 PATH 里找不到**：确认 `.tools/sta/bin` 在 `PATH`（`source .tools/env.sh`，该路径由
  `setup.sh` 写入），或临时 `ln -s ../../sta/bin/sta .tools/eda/bin/sta`。
- **时序报告为“未解析到 WNS”**：检查 `06-checks/reports/<module>/sta/run.tcl` 与 `sta.log`；
  解析依赖 `report_worst_slack -max` / `report_tns` 的输出格式，改 `sta_sky130.tcl` 时不要破坏这两行。
