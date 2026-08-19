# dsh-more-emotions

DeepSeek Harness（DSH）纯前端插件：给思考状态行加表情。

内置 UI 在模型思考/执行时显示 `Deep diving...`（15 秒后附计时）。本插件把它扩展成 13 条 deep 系短语：**每个回合开场随机一条，之后每 3 秒自动换下一条**（洗牌袋抽取，短期不重复、不连出同一条），计时器不受影响。

## 短语池

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

## 安装

```powershell
pwsh install.ps1            # 或 powershell -ExecutionPolicy Bypass -File install.ps1
```

脚本会自动：优先选择 `~/.dsh/profiles/desktop`（桌面版），否则 `profiles/web`；把本目录 Junction 链接进 `profiles/node_modules/dsh-more-emotions`；在 profile 的 `cordis.patch.yml` 注册 insert。

然后**完全退出 DSH 进程**再重启（不是关窗口），自带窗口重启即可，浏览器访问则刷新页面。

手动安装等价于：

1. `mklink /J %USERPROFILE%\.dsh\profiles\node_modules\dsh-more-emotions <本目录>`
2. 在 `<profile>\cordis.patch.yml` 追加：
   ```yaml
   - insert:
       - id: dsh-more-emotions
         name: 'dsh-more-emotions'
   ```
3. 重启 DSH。

## 工作原理

不改 DSH 源码、不覆盖渲染插槽。`ui-conversation` 的 TurnStatus 渲染为
`<div role="status">Deep diving...<span>计时</span></div>`；React 每秒重渲但字符串 child 不变时不会回写 DOM 文本节点，因此插件在浏览器侧把该文本节点改写成当前短语即可长期保留。`MutationObserver` 认领新回合挂载的状态元素，`setInterval` 每 3 秒推进一次洗牌袋并同步到所有活动状态行（多会话并排时保持同一条）；若 React 某天回写了内置文案，扫描时会把当前短语补回去。

插件只匹配精确的内置文本 `Deep diving...`：未来 DSH 改动这句文案时，插件自动退化为 no-op，不影响任何界面。

## 自定义

改 `client.js` 里的 `PHRASES` 数组即可（保持小写、`deep xxxing` 格式；展示时自动首字母大写并加 `...`）；轮换节奏在 `ROTATE_MS`。保存后重启 DSH 生效。

## 开发自测

```bash
node verify.mjs
```

用极小 DOM shim 驱动 bundle 的改写/轮换/兜底路径，无需浏览器。

## 卸载

删除 `profiles/node_modules/dsh-more-emotions` 链接，并移除 `cordis.patch.yml` 中对应的 `- insert` 块，重启 DSH。
