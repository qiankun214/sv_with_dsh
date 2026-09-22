# ARCH-001 图件目录

本目录与 `../ARCH-001-arb-arch.md` **同名**，存放该 ARCH 的图件，属于**样例数据**（spec-to-RTL 流程演示）。

## 布局约定（与 `01-requirements` 一致）

- 每个产物的图件放 `<阶段>/<产物文件名去扩展名>/`，与本产物的 `.md` 同名、同级；
- 图源与渲染产物同放这一个目录，两件都入库并列入该产物 front-matter 的 `artifacts`；
- 时序类图用 **WaveDrom**（图源 `.json` + 渲染 `.svg`）；结构/框图用 **Mermaid + ASCII**（`.md`），
  渲染由 Markdown 预览器完成，无需额外工具链。

## 文件

| 文件 | 内容 |
|---|---|
| `block-diagram.md` | 系统上下文（模块边界与对外连接）的 Mermaid + ASCII 框图；**只画到 module 边界** |

## 记法

- 本阶段的框图只到 module 边界；module 内部的功能块/FSM/数据通路由 ③ 详细设计展开。
- 端口与信号语义以 `REQ-001` 的硬件接口章节为唯一权威，本目录不重复维护。
