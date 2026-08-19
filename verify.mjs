// dsh-deep-verbs 自测：不依赖浏览器，用极小 DOM shim 直接驱动 client.js
// bundle 的注册 → materialize → apply → 认领/3秒轮换/兜底全路径。
// 运行：node verify.mjs
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

// ---- 极小 DOM shim：只实现 bundle 用到的表面 ----
function textNode(data) { return { nodeType: 3, data } }

class FakeStatus {
  constructor(data = 'Deep diving...') {
    this.childNodes = [textNode(data)]
  }
  get firstChild() { return this.childNodes[0] ?? null }
  /** 模拟 15 秒后挂上计时 span：文本节点对象保持不变（React 的真实行为） */
  appendClock() { this.childNodes.push({ nodeType: 1, data: '2分09秒' }) }
  /** 模拟 React 回写内置文案（假想的兜底分支） */
  revertBuiltin() { this.childNodes[0].data = 'Deep diving...' }
  get text() { return this.childNodes.map((n) => n.data).join('') }
}

const statuses = []
let observerCb = null
let tick = null
let tickMs = null

globalThis.window = globalThis // 命中 bundle 顶部的 typeof window 守卫
globalThis.__ModuleLoader__ = {
  load(handoff) { globalThis.__handoff = handoff },
}
globalThis.document = {
  body: {},
  querySelectorAll: (sel) => (sel === 'div[role="status"]' ? [...statuses] : []),
  addEventListener() { throw new Error('DOMContentLoaded 不应被订阅：body 已存在') },
}
let observeOptions = null
globalThis.MutationObserver = class {
  constructor(cb) { observerCb = cb }
  observe(_target, options) { observeOptions = options }
}
globalThis.setInterval = (cb, ms) => { tick = cb; tickMs = ms; return 1 }

// ---- 注册 + 物化 bundle ----
const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
vm.runInThisContext(src)
assert.ok(globalThis.__handoff, 'bundle 未注册到 __ModuleLoader__')
assert.equal(globalThis.__handoff.id, 'dsh-deep-verbs')

// require 必须零调用：传一个会抛错的桩证明 bundle 无依赖
const plugin = vm.runInThisContext('globalThis.__handoff.factory((id) => { throw new Error("unexpected require: " + id) })')
assert.equal(typeof plugin.apply, 'function')

plugin.apply()
assert.equal(tickMs, 3000, '轮换周期应为 3000ms')
const flushSweep = async () => { observerCb(); await Promise.resolve() } // 微任务里的合并 sweep

const ALL = [
  'deep diving', 'deep seeking', 'deep delving', 'deep surfacing', 'deep breaching',
  'deep bubbling', 'deep singing', 'deep fishing', 'deep sinking', 'deep sleeping',
  'deep napping', 'deep dreaming', 'deep cooking',
].map((p) => p.charAt(0).toUpperCase() + p.slice(1) + '...')
const inPool = (s) => ALL.includes(s)

// ---- 1) 认领：新回合挂载 → 短语池内的一条 ----
const s1 = new FakeStatus()
statuses.push(s1)
await flushSweep()
assert.ok(inPool(s1.text), `认领后应在短语池内：${s1.text}`)
assert.ok(s1.text.endsWith('...'), '应保留省略号')

// ---- 2) 3 秒轮换：tick 后换词；60 次 tick 无连续重复、全在池内 ----
const labels = [s1.text]
for (let i = 0; i < 60; i++) {
  tick()
  assert.ok(inPool(s1.text), `第 ${i + 1} 次轮换应在池内：${s1.text}`)
  assert.notEqual(s1.text, labels[labels.length - 1], `第 ${i + 1} 次轮换不应与上一条相同`)
  labels.push(s1.text)
}
const unique = new Set(labels)
assert.ok(unique.size >= 10, `60 次轮换应覆盖大部分短语，实际 ${unique.size} 种`)
console.log(`  轮换覆盖：61 个周期出现 ${unique.size}/13 种，无连续重复`)

// ---- 2b) 顺序随机：洗牌袋 = 整袋洗乱后逐个弹出，绝不按列表顺序 ----
// 第一袋 = labels 前 13 条（认领 + 12 次轮换，恰好一整袋的弹出序）
const firstCycle = labels.slice(0, 13)
assert.notDeepEqual(firstCycle, ALL, '不应按列表顺序出现')
// 按列表顺序执行的特征是"每一条都是池中下一条"：随机洗牌下 12 个转移里期望约 1 个
let succ = 0
for (let i = 1; i < firstCycle.length; i++) {
  if (ALL.indexOf(firstCycle[i]) === ALL.indexOf(firstCycle[i - 1]) + 1) succ++
}
assert.ok(succ < 6, `相邻转移过于顺序化（${succ}/12），疑似按列表顺序`)
console.log(`  第一袋实际弹出序（前6条）：${firstCycle.slice(0, 6).join(' → ')}`)

// ---- 3) 计时器共存：轮换只动文本节点，clock 原样保留 ----
s1.appendClock()
tick()
assert.ok(s1.text.endsWith('2分09秒'), '计时 span 应保留')
assert.ok(inPool(s1.text.slice(0, -'2分09秒'.length)), '轮换后短语应在池内')

// ---- 4) React 回写兜底：observer 不订阅 characterData，兜底由 3 秒 tick 的 sweep 修复 ----
s1.revertBuiltin()
tick() // tick 先 sweep（兜底）再推进轮换
assert.ok(inPool(s1.text.slice(0, -'2分09秒'.length)), `回写后 tick 应恢复为池内短语：${s1.text}`)
const lastLabel = s1.text.slice(0, -'2分09秒'.length)

// ---- 5) 新回合：旧元素卸载后新元素认领新词（与上一条不同） ----
statuses.length = 0
const s2 = new FakeStatus()
statuses.push(s2)
await flushSweep()
assert.ok(inPool(s2.text), `新回合短语应在池内：${s2.text}`)
assert.notEqual(s2.text, lastLabel, '新回合开场应换新词')

// ---- 6) 无活动状态行时 tick 安全空转 ----
statuses.length = 0
tick() // 不应抛错、不应推进（无从观察推进，至少证明不崩）

// ---- 7) 陌生文案不碰：role=status 但文本不是内置锚点 ----
const other = new FakeStatus('Uploading assets...')
statuses.length = 0
statuses.push(other)
await flushSweep()
tick()
assert.equal(other.text, 'Uploading assets...', '非内置文案必须原样保留')

// ---- 8) 空元素/无文本节点安全跳过 ----
const bare = { childNodes: [], get firstChild() { return null } }
statuses.length = 0
statuses.push(bare)
await flushSweep()
tick() // 不应抛错

// ---- 9) 风暴回归：current 恰为原版 "Deep diving..." 时零写入 ----
// 2026-08-17 冻结事故：Text.data 同值赋值也会入队 characterData mutation
// record，恢复分支的同值覆写会再次触发本插件自己的 observer，形成
// sweep→observe→sweep 微任务风暴饿死事件循环。修复后的不变量：
// 状态行文本已等于 current（含 current === BUILTIN 的稳态）时，
// 任意次 observer→sweep 循环都不得产生任何 DOM 写入。
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
  }
  statuses.length = 0
  statuses.push(s3)
  await flushSweep() // 认领（写入 0 或 1 次均合法，取决于袋首是否抽中原版）

  // 驱动轮换直到抽中原版短语（13 条洗牌袋，≤13 次 tick 必现）
  let hit = 0
  for (let i = 0; i < 26 && s3.text !== 'Deep diving...'; i++) { tick(); hit++ }
  assert.equal(s3.text, 'Deep diving...', '26 次 tick 内应轮换到原版短语')

  // 稳态风暴检验：current === BUILTIN 窗口内，sweep 循环零写入
  const before = writes
  for (let i = 0; i < 5; i++) await flushSweep()
  assert.equal(writes, before, `current===BUILTIN 稳态下 sweep 不得写 DOM（多写了 ${writes - before} 次）`)

  // React 回写兜底同样不得同值覆写（旧代码的风暴入口）
  s3.childNodes[0].data = 'Deep diving...' // 模拟 React 回写（值恰好相同；此行本身 +1 次）
  const afterReact = writes
  for (let i = 0; i < 5; i++) await flushSweep()
  assert.equal(writes, afterReact, '回写兜底遇 current===BUILTIN 必须跳过写入')

  console.log(`  风暴回归：${hit === 0 ? '认领袋首' : `第 ${hit} 次轮换`}抽中原版短语，稳态 10 轮 sweep 零写入`)
}

// ---- 10) 同批挂载多行同步：多会话并排复用同一条短语 ----
// hadTracked 在认领后立刻置位，同一批挂载的第二行不再另抽（否则 3 秒内
// 两行显示不同短语，违反「多会话并排同步显示同一条」的文档承诺）。
{
  const a = new FakeStatus()
  const b = new FakeStatus()
  statuses.length = 0
  statuses.push(a, b)
  await flushSweep()
  assert.ok(inPool(a.text), `首行应在短语池内：${a.text}`)
  assert.equal(a.text, b.text, `同批挂载的两行应显示同一条：${a.text} vs ${b.text}`)
  console.log(`  同批同步：两行同时挂载均显示 ${a.text}`)
}

// ---- 11) observer 订阅面契约：仅 childList+subtree，不订阅 characterData ----
// characterData 会让流式输出的每次文本变更都触发全文档扫描（2026-08-17
// review 建议项，已实施）；此断言防止未来被随手加回去。
assert.ok(observeOptions && observeOptions.childList === true && observeOptions.subtree === true,
  `应订阅 childList+subtree：${JSON.stringify(observeOptions)}`)
assert.ok(!observeOptions.characterData, '不得订阅 characterData（流式期间高频文本变更会放大扫描开销）')
console.log('  订阅面：childList+subtree only（characterData 未订阅）')

console.log('dsh-deep-verbs verify: all 11 checks passed ✓')
