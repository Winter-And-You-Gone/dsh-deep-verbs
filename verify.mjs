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
globalThis.MutationObserver = class {
  constructor(cb) { observerCb = cb }
  observe() {}
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

// ---- 4) React 回写兜底：恢复当前短语（不是内置文案，也不是别的词） ----
const before = s1.text.slice(0, -'2分09秒'.length)
s1.revertBuiltin()
await flushSweep()
assert.equal(s1.text, before + '2分09秒', '回写后应恢复当前短语')

// ---- 5) 新回合：旧元素卸载后新元素认领新词（与上一条不同） ----
const lastLabel = before
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

console.log('dsh-deep-verbs verify: all 8 checks passed ✓')
