# sky130 PDK 安装与 `$PDK_ROOT` 约定

⑥ 检查阶段的「综合到真实工艺」需要 sky130 PDK。本仓库**不代装**，脚本只负责**定位**与**自检**。

## 1. 需要哪些文件

只用数字标准单元库 `sky130_fd_sc_hd` 的三类文件：

| 用途 | 文件 |
|---|---|
| Yosys 映射与面积 | `lib/sky130_fd_sc_hd__tt_025C_1v80.lib`（Liberty） |
| 综合后仿真/形式验证 | `verilog/sky130_fd_sc_hd.v`（行为模型） |
| 时序/多 corner（可选） | 同目录下其它 `*.lib` |

## 2. 目录约定

脚本按 **open_pdks 布局**查找（volare 与 open_pdks 都是这个布局）：

```
$PDK_ROOT/
└── sky130A/
    └── libs.ref/
        └── sky130_fd_sc_hd/
            ├── lib/sky130_fd_sc_hd__tt_025C_1v80.lib
            └── verilog/sky130_fd_sc_hd.v
```

- `PDK_ROOT` 允许是 `$HOME/pdk`、`~/.volare` 或任意目录；
- 脚本会**自动 glob 发现**具体文件名，不硬编码版本号；
- 若你的 PDK 是 `sky130B` 或放在别的位置，在 `06-checks/cfg/pdk.env` 里显式指定（见第 5 节）。

## 3. 路径 A：volare（推荐，轻量、按版本管理）

volare 直接下载 open_pdks 预构建产物，不需要编译：

```bash
# 需要 pip/uv/pipx 之一（本机无 pip，先用 uv：curl -LsSf https://astral.sh/uv/install.sh | sh）
uv tool install volare          # 或: pipx install volare / pip install --user volare

export PDK_ROOT="$HOME/pdk"
volare ls-remote --pdk sky130            # 列出可用版本
volare enable --pdk sky130 <版本号>      # 下载并解包到 $PDK_ROOT/sky130A
```

> volare 的具体子命令与参数以 `volare --help` 为准（不同版本略有差异）。
> 体积约数 GB，视版本与是否含全部库而定。

## 4. 路径 B：open_pdks（完整，慢，需 `make` 与 magic）

来自 open_pdks 官方流程（[SkyWater PDK](https://github.com/google/skywater-pdk)、[open_pdks](https://github.com/RTimothyEdwards/open_pdks)）：

```bash
export PREFIX="$HOME/pdk"        # 安装体积可达数十 GB
mkdir -p "$PREFIX" && cd "$PREFIX"

git clone https://github.com/google/skywater-pdk.git
git clone https://github.com/RTimothyEdwards/open_pdks.git

cd open_pdks
./configure --enable-sky130-pdk="$PREFIX/skywater-pdk/libraries" --prefix="$PREFIX" \
            --disable-gf180mcu-pdk
make && make install
export PDK_ROOT="$PREFIX/share/pdk"     # 产出 $PDK_ROOT/sky130A
```

需要 `make` 与（数字部分之外的）magic 等工具；本机无 `make`、无 sudo，**这条路径在本机走不通**，请用路径 A 或在有权限的机器上做。

## 5. 路径 C：已有 PDK，只做定位

复制样例并填路径（该文件不入库）：

```bash
cp 06-checks/cfg/pdk.env.example 06-checks/cfg/pdk.env
```

```bash
# 06-checks/cfg/pdk.env
PDK_ROOT=/opt/pdk
SKY130_LIB=/opt/pdk/sky130A/libs.ref/sky130_fd_sc_hd/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
SKY130_VERILOG=/opt/pdk/sky130A/libs.ref/sky130_fd_sc_hd/verilog/sky130_fd_sc_hd.v
```

优先级：`06-checks/cfg/pdk.env` > 环境变量 `PDK_ROOT` / `SKY130_LIB` / `SKY130_VERILOG`。

## 6. 自检

```bash
python3 tools/sv.py doctor
```

`doctor` 会报告 `PDK_ROOT`、解析到的 Liberty 与 Verilog 模型路径；缺失时 `gate 06` 的综合检查会 skip 并提示，不影响结构与追溯门禁。

## 7. 常见问题

| 现象 | 原因/处理 |
|---|---|
| 找不到 `libs.ref` | 目录层级不是 open_pdks 布局 → 用 `SKY130_LIB` 显式指定文件 |
| `abc` 报 liberty 解析失败 | Liberty 版本与 Yosys 不匹配 → 换 `tt_025C_1v80` 这一份，或升级 Yosys |
| 综合面积明显偏大 | 未做 `dfflibmap`/`abc -liberty` 映射，或设计里有无法映射的阵列 → 看 `reports/<m>/synth/` |
| 想省钱省盘 | 只下载 `sky130_fd_sc_hd` 一个库，不要整 PDK |
