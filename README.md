# dsh-deep-verbs

DeepSeek Harness（DSH）纯前端插件：给思考状态行加表情。

内置 UI 在模型思考/执行时显示 `Deep diving...`（15 秒后附计时）。本插件把它扩展成 13 条 deep 系短语的**英/中双语池**：**每个回合开场随机一条；之后每当对话里新出现一个思考段或工具调用就换下一条，两次切换至少间隔 3 秒**（洗牌袋抽取，短期不重复、不连出同一条；窗口内的连续事件合并为一次补切），计时器不受影响。**点击思考状态行即可切换中/英文**——同一条短语换语言展示（不重新抽取），所有并排状态行同步切换，选择写入 `localStorage`，重载后自动恢复。

## 短语池（英文）

| 短语 | 含义 |
| --- | --- |
| `Deep diving...` | 原版：潜水 |
| `Deep seeking...` | 点题：deep seek 动词化 |
| `Deep delving...` | delve into，深入探究 |
| `Deep surfacing...` | 潜完上浮换气 |
| `Deep breaching...` | 鲸跃出水（致敬 whale logo） |
| `Deep bubbling...` | 在深海冒泡泡 |
| `Deep singing...` | 鲸歌 |
| `Deep fishing...` | 深度摸鱼 |
| `Deep sinking...` | 沉下去慢慢想 |
| `Deep sleeping...` | 睡着了（长思考自嘲） |
| `Deep napping...` | 打盹中（长思考自嘲） |
| `Deep dreaming...` | 做梦中 |
| `Deep cooking...` | let me cook |

## 短语池（中文）

与英文池索引一一对应——点击切换语言时保留同一条短语，只换语言展示。中文用「…中」进行时后缀对应英文的 `-ing`（`Deep diving...` ↔ `深潜中…`）。

| 短语 | 对应英文 | 含义 |
| --- | --- | --- |
| `深潜中…` | `Deep diving...` | 原版：潜水 |
| `深度求索中…` | `Deep seeking...` | DeepSeek 官方中文名，点题 |
| `刨根问底中…` | `Deep delving...` | delve into，深入探究 |
| `喷涂彩虹中…` | `Deep surfacing...` | 潜完上浮换气（鲸喷水柱像彩虹） |
| `跃出海面中…` | `Deep breaching...` | 鲸跃出水（致敬 whale logo） |
| `海底冒泡中…` | `Deep bubbling...` | 在深海冒泡泡 |
| `引吭高歌中…` | `Deep singing...` | 鲸歌 |
| `摸鱼中…` | `Deep fishing...` | 深度摸鱼 |
| `沉底中…` | `Deep sinking...` | 沉下去慢慢想 |
| `呼呼大睡中…` | `Deep sleeping...` | 睡着了（长思考自嘲） |
| `偷偷打盹中…` | `Deep napping...` | 打盹中（长思考自嘲） |
| `白日做梦中…` | `Deep dreaming...` | 做梦中 |
| `小火慢炖中…` | `Deep cooking...` | let me cook（慢慢酝酿） |

## 安装

```powershell
pwsh install.ps1            # 或 powershell -ExecutionPolicy Bypass -File install.ps1
```

脚本会自动：优先选择 `~/.dsh/profiles/desktop`（桌面版），否则 `profiles/web`；把本目录 Junction 链接进 `profiles/node_modules/dsh-deep-verbs`；在 profile 的 `cordis.patch.yml` 注册 insert。

然后**完全退出 DSH 进程**再重启（不是关窗口），自带窗口重启即可，浏览器访问则刷新页面。

手动安装等价于：

1. `mklink /J %USERPROFILE%\.dsh\profiles\node_modules\dsh-deep-verbs <本目录>`
2. 在 `<profile>\cordis.patch.yml` 追加：
   ```yaml
   - insert:
       - id: dsh-deep-verbs
         name: 'dsh-deep-verbs'
   ```
3. 重启 DSH。

## 工作原理

不改 DSH 源码、不覆盖渲染插槽。`ui-conversation` 的 TurnStatus 渲染为
`<div role="status">Deep diving...<span>计时</span></div>`；React 每秒重渲但字符串 child 不变时不会回写 DOM 文本节点，因此插件在浏览器侧把该文本节点改写成当前短语即可长期保留。

轮换是**事件驱动**的：ChatView 里每个对话行（`ChatNodeSeat`）都带宿主自用的
`data-chat-flow-kind` 标记（DSH 自己的滚动锚定依赖它，属稳定实现细节）。当新挂载一个 `assistant-step`（新的思考/回答段）或 `tool-call`（新的工具调用，含 `model-retry` 重试）行时，插件切换到下一条短语。两次切换至少间隔 `MIN_SWITCH_MS`（3 秒），落在窗口内的事件合并为窗口边界的一次补切——连续快速的工具调用只换一次词。流式 token 只更新既有行内部、不挂新行，不会误触发；同一行被移除重插入（WeakSet 去重）也不触发。长时间纯思考（无新行挂载）时短语保持不变，直到下一个事件到来。

`MutationObserver`（仅订阅 childList，流式文本变更不触发扫描）同时承担认领新回合状态行与捕获轮换事件；3 秒一次的维护扫描只负责认领兜底、修复 React 回写内置文案的极端情况，以及在后台标签页定时器被节流时兜住补切（不推进短语）。多会话并排时所有活动状态行同步显示同一条（事件不区分会话，同批挂载也复用同一条）。

**点击切换语言**：认领状态行时，插件给它挂上 click 监听并加 `cursor: pointer` 与 title 提示（React 每秒重渲但 vdom 不含这两项，与文本节点同理不会被回写）。点击后当前短语**换语言展示、不重新抽取**，所有活动状态行同步切换；选择写入 `localStorage`，下次打开自动恢复。点击视为用户主动操作，会重置 3 秒保底窗口——防止随后的自动轮换立刻把刚选的语言换掉。

插件只匹配精确的内置文本 `Deep diving...`：未来 DSH 改动这句文案时，插件自动退化为 no-op；若改掉 `data-chat-flow-kind` 标记，则退化为「每回合开场换词、回合内不轮换」——均不影响任何界面。

## 自定义

改 `client.js` 里的 `PHRASES_EN` / `PHRASES_ZH` 两个数组即可：英文保持小写 `deep xxxing` 格式（展示时自动首字母大写并加 `...`），中文保持「…中」后缀格式（展示时自动加 `…`）；两个数组**索引一一对应**——同一索引 = 同一条短语，点击切换语言时按索引对应。两次切换的最小间隔在 `MIN_SWITCH_MS`（默认 3000ms，纯下限而非节拍——事件来得慢就换得慢）。保存后重启 DSH 生效。

## 开发自测

```bash
node verify.mjs
```

用极小 DOM shim 驱动 bundle 的改写/轮换/兜底路径，无需浏览器。

## 卸载

删除 `profiles/node_modules/dsh-deep-verbs` 链接，并移除 `cordis.patch.yml` 中对应的 `- insert` 块，重启 DSH。
