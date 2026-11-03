# dsh-markdown-media

本仓的 dsh Web GUI 扩展：让 Markdown 里的图片和 Mermaid 图正常显示，并且点一下就能放大查看。

它是一个 dsh 客户端插件包，同时声明了 `dsh.client` 和 `dsh.bundle`。`dsh.client` 让浏览器半边被 `@deepseek-ai/dsh-client-modules` 加载；`dsh.bundle` 让 `dsh plugin` 安装它时自动把它加进 profile 的层列表，并应用自带的一层 patch（就是那行 Loader row）。宿主半边只有空的 `apply`，作用是让组合里能出现这一行。

## 功能

### Mermaid 围栏画成图

dsh 自带的 Markdown 组件不认 mermaid，```` ```mermaid ```` 只会显示成代码。本包盯渲染后的 DOM：先用 `mermaid.parse` 校验，再用内置的 mermaid 构建画图，源码留在右上角「查看源码」里。

聊天、渲染 Markdown 的工具卡、右侧文档预览三处同时生效。语法有错或流式还没写完的围栏保持代码原样。

### 文档预览里的图片能显示

自带的预览 body 不传 `pathImages`，所有 `![alt](…)` 都退化成 alt 文字。本包注册一个 `extension` 优先级的 Markdown 实现：组件还是同一个，但带一个按当前文档解析的图片解析器，下面四种写法都能出图。

```markdown
![绝对](/home/alpaca/sv/01-requirements/a.svg)
![相对](REQ-001-rr-arbitration/scenario-1-single-request.svg)
![上级](../assets/a.png)
![远程](https://example.com/a.png)
```

相对路径按当前文档所在目录解析；目录未知时退回资源元数据里的 `absolutePath`。本地文件统一变成 `/api/file?path=…`，仍然走宿主的文件系统与沙箱规则。

### 点图片放大

一个委托的点击监听覆盖三处 Markdown 面：文档预览的图、聊天里的 Markdown 图片、渲染出的 Mermaid 图。查看器铺满窗口，打开时自适应，小图不会放大到超过自身像素。

| 操作 | 效果 |
| --- | --- |
| 工具栏 `−` / `+` | 按 1.25 倍步进缩放 |
| 工具栏百分比 | 跳到实际大小 |
| `适应` / `1:1` | 适应窗口 / 一个图像像素对一个 CSS 像素 |
| 滚轮 | 以光标为锚点缩放 |
| 拖拽 | 图超出窗口时平移 |
| 双击 | 在「适应」和「实际大小」之间切换 |
| `Esc`、点空白、`×` | 关闭 |

打开时锁住页面滚动，关闭后焦点回到点击的那张图。键盘 `+` `-` `0` `1` 同样可用。

识别范围只有 Markdown 图片：在 Markdown 容器内，或带原生组件那组专有属性。头像、附件缩略图（有自己的查看器）、工具结果图库都不受影响。

## 安装

另一台机器只要 clone 本仓，执行**一条 dsh 官方命令**即可，不需要跑本仓的脚本：

```sh
dsh plugin --profile web add /path/to/sv/.dsh/plugins/dsh-markdown-media
```

这条命令做三件事：在 profile 里装好依赖；把声明了 `dsh.bundle` 的包加进 profile 的层列表；下次启动时应用包内 `cordis.patch.yml` 的 Loader row。然后重启 `dsh web`、刷新页面。

升级、卸载同样走官方命令：

```sh
dsh plugin --profile web update dsh-markdown-media   # 依赖来自 npm 时
dsh plugin --profile web remove dsh-markdown-media
```

发布到 npm 之后，可以直接按包名安装：`dsh plugin --profile web add dsh-markdown-media`。

### 为什么不是「零操作」

dsh 只从 profile 组合里加载插件：`~/.dsh/profiles/<name>/cordis.patch.yml`、profile 的 `dsh.profile.bundles`，或 `--patch` 覆盖层。工作区里没有插件发现机制（`.dsh/skills/` 那种自动扫描只针对技能，不针对插件）。所以「克隆完什么都不做就生效」在 dsh 0.1.5-rc.1 上做不到，最少需要上面那一条命令，以及一次 `dsh web` 重启。

### 本机当前的挂载方式

本机（`~/` 下已有部署）是手工挂载的：`~/.dsh/profiles/web/cordis.patch.yml` 里有一行 `markdown-media`，依赖用 `link:` 指向本仓。这种挂法和 bundle 方式**不能同时存在**：同一行 id 出现两次会让 dsh 启动直接失败。

要换成本仓推荐的 bundle 方式：

1. 删掉 `~/.dsh/profiles/web/cordis.patch.yml` 里的 `markdown-media` 行（live reload 会让当前进程立即卸载插件）；
2. 执行上面那条 `dsh plugin --profile web add …`；
3. 重启 `dsh web`。

## 发布到 npm

包名 `dsh-markdown-media` 在 npm 上目前未被占用。发布前确认三件事：登录（`npm login`）、版本号、以及本仓自己的许可证（本包用 MIT，见 `LICENSE`）。

```sh
cd .dsh/plugins/dsh-markdown-media
npm publish
```

`files` 只放行 `lib/`、`cordis.patch.yml`、`THIRD-PARTY-NOTICES.md`，源码、测试、构建脚本不进包。产物里的第三方组件（mermaid 及 57 个依赖）的许可证全文由 `build.mjs` 生成到 `THIRD-PARTY-NOTICES.md`，随包发布。

## 重建

`lib/client.js` 是构建产物。改了 `src/client/` 就重建：

```sh
cd .dsh/plugins/dsh-markdown-media
pnpm install            # esbuild、mermaid、jsdom，来自 devDependencies
node build.mjs          # 写 lib/client.js 和 THIRD-PARTY-NOTICES.md
```

产物是一个 classic script，通过 `window.__ModuleLoader__.load` 注册插件工厂。React 与 `@deepseek-ai/dsh-client-ui-primitives` 不打包，由加载器的冻结模块表提供。mermaid 打进产物，约 3.4 MB，因此离线也能画图。

构建产物要入库：profile 挂载本包时，`lib/client.js` 缺失会让客户端组合失败。`node_modules/` 不入库，见本目录的 `.gitignore`。

## 兼容性

已在 dsh `0.1.5-rc.1`（客户端包 `0.1.5-rc.2`）上验证。用到的都是客户端内部 API：`MarkdownText` 的 `pathImages` 与 labels、`documentPreviews.register`、`slots.register` / `slots.inject`、`locale.register` / `locale.bind`，以及原生 Markdown 图片的属性签名。dsh 换大版本后这些可能变，届时可能是挂载失败，也可能只是不再生效。

## 为什么做在 DOM 上

部署里只有构建产物：`MarkdownText` 是冻结导出，Web shell 是压缩后的 dist，没有可用的渲染扩展点。图表与放大因此做在渲染后的 DOM 上；图片解析则通过文档预览注册表接入，那是官方扩展位。

## 已知限制

聊天里的相对路径图片仍是 alt 文字。自带聊天插件用自己的 `pathImages`（只认绝对路径），一条消息也没有文档目录可参照。聊天里的绝对路径和 http(s) 图片正常。

## 测试

- `test/media-url.test.mjs`：目标路径到 URL 的纯逻辑，17 项。
- `test/zoom-math.test.mjs`：查看器几何与百分比标签，24 项。
- `test/bundle.test.mjs`：在 jsdom 里跑真实产物，覆盖注册形状、预览定义与 body、文案、Mermaid 绘制、源码切换、点击放大、销毁清理。
- `test/verify-live.mjs`：用部署自己的凭据算 cookie，检查运行中的服务器：boot graph 有本插件、产物被提供、`/api/file` 能取到图。

```sh
node test/media-url.test.mjs
node test/zoom-math.test.mjs
node test/bundle.test.mjs
node test/verify-live.mjs [绝对图片路径]
```
