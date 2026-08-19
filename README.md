# dsh-deep-verbs

> **简体中文**（默认） | [English](README.en.md)

> 看腻了思考状态行万年不变的 `Deep diving...`？
> 也想让模型思考时有点戏？
> 那这个插件就是为你准备的。

DeepSeek Harness（DSH）**纯插件**，只负责给思考状态行**换文案**：
1. **回合开场随机一条**：53 条 deep 系短语的英/中双语池，洗牌袋抽取（一袋之内不重复、袋与袋交界也不连出同一条）；
2. **事件驱动轮换**：对话里每新出现一个思考段或工具调用就换下一条，两次切换至少间隔 3 秒（窗口内的连续事件合并为一次补切——连发工具调用只换一次词）；
3. **点击切换中英文**：点一下状态行，当前短语**换语言展示、不重新抽取**，所有并排状态行同步切换，选择存 `localStorage`、重载后恢复；
4. **计时器不受影响**：内置 15 秒后出现的「N分N秒」照常显示。

**不修改任何 `@deepseek-ai/dsh-*` 源码。**

> **设计参考**：本插件的短语轮换玩法参考了 **Claude Code** 的 spinner 词表——它每次思考挂载时随机抽一个动名词（*Wandering… / Combobulating… / Noodling…*），与「每次开场随机一条」如出一辙；本插件词表也直接扩充了 40 条 Claude Code 同款动词。

## 功能一：回合开场随机 + 事件驱动轮换

```
[用户消息]
Deep diving...            ← 内置：万年不变
        ↓ 本插件认领后
Deep Seeking...           ← 回合开场随机一条
Deep cooking...           ← 之后每新挂载一个思考段/工具调用就换一条
深潜中…（1分23秒）         ← 中英随点击切换；15 秒后右侧照常出现计时
```

- **洗牌袋抽取**：一袋 53 个索引抽完才重洗，短期不重复、跨袋也不连出同一条；
- **回合开场随机**：状态行首次挂载时从袋里取一条，同一批挂载的多行（多会话并排）显示同一条；
- **事件驱动**：新挂载 `assistant-step`（思考/回答段）或 `tool-call`（工具调用，含重试）行即换下一条；流式 token 不挂新行，不会误触发；同一行被移除重插入也不重复计数；
- **保底节流**：两次切换至少间隔 3 秒（`MIN_SWITCH_MS`），窗口内的事件合并到窗口边界补切一次；
- **长思考不刷屏**：没有新行挂载时短语保持不变，直到下一个事件到来。

## 功能二：点击切换中英文

```
Deep Seeking...            ← 点击状态行（悬停有提示、光标变手型）
        ↓
深度求索中…               ← 同一短语换语言展示，不重新抽取
```

- **同一条短语换语言**：`Deep Seeking...` ↔ `深度求索中…`，中英池索引一一对应，绝不跳词；
- **全局同步**：多会话并排时所有活动状态行一起切换；
- **持久化**：选择写入 `localStorage`（`dsh-deep-verbs:lang`），下次打开自动恢复；
- **用户操作优先**：点击会重置 3 秒保底窗口，防止随后的自动轮换立刻把刚选的语言换掉。

## 短语池

### 原创 13 条

| 英文 | 中文 | 含义 |
| --- | --- | --- |
| `Deep diving...` | `深潜中…` | 原版：潜水 |
| `Deep seeking...` | `深度求索中…` | DeepSeek 官方中文名，点题 |
| `Deep delving...` | `刨根问底中…` | delve into，深入探究 |
| `Deep surfacing...` | `喷涂彩虹中…` | 潜完上浮换气（鲸喷水柱像彩虹） |
| `Deep breaching...` | `跃出海面中…` | 鲸跃出水（致敬 whale logo） |
| `Deep bubbling...` | `海底冒泡中…` | 在深海冒泡泡 |
| `Deep singing...` | `引吭高歌中…` | 鲸歌 |
| `Deep fishing...` | `摸鱼中…` | 深度摸鱼 |
| `Deep sinking...` | `沉底中…` | 沉下去慢慢想 |
| `Deep sleeping...` | `呼呼大睡中…` | 睡着了（长思考自嘲） |
| `Deep napping...` | `偷偷打盹中…` | 打盹中（长思考自嘲） |
| `Deep dreaming...` | `白日做梦中…` | 做梦中 |
| `Deep cooking...` | `小火慢炖中…` | let me cook（慢慢酝酿） |

### 扩充 40 条（Claude Code spinner 词表）

> 以下 40 条取自 Claude Code 的 spinner 词表（`github.com/ConardLi/easy-agent`），按烹饪/探索/头脑/鲸鱼/俏皮/摸鱼/科学/存在/放飞分类。

| 分类 | 英文 | 中文 |
| --- | --- | --- |
| 烹饪 | `Deep baking...` | `烘焙中…` |
| 烹饪 | `Deep brewing...` | `酿造中…` |
| 烹饪 | `Deep caramelizing...` | `熬糖色中…` |
| 烹饪 | `Deep fermenting...` | `发酵中…` |
| 烹饪 | `Deep flambéing...` | `喷火炙烤中…` |
| 烹饪 | `Deep frosting...` | `抹奶油中…` |
| 烹饪 | `Deep garnishing...` | `摆盘中…` |
| 烹饪 | `Deep julienning...` | `切丝中…` |
| 烹饪 | `Deep kneading...` | `揉面中…` |
| 烹饪 | `Deep leavening...` | `发面中…` |
| 烹饪 | `Deep marinating...` | `腌制入味中…` |
| 烹饪 | `Deep proofing...` | `醒面中…`（面团休息=思考） |
| 烹饪 | `Deep sautéing...` | `爆炒中…` |
| 烹饪 | `Deep seasoning...` | `调味中…` |
| 烹饪 | `Deep simmering...` | `咕嘟咕嘟中…` |
| 烹饪 | `Deep stewing...` | `文火炖煮中…` |
| 烹饪 | `Deep tempering...` | `回火中…` |
| 烹饪 | `Deep whisking...` | `打发中…` |
| 烹饪 | `Deep zesting...` | `削皮中…` |
| 探索 | `Deep spelunking...` | `洞窟探秘中…`（deep diving 的地洞亲戚） |
| 探索 | `Deep burrowing...` | `挖洞中…` |
| 头脑 | `Deep ruminating...` | `反刍中…`（反刍式思考） |
| 头脑 | `Deep incubating...` | `孵化中…` |
| 头脑 | `Deep percolating...` | `渗滤中…`（咖啡慢慢滴） |
| 鲸鱼 | `Deep honking...` | `哔哔鸣笛中…`（whale honk） |
| 俏皮 | `Deep noodling...` | `瞎鼓捣中…` |
| 俏皮 | `Deep doodling...` | `涂鸦中…` |
| 俏皮 | `Deep waddling...` | `摇摇晃晃中…` |
| 俏皮 | `Deep frolicking...` | `撒欢中…` |
| 俏皮 | `Deep moseying...` | `溜达中…` |
| 俏皮 | `Deep moonwalking...` | `太空步中…` |
| 摸鱼 | `Deep photosynthesizing...` | `光合作用中…`（发呆晒太阳） |
| 科学 | `Deep precipitating...` | `沉淀中…` |
| 存在 | `Deep combobulating...` | `拼拼凑凑中…` |
| 存在 | `Deep recombobulating...` | `重组中…` |
| 放飞 | `Deep levitating...` | `悬空冥想中…` |
| 放飞 | `Deep metamorphosing...` | `蜕变中…` |
| 放飞 | `Deep zigzagging...` | `蛇皮走位中…` |
| 放飞 | `Deep boondoggling...` | `瞎忙活中…` |
| 放飞 | `Deep gallivanting...` | `到处浪中…` |

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

## 工作原理（为什么不用改源码）

- DSH 内置 TurnStatus 渲染为 `<div role="status">Deep diving...<span>计时</span></div>`；React 每秒重渲但字符串 child 不变时**不会回写 DOM 文本节点**——插件在浏览器侧改写该文本节点即可长期保留。
- 轮换是**事件驱动**的：每个对话行（`ChatNodeSeat`）都带宿主自用的 `data-chat-flow-kind` 标记（DSH 滚动锚定依赖它，属稳定实现细节）；新挂载 `assistant-step` / `tool-call` / `model-retry` 行 = 一次轮换事件。
- `MutationObserver` **只订阅 childList**（流式文本变更不触发扫描），同时承担认领新回合状态行与捕获轮换事件；3 秒一次维护扫描只负责认领兜底、修复 React 回写内置文案的极端情况，以及后台标签页定时器被节流时兜住补切（不推进短语）。
- 点击切换的监听在认领状态行时挂上，`cursor` / `title` 提示不在 React vdom 里，重渲不会回写覆盖（与文本节点同理）。
- 所有 DOM 写入走「同值不写」守卫：`Text.data` 赋值即使值不变也会入队 mutation record，抽中原版文案时同值覆写会形成 sweep→observe→sweep 微任务风暴（2026-08-17 冻结事故，已在 v0.2.1 修复并有回归测试）。

## 注意事项

- DSH 升级若改掉内置文案 `Deep diving...`，插件自动退化为 no-op；若改掉 `data-chat-flow-kind` 标记，则退化为「回合开场换词、回合内不轮换」——均不影响任何界面。
- 短语池、切换间隔、语言记忆键都在 `client.js` 顶部常量区，可自行调整。

## 自定义

改 `client.js` 里的 `PHRASES_EN` / `PHRASES_ZH` 两个数组即可：英文保持小写 `deep xxxing` 格式（展示时自动首字母大写并加 `...`），中文保持「…中」后缀格式（展示时自动加 `…`）；两个数组**索引一一对应**——同一索引 = 同一条短语，点击切换语言时按索引对应。两次切换的最小间隔在 `MIN_SWITCH_MS`（默认 3000ms，纯下限而非节拍——事件来得慢就换得慢）。保存后重启 DSH 生效。

## 开发自测

```bash
node verify.mjs
```

用极小 DOM shim + 假时钟驱动 bundle 的改写/轮换/保底节流/风暴回归/中英切换全路径，无需浏览器。

## 卸载

删除 `profiles/node_modules/dsh-deep-verbs` 链接，并移除 `cordis.patch.yml` 中对应的 `- insert` 块，重启 DSH。
