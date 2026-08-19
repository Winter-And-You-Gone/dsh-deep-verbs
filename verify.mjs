// dsh-deep-verbs 自测：不依赖浏览器，用极小 DOM shim + 假时钟直接驱动
// client.js bundle 的注册 → materialize → apply → 认领/事件轮换/保底节流/
// 兜底/中英切换全路径。运行：node verify.mjs
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

// ---- 极小 DOM shim：只实现 bundle 用到的表面 ----
function textNode(data) { return { nodeType: 3, data } }

class FakeStatus {
  constructor(data = 'Deep diving...') {
    this.childNodes = [textNode(data)]
    this.style = {}
    this.title = ''
    this._handlers = {}
  }
  get firstChild() { return this.childNodes[0] ?? null }
  addEventListener(type, cb) { (this._handlers[type] ||= []).push(cb) }
  click() { for (const cb of this._handlers.click || []) cb({}) }
  /** 模拟 15 秒后挂上计时 span：文本节点对象保持不变（React 的真实行为） */
  appendClock() { this.childNodes.push({ nodeType: 1, data: '2分09秒' }) }
  /** 模拟 React 回写内置文案（假想的兜底分支） */
  revertBuiltin() { this.childNodes[0].data = 'Deep diving...' }
  get text() { return this.childNodes.map((n) => n.data).join('') }
}

/** 对话行（ChatNodeSeat 的 <div data-chat-flow-kind=...>） */
const row = (kind) => ({
  nodeType: 1,
  hasAttribute: (n) => n === 'data-chat-flow-kind',
  getAttribute: (n) => (n === 'data-chat-flow-kind' ? kind : null),
  querySelectorAll: () => [],
})

/** 一次挂载带出多行的容器节点（大子树整体 mount） */
const rowContainer = (...rows) => ({
  nodeType: 1,
  hasAttribute: () => false,
  getAttribute: () => null,
  querySelectorAll: (sel) => (sel === '[data-chat-flow-kind]' ? rows : []),
})

const statuses = []
let observerCb = null
let observeOptions = null
let maintain = null
let maintainMs = null

// ---- 假时钟：Date.now 可推进，setTimeout 到点自动触发 ----
let now = 1_000_000
Date.now = () => now
let timerSeq = 0
const timers = new Map()
globalThis.setTimeout = (cb, ms) => {
  const id = ++timerSeq
  timers.set(id, { at: now + (ms || 0), cb, done: false })
  return id
}
globalThis.clearTimeout = (id) => { const t = timers.get(id); if (t) t.done = true }
function advance(ms) {
  const target = now + ms
  for (;;) {
    let due = null
    for (const t of timers.values()) {
      if (!t.done && t.at <= target && (!due || t.at < due.at)) due = t
    }
    if (!due) break
    now = due.at
    due.done = true
    due.cb()
  }
  now = target
}

globalThis.window = globalThis // 命中 bundle 顶部的 typeof window 守卫
globalThis.__ModuleLoader__ = {
  load(handoff) { globalThis.__handoff = handoff },
}
globalThis.document = {
  body: {},
  querySelectorAll: (sel) => (sel === 'div[role="status"]' ? [...statuses] : []),
  addEventListener() { throw new Error('DOMContentLoaded 不应被订阅：body 已存在') },
}
globalThis.MutationObserver = class {
  constructor(cb) { observerCb = cb }
  observe(_target, options) { observeOptions = options }
}
globalThis.setInterval = (cb, ms) => { maintain = cb; maintainMs = ms; return 1 }

// ---- localStorage shim：语言选择持久化 ----
const storage = new Map()
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, v),
}

/** 模拟一批 childList mutation（新挂载若干节点）并等微任务里的合并处理跑完 */
const flush = async () => { await Promise.resolve() }
const fireMutations = async (...addedNodes) => {
  observerCb([{ addedNodes }])
  await flush()
}

// ---- 注册 + 物化 bundle ----
const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
vm.runInThisContext(src)
assert.ok(globalThis.__handoff, 'bundle 未注册到 __ModuleLoader__')
assert.equal(globalThis.__handoff.id, 'dsh-deep-verbs')

// require 必须零调用：传一个会抛错的桩证明 bundle 无依赖
const plugin = vm.runInThisContext('globalThis.__handoff.factory((id) => { throw new Error("unexpected require: " + id) })')
assert.equal(typeof plugin.apply, 'function')

plugin.apply()
assert.equal(maintainMs, 3000, '维护扫描周期应为 3000ms')

const ALL = [
  'deep diving', 'deep seeking', 'deep delving', 'deep surfacing', 'deep breaching',
  'deep bubbling', 'deep singing', 'deep fishing', 'deep sinking', 'deep sleeping',
  'deep napping', 'deep dreaming', 'deep cooking',
  // ---- Claude Code spinner 词表扩充（与 client.js 顺序一致）----
  'deep baking', 'deep brewing', 'deep caramelizing', 'deep fermenting', 'deep flambéing',
  'deep frosting', 'deep garnishing', 'deep julienning', 'deep kneading', 'deep leavening',
  'deep marinating', 'deep proofing', 'deep sautéing', 'deep seasoning', 'deep simmering',
  'deep stewing', 'deep tempering', 'deep whisking', 'deep zesting', 'deep spelunking',
  'deep burrowing', 'deep ruminating', 'deep incubating', 'deep percolating', 'deep honking',
  'deep noodling', 'deep doodling', 'deep waddling', 'deep frolicking', 'deep moseying',
  'deep moonwalking', 'deep photosynthesizing', 'deep precipitating', 'deep combobulating',
  'deep recombobulating', 'deep levitating', 'deep metamorphosing', 'deep zigzagging',
  'deep boondoggling', 'deep gallivanting',
  // ---- v0.6.0 追加 20 条（与 client.js 同步）----
  'deep crafting', 'deep forging', 'deep deliberating', 'deep inferring',
  'deep puzzling', 'deep reticulating', 'deep wandering', 'deep meandering',
  'deep orbiting', 'deep cascading', 'deep churning', 'deep billowing',
  'deep swirling', 'deep undulating', 'deep fluttering', 'deep swooping',
  'deep shimmying', 'deep grooving', 'deep lollygagging', 'deep sprouting',
].map((p) => p.charAt(0).toUpperCase() + p.slice(1) + '...')
const inPool = (s) => ALL.includes(s)
const ALL_ZH = [
  '深潜中', '深度求索中', '刨根问底中', '喷涂彩虹中', '跃出海面中',
  '海底冒泡中', '引吭高歌中', '摸鱼中', '沉底中', '呼呼大睡中',
  '偷偷打盹中', '白日做梦中', '小火慢炖中',
  '烘焙中', '酿造中', '熬糖色中', '发酵中', '喷火炙烤中',
  '抹奶油中', '摆盘中', '切丝中', '揉面中', '发面中',
  '腌制入味中', '醒面中', '爆炒中', '调味中', '咕嘟咕嘟中',
  '文火炖煮中', '回火中', '打发中', '削皮中', '洞窟探秘中',
  '挖洞中', '反刍中', '孵化中', '渗滤中', '哔哔鸣笛中',
  '瞎鼓捣中', '涂鸦中', '摇摇晃晃中', '撒欢中', '溜达中',
  '太空步中', '光合作用中', '沉淀中', '拼拼凑凑中', '重组中',
  '悬空冥想中', '蜕变中', '蛇皮走位中', '瞎忙活中', '到处浪中',
  // ---- v0.6.0 追加 20 条 ----
  '打磨中', '锻造中', '斟酌中', '推演中',
  '解谜中', '编织中', '游弋中', '漫步中',
  '绕飞中', '飞瀑中', '翻腾中', '鼓涌中',
  '回旋中', '起伏中', '扑棱中', '俯冲中',
  '扭摆中', '踩点中', '磨洋工中', '冒芽中',
].map((p) => p + '…')
const inPoolZh = (s) => ALL_ZH.includes(s)

// ---- 1) 认领：新回合挂载 → 短语池内的一条 ----
const s1 = new FakeStatus()
statuses.push(s1)
await fireMutations(s1)
assert.ok(inPool(s1.text), `认领后应在短语池内：${s1.text}`)
assert.ok(s1.text.endsWith('...'), '应保留省略号')

// ---- 2) 事件驱动轮换：新 assistant-step / tool-call 行 → 换词 ----
// 开场词刚认领，事件必须先过保底窗口；窗口外的事件立即切换
const labels = [s1.text]
for (let i = 0; i < 15; i++) {
  advance(3000)
  await fireMutations(row(i % 2 ? 'tool-call' : 'assistant-step'))
  assert.ok(inPool(s1.text), `第 ${i + 1} 次事件轮换应在池内：${s1.text}`)
  assert.notEqual(s1.text, labels[labels.length - 1], `第 ${i + 1} 次轮换不应与上一条相同`)
  labels.push(s1.text)
}
const unique = new Set(labels)
assert.ok(unique.size >= 10, `16 次展示应覆盖大部分短语，实际 ${unique.size} 种`)
console.log(`  事件轮换：16 个事件周期出现 ${unique.size}/73 种，无连续重复`)

// ---- 2b) 长时间纯思考（无新行挂载、无待切事件）短语保持不变 ----
const quietLabel = s1.text
advance(60_000)
assert.equal(s1.text, quietLabel, '无事件的 60 秒静默不应换词（不再定时轮换）')
await maintain()
assert.equal(s1.text, quietLabel, '维护扫描不得推进短语')
console.log('  长静默：60 秒无事件 + 维护扫描，短语保持不变')

// ---- 3) 保底节流：窗口内事件只记 pending，窗口边界补切一次 ----
// 上一次展示发生在 60 秒前，先制造一次立即切换作为窗口起点
await fireMutations(row('tool-call'))
const anchorLabel = s1.text
advance(100) // 窗口内 100ms
await fireMutations(row('tool-call'))
assert.equal(s1.text, anchorLabel, '窗口内的事件不得立即换词')
advance(200) // 仍在窗口内（距上次切换 300ms）
await fireMutations(row('assistant-step'))
assert.equal(s1.text, anchorLabel, '窗口内第二个事件也不得换词（合并）')
advance(2700) // 到达 lastSwitch + 3000 边界，补切恰好发生一次
assert.notEqual(s1.text, anchorLabel, '窗口边界应补切一次')
assert.ok(inPool(s1.text), `补切后应在池内：${s1.text}`)
const releasedLabel = s1.text
await flush()
assert.equal(s1.text, releasedLabel, '补切后不得再次换词（多事件只合并为一次）')

// ---- 4) 静默已久的事件立即切换（保底只是下限，不是节拍） ----
advance(60_000)
await fireMutations(row('tool-call'))
assert.notEqual(s1.text, releasedLabel, '久违的事件应立即换词')
assert.ok(inPool(s1.text), `立即切换后应在池内：${s1.text}`)

// ---- 5) 计时器共存：切换只动文本节点，clock 原样保留 ----
s1.appendClock()
advance(3000)
await fireMutations(row('assistant-step'))
assert.ok(s1.text.endsWith('2分09秒'), '计时 span 应保留')
assert.ok(inPool(s1.text.slice(0, -'2分09秒'.length)), '切换后短语应在池内')

// ---- 6) React 回写兜底：维护扫描恢复当前短语，且不推进 ----
const beforeRepair = s1.text.slice(0, -'2分09秒'.length)
s1.revertBuiltin()
maintain() // 维护扫描修复，不换词
assert.equal(s1.text, beforeRepair + '2分09秒', '回写后应恢复当前短语（不推进）')

// ---- 7) 非触发 kind 不换词：user / command 不是模型活动 ----
advance(3000)
await fireMutations(row('user'), row('command'))
assert.equal(s1.text.slice(0, -'2分09秒'.length), beforeRepair, 'user/command 行不得触发轮换')

// ---- 8) 重插入去重：同一行对象再次挂载不算新事件 ----
const dupRow = row('tool-call')
await fireMutations(dupRow) // 首次挂载：立即切换（窗口早已过）
const afterFirst = s1.text.slice(0, -'2分09秒'.length)
advance(3000)
await fireMutations(dupRow) // 模拟 React 移除后重插入
assert.equal(s1.text.slice(0, -'2分09秒'.length), afterFirst, '重插入的行不得再次触发')

// ---- 9) 容器挂载：大子树带出的触发行同样计入 ----
advance(3000)
await fireMutations(rowContainer(row('assistant-step'), row('tool-call')))
assert.notEqual(s1.text.slice(0, -'2分09秒'.length), afterFirst, '容器内的新行应触发轮换')

// ---- 10) 回合未运行时的事件被忽略，且不得泄漏 pending 到下一回合 ----
statuses.length = 0
await fireMutations(row('tool-call'))
advance(10_000)
const s2 = new FakeStatus()
statuses.push(s2)
await fireMutations(s2)
const turnLabel = s2.text
assert.ok(inPool(turnLabel), `新回合短语应在池内：${turnLabel}`)
assert.notEqual(turnLabel, beforeRepair, '新回合开场应换新词')
advance(5000) // 若上一回合的事件泄漏成 pending，此处会提前换词
assert.equal(s2.text, turnLabel, '无事件时不得换词（pending 未泄漏）')

// ---- 11) 新回合开场的保底窗口：认领后 3 秒内的事件推迟补切 ----
await fireMutations(row('assistant-step')) // 距认领 5 秒，立即切换
const midLabel = s2.text
advance(100)
await fireMutations(row('tool-call'))
assert.equal(s2.text, midLabel, '新词亮够 3 秒前不得再切')
advance(2900)
assert.notEqual(s2.text, midLabel, '到点应补切')

// ---- 12) 风暴回归：current 恰为原版 "Deep diving..." 时零写入 ----
// 2026-08-17 冻结事故：Text.data 同值赋值也会入队 characterData mutation
// record，恢复分支的同值覆写会再次触发本插件自己的 observer，形成
// sweep→observe→sweep 微任务风暴饿死事件循环。修复后的不变量：
// 状态行文本已等于 current（含 current === BUILTIN 的稳态）时，
// 任意次 observer→sweep 循环 / 维护扫描都不得产生任何 DOM 写入。
{
  let writes = 0
  const countingNode = (data) => {
    let v = data
    return { nodeType: 3, get data() { return v }, set data(x) { writes++; v = x } }
  }
  const s3 = {
    childNodes: [countingNode('Deep diving...')],
    get firstChild() { return this.childNodes[0] ?? null },
    get text() { return this.childNodes[0].data },
    style: {},
    title: '',
    addEventListener() {},
  }
  statuses.length = 0
  statuses.push(s3)
  await fireMutations(s3) // 认领（写入 0 或 1 次均合法，取决于袋首是否抽中原版）

  // 驱动事件轮换直到抽中原版短语（一袋 73，袋尾跨袋会换位，150 内必现）
  let hit = 0
  for (let i = 0; i < 150 && s3.text !== 'Deep diving...'; i++) {
    advance(3000)
    await fireMutations(row('tool-call'))
    hit++
  }
  assert.equal(s3.text, 'Deep diving...', '150 次事件内应轮换到原版短语')

  // 稳态风暴检验：current === BUILTIN 窗口内，sweep 循环与维护扫描零写入
  const steady = writes
  for (let i = 0; i < 5; i++) await fireMutations()
  for (let i = 0; i < 5; i++) maintain()
  assert.equal(writes, steady, `current===BUILTIN 稳态下扫描不得写 DOM（多写了 ${writes - steady} 次）`)

  // React 回写兜底同样不得同值覆写（旧代码的风暴入口）
  s3.childNodes[0].data = 'Deep diving...' // 模拟 React 回写（值恰好相同；此行本身 +1 次）
  const afterReact = writes
  for (let i = 0; i < 5; i++) maintain()
  assert.equal(writes, afterReact, '回写兜底遇 current===BUILTIN 必须跳过写入')

  console.log(`  风暴回归：${hit === 0 ? '认领袋首' : `第 ${hit} 次轮换`}抽中原版短语，稳态 10 轮扫描零写入`)
}

// ---- 13) 同批挂载多行同步：多会话并排复用同一条短语 ----
{
  const a = new FakeStatus()
  const b = new FakeStatus()
  statuses.length = 0
  statuses.push(a, b)
  await fireMutations(a, b)
  assert.ok(inPool(a.text), `首行应在短语池内：${a.text}`)
  assert.equal(a.text, b.text, `同批挂载的两行应显示同一条：${a.text} vs ${b.text}`)
  console.log(`  同批同步：两行同时挂载均显示 ${a.text}`)
}

// ---- 14) observer 订阅面契约：仅 childList+subtree，不订阅 characterData ----
// characterData 会让流式输出的每次文本变更都触发全文档扫描（2026-08-17
// review 建议项，已实施）；此断言防止未来被随手加回去。
assert.ok(observeOptions && observeOptions.childList === true && observeOptions.subtree === true,
  `应订阅 childList+subtree：${JSON.stringify(observeOptions)}`)
assert.ok(!observeOptions.characterData, '不得订阅 characterData（流式期间高频文本变更会放大扫描开销）')
console.log('  订阅面：childList+subtree only（characterData 未订阅）')

// ---- 15) 点击切换中英文：同一短语换语言 + 多行同步 + 窗口重置 + 持久化 ----
{
  const a = new FakeStatus()
  const b = new FakeStatus()
  statuses.length = 0
  statuses.push(a, b)
  await fireMutations(a, b)
  assert.ok(inPool(a.text) && inPool(b.text), `初始应为英文池：${a.text}`)
  assert.equal(a.title, '点击切换为中文', '认领后应有可点击提示')
  assert.equal(a.style.cursor, 'pointer', '认领后应有 pointer 光标')

  const enIdx = ALL.indexOf(a.text)
  a.click() // 点任意一行 → 所有活动行一起切换
  assert.equal(a.text, ALL_ZH[enIdx], '点击后应显示同一条短语的中文版')
  assert.equal(b.text, ALL_ZH[enIdx], '多行同步：其他活动行一起换语言')
  assert.equal(a.title, '点击切换为 English', '切换后提示语应更新')
  assert.equal(storage.get('dsh-deep-verbs:lang'), 'zh', '语言选择应写入 localStorage')

  // 点击重置了保底窗口：3 秒内的事件不换词
  await fireMutations(row('tool-call'))
  assert.equal(a.text, ALL_ZH[enIdx], '切换语言后 3 秒内事件不得换词')
  advance(3000) // 窗口边界：pending 补切一次
  assert.ok(inPoolZh(a.text), `窗口外应在中文池内轮换：${a.text}`)
  assert.notEqual(a.text, ALL_ZH[enIdx], '窗口外事件应换新词')

  // 再点一次切回英文
  b.click()
  assert.ok(inPool(a.text), `再点一次应切回英文池：${a.text}`)
  assert.equal(b.text, a.text, '切回英文后多行仍同步')
  assert.equal(storage.get('dsh-deep-verbs:lang'), 'en', '切回英文应更新持久化')
  console.log(`  点击切换：${ALL_ZH[enIdx]} ↔ 英文池，多行同步 + localStorage 记忆`)
}

// ---- 16) 语言持久化：重新 materialize 后从 localStorage 恢复中文 ----
{
  storage.set('dsh-deep-verbs:lang', 'zh')
  vm.runInThisContext(src) // 重新注册 handoff（模拟页面重载）
  const plugin2 = vm.runInThisContext('globalThis.__handoff.factory((id) => { throw new Error("unexpected require: " + id) })')
  assert.equal(typeof plugin2.apply, 'function')
  statuses.length = 0
  plugin2.apply()
  const s = new FakeStatus()
  statuses.push(s)
  await fireMutations(s)
  assert.ok(inPoolZh(s.text), `重载后应从 localStorage 恢复中文池：${s.text}`)
  storage.set('dsh-deep-verbs:lang', 'en') // 复位，防影响其他用例
  console.log('  语言持久化：重载后恢复上次选择的中文池')
}

console.log('dsh-deep-verbs verify: all 16 checks passed ✓')
