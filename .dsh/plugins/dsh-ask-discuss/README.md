# dsh-ask-discuss

`ask_user_question` 挂起时，在右侧栏开一个浮窗，和一个独立上下文的讨论伙伴把这道题商量清楚。讨论内容不进主会话上下文，最终答案仍然由你在原生卡片上点。

## 为什么这么做

问题卡片接管整个输入区（`conversation.composer` 链）。卡片里没有插件插槽，卡片上方那层 `conversation.input.dock` 也随它一起被换掉。所以讨论入口只能放在会话头右侧，那里在问题挂起期间一直可见。

讨论要“不进原有上下文”，唯一的办法是另起一个会话。这个包用 `spawn` 后端的可续聊子代理：它从空会话开始，只知道我们喂给它的问题包；它说的话留在自己的会话日志里，主会话看不到。

答题权不碰。宿主半边监听 `user-questions/request` 瀑布，只是旁听，拿到请求后立刻 `return next()`，答案仍由原生 web answerer 收。

## 用法

1. 主代理问你一道题。会话头右侧出现“讨论”按钮。
2. 点它。右侧栏开出“讨论”标签，随即浮成独立窗口，可拖拽。
3. 窗里第一屏是问题包（可折叠），下面开始聊。你开口它才回答。
4. 聊明白后，回到卡片上点你的答案。浮窗自动收起，讨论会话留在子代理目录里，随时能翻回去看。

同一道题关掉再打开是接着聊。下一道题是新的讨论。

## 安装与挂载

包在本仓，部署侧用一行 Loader row 挂载。

```text
.dsh/plugins/dsh-ask-discuss/           本包
~/.dsh/profiles/web/cordis.patch.yml    挂载行
```

挂载行：

```yaml
- id: ask-discuss
  name: dsh-ask-discuss
```

profile 用相对链接引用本仓（`link:../../../sv/.dsh/plugins/dsh-ask-discuss`），加进 `~/.dsh/profiles/web/package.json` 的 `dependencies` 后，在 profile 目录跑一次 `pnpm install`。

**挂载后必须重启一次 `dsh web`。** 改 `cordis.patch.yml` 通常能热挂载，但热挂载在这个包上不行：运行中的进程早先解析过 `dsh-ask-discuss`，拿到的是“找不到”。Node 的 `package.json` 查询结果会被缓存，包括失败的查询，所以进程内再怎么改都解析不出来。实测报错原文：

```text
failed to import loader entry ... (dsh-ask-discuss): Cannot find package
'/home/alpaca/.dsh/profiles/web/node_modules/dsh-ask-discuss/index.js'
imported from /home/alpaca/.dsh/profiles/web/
```

重启后浏览器再刷新一次，因为 boot graph 在 index 响应里注入。

移除：删掉挂载行和 `dependencies` 里那一行，在 profile 目录跑 `pnpm install`，再重启。

## 讨论伙伴拿到什么

创建时机是你在浮窗里发出的第一条消息，不是点开窗口那一刻。所以只是点开看看，不建子代理、不花 token。

第一次创建时，宿主把问题包和你的第一句话拼成一条消息投给子代理（`PACK_SEPARATOR` 分隔）。问题包包含：

| 内容 | 处理 |
| --- | --- |
| 问题原文、`header`、`detail`、全部选项 | 原样 |
| 主会话最近 10 条消息 | 每条正文最多 1200 字符 |
| 工具调用 | 只留工具名 |
| 工具结果 | 最多 400 字符 |
| 整包上限 | 24000 字符 |

问题包开头写死四条角色约束：只有只读工具、无法反问、不负责提交答案、不复述背景。

工具白名单：`read`、`glob`、`grep`、`read_image`、`web_search`、`web_fetch`、`skill`。不给写文件、不给跑命令、不给派子代理。

模型：读 `subagentModelSelection` 设置项。开启且配了允许的模型时用第一条路由当 `agentOptions`；没开就跟父会话同一个模型。

## 生命周期

| 事件 | 行为 |
| --- | --- |
| 你在卡片上作答或取消 | 宿主立即 `interrupt` 讨论子代理，浮窗收起 |
| 关掉浮窗 | 什么都不做，讨论会话继续存在，再打开是接着聊 |
| 同一会话来了下一道题 | 上一段的记录作废，新开一段讨论 |
| 浏览器刷新 | 浮窗不自动回来，去子代理目录点开即可 |
| plan review（`exit_plan_mode`） | 不接。入口不出现，宿主也拒绝对它开讨论 |
| 工具审批（approval） | 不接 |
| 插件卸载 | 所有讨论子代理被中断 |

## 实现

宿主半边一行，全局生效。

- `lib/index.js`：插件入口，监听 `user-questions/request` 与 `agent/status`，注册路由。
- `lib/discussion.js`：讨论服务。按 `sessionId` 记当前挂起的请求，懒创建子代理，转发消息，读对话，中断。依赖全部注入，可以脱离运行时测试。
- `lib/pack.js`：问题包文本。纯函数。
- `lib/messages.js`：会话事件 → 行式消息。问题包和浮窗对话共用，只是限额不同。
- `lib/http.js`：`/api/ask-discuss` 前缀路由，四个端点。

浏览器半边是 `src/client/`，`lib/client.js` 是构建产物。

- `index.js`：注册表项、标签类型、讨论面板。
- `entry.js`：会话头的“讨论”按钮，以及读挂起交互的 hook 包装。
- `panel.js`：讨论面板。打开时取一次载荷，之后每 700 ms 轮询对话；挂起交互消失时自己关掉标签。
- `transport.js`：四个宿主调用的 `fetch` 封装。失败一律折成 `{ok:false, reason}`，面板直接渲染。
- `styles.js`、`locales.js`：样式与中英文词条。

### 为什么是 HTTP 路由，不是 Remote

Remote 命名空间由 TypeScript 装饰器在构建期生成。这个包是纯 JavaScript，走不了那条路。所以宿主占一条前缀路由，和自带的附件路由 `/api/file` 一个做法。服务器只绑本机回环，不带认证，路由信任调用方给的 `sessionId`；每个操作又都被运行时兜住——没有挂起请求的会话没有记录，讨论只为有记录的那一个创建。

端点：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/api/ask-discuss/state?sessionId=` | 这个会话有没有待讨论的请求 |
| `POST` | `/api/ask-discuss/open` | 取问题包和已有对话 |
| `POST` | `/api/ask-discuss/send` | 发一条消息，必要时先建子代理 |
| `GET` | `/api/ask-discuss/transcript?sessionId=&token=` | 轮询对话 |

请求带 `token`（请求序号）。序号对不上返回 `stale`，防止旧窗口把消息发到新问题上。

## 已知限制

- 讨论伙伴不能反问。子代理调用 `ask_user_question` 会被 `DELEGATED_CALLER` 拒掉，因为它被另一个存活的 agent 拥有。它只能陈述、查证、给建议。
- 入口的可见性依赖自带 `dsh-client-ui-user-questions` 发布的挂起交互。那个包不在组合里，按钮就不会出现。
- 浏览器到宿主只有客户端发起的方向。窗内对话靠轮询，没有推送通道。
- 计划审批卡和工具审批都没有讨论入口。

## 重建与测试

`lib/client.js` 是构建产物，改了 `src/client/` 就重建：

```sh
cd .dsh/plugins/dsh-ask-discuss
pnpm install            # esbuild，来自 devDependencies
node build.mjs          # 写 lib/client.js
```

产物必须入库：profile 挂载本包时，`lib/client.js` 缺失会让客户端组合失败。`node_modules/` 不入库。

```sh
node --test 'test/*.test.mjs'
```

- `pack.test.mjs`、`messages.test.mjs`：问题包格式、截断、工具结果映射、剥离问题包前缀。
- `discussion.test.mjs`：挂起记录的建立与作废、懒创建、续聊、模型设置、各类失败原因、中断。
- `http.test.mjs`：四个端点的路由、参数校验、越界与未知路径。
- `client.test.mjs`：传输层失败折叠、词条完整、样式注入幂等。
- `bundle.test.mjs`：按加载器的方式加载 `lib/client.js`，验证表项、标签类型、面板和会话头入口的注册与点击行为。
