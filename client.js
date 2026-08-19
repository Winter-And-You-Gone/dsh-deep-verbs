// dsh-more-emotions: DeepSeek Harness 前端插件（纯插件，不改 DSH 源码）。
//
// 行为：把内置 ChatView 思考状态行的 "Deep diving..." 换成 deep 系短语轮换。
//   - 短语池 13 条（含原版 deep diving），洗牌袋抽取：一袋之内不重复、
//     袋与袋交界也不连出同一条；
//   - 回合开场换新的一条，之后每 3 秒自动换下一条；
//   - 同一时刻多个状态行（多会话并排）同步显示同一条；
//   - 计时器（15 秒后出现的 "N分N秒"）是兄弟 <span>，不受影响。
//
// 实现方式：DOM 文本节点改写，不覆盖任何渲染插槽。
//   ui-conversation 的 TurnStatus 渲染结构是
//     <div role="status" aria-live="polite">Deep diving...<span>…clock…</span></div>
//   React 每秒重渲该组件，但 vdom 的字符串 child（"Deep diving..."）前后不变时
//   React 不会回写 DOM 文本节点，外部改写得以原样保留；回合结束元素卸载、
//   新回合挂载出新文本节点时，MutationObserver 捕获并认领。即便某天 React
//   真的回写了内置文案，sweep/tick 也会把当前短语补回去。
//   只认精确的内置文本 "Deep diving..."；DSH 未来改掉这句文案时本插件
//   自动退化为 no-op，绝不破坏界面。
// Bundle 格式遵循 DSH client 模块系统：window.__ModuleLoader__.load({id, factory})。
// 纯浏览器实现：无 require 依赖，host（Node）进程误导入本文件时静默跳过。
if (typeof window !== "undefined" && window.__ModuleLoader__) {
window.__ModuleLoader__.load({
	id: "dsh-more-emotions",
	factory: (require) => {
		"use strict";
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// ---- 内置文案锚点（改文案 = 自动停用，见文件头） ----
		var BUILTIN = "Deep diving...";

		// ---- 轮换节奏 ----
		var ROTATE_MS = 3000;

		// ---- 短语池：展示为首字母大写 + "..." ----
		var PHRASES = [
			"deep diving",    // 原版：潜水
			"deep seeking",   // 点题：deep seek 动词化
			"deep delving",   // delve into，深入探究
			"deep surfacing", // 潜完上浮换气
			"deep breaching", // 鲸跃出水（whale logo 致敬）
			"deep bubbling",  // 在深海冒泡泡
			"deep singing",   // 鲸歌
			"deep fishing",   // 深度摸鱼
			"deep sinking",   // 沉下去慢慢想
			"deep sleeping",  // 睡着了（长思考自嘲）
			"deep napping",   // 打盹中（长思考自嘲）
			"deep dreaming",  // 做梦中
			"deep cooking"    // let me cook
		];

		function labelFor(phrase) {
			return phrase.charAt(0).toUpperCase() + phrase.slice(1) + "...";
		}

		// ---- 洗牌袋：一袋抽完才补充，保证短期不重复；
		//      袋与袋交界处换掉尾部，避免跨袋连续同一条 ----
		var bag = [];
		var lastIndex = -1;
		function nextPhrase() {
			if (bag.length === 0) {
				bag = PHRASES.map(function (_, i) { return i; });
				for (var i = bag.length - 1; i > 0; i--) {
					var j = Math.floor(Math.random() * (i + 1));
					var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
				}
				if (lastIndex >= 0 && bag.length > 1 && bag[bag.length - 1] === lastIndex) {
					var k = Math.floor(Math.random() * (bag.length - 1));
					var u = bag[k]; bag[k] = bag[bag.length - 1]; bag[bag.length - 1] = u;
				}
			}
			lastIndex = bag.pop();
			return labelFor(PHRASES[lastIndex]);
		}

		// ---- 改写状态 ----
		// tracked：已认领的思考状态行（WeakSet 随元素卸载自动回收）；
		// current：全局当前短语，所有活动状态行同步显示，轮换只推进这一个。
		var tracked = new WeakSet();
		var current = null;

		function statusList() {
			return document.querySelectorAll('div[role="status"]');
		}

		function applyTo(el, label) {
			var first = el.firstChild;
			if (first && first.nodeType === 3) first.data = label;
		}

		/** 扫描：认领新挂载的思考状态行；兜底 React 回写。
		 *  返回本次是否认领了新元素（供 rotate 决定是否推进短语）。 */
		function sweep() {
			var list = statusList();
			var hadTracked = false;
			for (var i = 0; i < list.length; i++) {
				if (tracked.has(list[i])) { hadTracked = true; break; }
			}
			var claimed = false;
			for (var j = 0; j < list.length; j++) {
				var el = list[j];
				var first = el.firstChild;
				if (!first || first.nodeType !== 3) continue;
				if (tracked.has(el)) {
					// 兜底：React 若回写了内置文案，恢复当前短语
					if (first.data === BUILTIN && current !== null) first.data = current;
					continue;
				}
				if (first.data !== BUILTIN) continue; // 不是思考状态行，不碰
				tracked.add(el);
				claimed = true;
				// 此前已无活动状态行 = 新回合开场：从袋里取新的一条
				if (!hadTracked) current = nextPhrase();
				if (current === null) current = nextPhrase();
				first.data = current;
			}
			return claimed;
		}

		/** 3 秒轮换：先扫描认领，再取下一条同步到所有活动状态行。 */
		function rotate() {
			var claimed = sweep();
			if (claimed) return; // 刚认领的开场词先亮 3 秒，下个周期再换
			var list = statusList();
			var live = [];
			for (var i = 0; i < list.length; i++) {
				if (tracked.has(list[i])) live.push(list[i]);
			}
			if (live.length === 0) return;
			current = nextPhrase();
			for (var j = 0; j < live.length; j++) applyTo(live[j], current);
		}

		// observer 回调可能成串到达：合并到微任务里一次扫完
		var scheduled = false;
		function scheduleSweep() {
			if (scheduled) return;
			scheduled = true;
			Promise.resolve().then(function () {
				scheduled = false;
				sweep();
			});
		}

		function start() {
			sweep();
			setInterval(rotate, ROTATE_MS);
			new MutationObserver(scheduleSweep).observe(document.body, {
				childList: true,
				characterData: true,
				subtree: true
			});
		}

		exports.inject = [];
		exports.apply = function () {
			if (document.body) start();
			else document.addEventListener("DOMContentLoaded", start, { once: true });
		};

		return module.exports;
	}
});
}
