// dsh-deep-verbs: DeepSeek Harness 前端插件（纯插件，不改 DSH 源码）。
//
// 行为：把内置 ChatView 思考状态行的 "Deep diving..." 换成 deep 系短语轮换。
//   - 短语池 53 条（含原版 deep diving），洗牌袋抽取：一袋之内不重复、
//     袋与袋交界也不连出同一条；
//   - 事件驱动轮换：对话区新挂载「思考/回答段」(assistant-step) 或「工具调用」
//     (tool-call / model-retry) 行时切换到下一条短语；长时间纯思考（没有新行
//     挂载）时短语保持不变；
//   - 保底节流：两次切换至少间隔 MIN_SWITCH_MS（3 秒）；落在窗口内的事件
//     合并为窗口边界的一次补切（连续快速的工具调用只换一次词）；
//   - 回合开场（状态行首次挂载）随机一条开场短语；
//   - 同一时刻多个状态行（多会话并排）同步显示同一条（事件不区分会话）；
//   - 计时器（15 秒后出现的 "N分N秒"）是兄弟 <span>，不受影响；
//   - 中英双语：53 条短语各有英文/中文版本（索引一一对应），点击思考状态行
//     在两种语言间切换：同一条短语换语言展示、不重新抽取；语言选择存
//     localStorage，重载后恢复。
//
// 实现方式：DOM 文本节点改写，不覆盖任何渲染插槽。
//   ui-conversation 的 TurnStatus 渲染结构是
//     <div role="status" aria-live="polite">Deep diving...<span>…clock…</span></div>
//   React 每秒重渲该组件，但 vdom 的字符串 child（"Deep diving..."）前后不变时
//   React 不会回写 DOM 文本节点，外部改写得以原样保留；回合结束元素卸载、
//   新回合挂载出新文本节点时，MutationObserver（仅订阅 childList）捕获并认领。
//   轮换事件来自同一 observer：ChatNodeSeat 渲染的每个对话行都带宿主自用的
//     data-chat-flow-kind = user | assistant-step | tool-call | ...
//   （DSH 滚动锚定依赖该标记，属稳定实现细节）。新挂载、种类在触发集内、
//   没见过（WeakSet 去重重插入）的行 = 一次轮换事件；流式 token 只更新既有
//   行内部、不挂新行，不会误触发。
//   若 DSH 未来改掉 BUILTIN 文案，插件退化为 no-op；改掉 data-chat-flow-kind
//   则退化为「回合开场换词、回合内不轮换」——均不影响任何界面。
//   - 所有 DOM 写入走 setText()「同值不写」：Text.data 赋值即使值不变也会
//     入队 characterData mutation record 并再次触发本插件自己的 observer；
//     当轮换抽中原版 "deep diving"（与内置文案逐字相同）时，同值覆写会形成
//     sweep→observe→sweep 微任务风暴，饿死事件循环、冻结整个前端
//     （2026-08-17 DSH Desktop 冻结事故，CDP 三次采样实锤）。
//   - 点击切换中英文：认领状态行时挂 click 监听，并加 cursor:pointer 与
//     title 提示。React 每秒重渲该组件但 vdom 不含这两项（与文本节点同理，
//     不会回写覆盖）；点击只换语言、保留当前短语，并重置保底节流窗口，
//     防止随后的自动轮换立刻覆盖用户的选择。
// Bundle 格式遵循 DSH client 模块系统：window.__ModuleLoader__.load({id, factory})。
// 纯浏览器实现：无 require 依赖，host（Node）进程误导入本文件时静默跳过。
if (typeof window !== "undefined" && window.__ModuleLoader__) {
window.__ModuleLoader__.load({
	id: "dsh-deep-verbs",
	factory: (require) => {
		"use strict";
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// ---- 内置文案锚点（改文案 = 自动停用，见文件头） ----
		var BUILTIN = "Deep diving...";

		// ---- 保底节流：两次短语切换（含开场认领）的最小间隔 ----
		var MIN_SWITCH_MS = 3000;

		// ---- 维护扫描节奏：认领兜底 / React 回写修复（不推进短语） ----
		var MAINTAIN_MS = 3000;

		// ---- 语言：默认英文，点击状态行切换；localStorage 记忆，
		//      重载后恢复（隐私模式等不可用场景下维持英文） ----
		var LANG_KEY = "dsh-deep-verbs:lang";
		var lang = "en";
		try {
			if (localStorage.getItem(LANG_KEY) === "zh") lang = "zh";
		} catch (e) { /* 不可用则维持默认 */ }

		// ---- 轮换事件源：新挂载对话行的 data-chat-flow-kind 触发集 ----
		// assistant-step = 新的思考/回答段；tool-call = 新的（根）工具调用；
		// model-retry = 重试即重新生成。user/steering/command 等非模型活动不算。
		var TRIGGER_KINDS = {
			"assistant-step": 1,
			"tool-call": 1,
			"model-retry": 1
		};
		var FLOW_KIND_ATTR = "data-chat-flow-kind";
		var FLOW_SEL = "[data-chat-flow-kind]";

		// ---- 短语池：英/中各 53 条，索引一一对应（点击切换语言时保留
		//      同一条短语）；展示：英文首字母大写 + "..."，中文「…中」
		//      进行时 + "…"（与英文 -ing 对应，俏皮向） ----
		var PHRASES_EN = [
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
			"deep cooking",   // let me cook
			// ---- 以下扩充来自 Claude Code spinner 词表
			//      （github.com/ConardLi/easy-agent）----
			"deep baking",    // 烹饪系：烘焙
			"deep brewing",   // 烹饪系：酿造
			"deep caramelizing", // 烹饪系：熬糖色
			"deep fermenting",   // 烹饪系：发酵
			"deep flambéing",    // 烹饪系：喷火炙烤
			"deep frosting",     // 烹饪系：抹奶油
			"deep garnishing",   // 烹饪系：摆盘
			"deep julienning",   // 烹饪系：切丝
			"deep kneading",     // 烹饪系：揉面
			"deep leavening",    // 烹饪系：发面
			"deep marinating",   // 烹饪系：腌制入味
			"deep proofing",     // 烹饪系：醒面（面团休息=思考）
			"deep sautéing",     // 烹饪系：爆炒
			"deep seasoning",    // 烹饪系：调味
			"deep simmering",    // 烹饪系：咕嘟冒泡
			"deep stewing",      // 烹饪系：文火炖煮
			"deep tempering",    // 烹饪系：回火
			"deep whisking",     // 烹饪系：打发
			"deep zesting",      // 烹饪系：削皮
			"deep spelunking",   // 探索：探洞（deep diving 的地洞亲戚）
			"deep burrowing",    // 探索：往地底钻
			"deep ruminating",   // 头脑：反刍式思考
			"deep incubating",   // 头脑：孵蛋等结果
			"deep percolating",  // 头脑：咖啡渗滤
			"deep honking",      // 鲸鱼：鸣笛（whale honk）
			"deep noodling",     // 俏皮：瞎鼓捣
			"deep doodling",     // 俏皮：涂鸦开小差
			"deep waddling",     // 俏皮：摇摇晃晃
			"deep frolicking",   // 俏皮：撒欢
			"deep moseying",     // 俏皮：慢悠悠溜达
			"deep moonwalking",  // 俏皮：太空步
			"deep photosynthesizing", // 摸鱼：光合作用发呆
			"deep precipitating",     // 科学：沉淀
			"deep combobulating",     // 存在：拼拼凑凑
			"deep recombobulating",   // 存在：重组
			"deep levitating",        // 放飞：悬空冥想
			"deep metamorphosing",    // 放飞：蜕变
			"deep zigzagging",        // 放飞：蛇皮走位
			"deep boondoggling",      // 放飞：瞎忙活
			"deep gallivanting"       // 放飞：到处浪
		];
		var PHRASES_ZH = [
			"深潜中",        // deep diving：原版
			"深度求索中",    // deep seeking：DeepSeek 官方中文名，点题
			"刨根问底中",    // deep delving：delve into，深入探究
			"喷涂彩虹中",    // deep surfacing：潜完上浮换气（鲸喷水柱）
			"跃出海面中",    // deep breaching：鲸跃出水（whale logo 致敬）
			"海底冒泡中",    // deep bubbling：在深海冒泡泡
			"引吭高歌中",    // deep singing：鲸歌
			"摸鱼中",        // deep fishing：深度摸鱼
			"沉底中",        // deep sinking：沉下去慢慢想
			"呼呼大睡中",    // deep sleeping：睡着了（长思考自嘲）
			"偷偷打盹中",    // deep napping：打盹中（长思考自嘲）
			"白日做梦中",    // deep dreaming：做梦中
			"小火慢炖中",    // deep cooking：let me cook（慢慢酝酿）
			"烘焙中",        // deep baking
			"酿造中",        // deep brewing
			"熬糖色中",      // deep caramelizing
			"发酵中",        // deep fermenting
			"喷火炙烤中",    // deep flambéing
			"抹奶油中",      // deep frosting
			"摆盘中",        // deep garnishing
			"切丝中",        // deep julienning
			"揉面中",        // deep kneading
			"发面中",        // deep leavening
			"腌制入味中",    // deep marinating
			"醒面中",        // deep proofing：面团休息=思考
			"爆炒中",        // deep sautéing
			"调味中",        // deep seasoning
			"咕嘟咕嘟中",    // deep simmering
			"文火炖煮中",    // deep stewing
			"回火中",        // deep tempering
			"打发中",        // deep whisking
			"削皮中",        // deep zesting
			"洞窟探秘中",    // deep spelunking
			"挖洞中",        // deep burrowing
			"反刍中",        // deep ruminating：反刍式思考
			"孵化中",        // deep incubating
			"渗滤中",        // deep percolating：咖啡慢慢滴
			"哔哔鸣笛中",    // deep honking：鲸鱼鸣叫
			"瞎鼓捣中",      // deep noodling
			"涂鸦中",        // deep doodling
			"摇摇晃晃中",    // deep waddling
			"撒欢中",        // deep frolicking
			"溜达中",        // deep moseying
			"太空步中",      // deep moonwalking
			"光合作用中",    // deep photosynthesizing：发呆晒太阳
			"沉淀中",        // deep precipitating
			"拼拼凑凑中",    // deep combobulating
			"重组中",        // deep recombobulating
			"悬空冥想中",    // deep levitating
			"蜕变中",        // deep metamorphosing
			"蛇皮走位中",    // deep zigzagging
			"瞎忙活中",      // deep boondoggling
			"到处浪中"       // deep gallivanting
		];

		function labelFor(idx) {
			if (lang === "zh") return PHRASES_ZH[idx] + "…";
			var p = PHRASES_EN[idx];
			return p.charAt(0).toUpperCase() + p.slice(1) + "...";
		}

		// ---- 洗牌袋：一袋抽完才补充，保证短期不重复；
		//      袋与袋交界处换掉尾部，避免跨袋连续同一条 ----
		var bag = [];
		var lastIndex = -1;
		function nextPhrase() {
			if (bag.length === 0) {
				bag = PHRASES_EN.map(function (_, i) { return i; });
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
			return labelFor(lastIndex);
		}

		// ---- 改写状态 ----
		// tracked：已认领的思考状态行（WeakSet 随元素卸载自动回收）；
		// seenRows：已计入过事件的对话行（去重 React 移除重插入等场景）；
		// current：全局当前短语，所有活动状态行同步显示，轮换只推进这一个；
		// lastSwitchAt：上次切换（含开场认领）时间戳，构成保底节流窗口；
		// pending：窗口内到达、等待窗口边界补切的轮换事件。
		var tracked = new WeakSet();
		var seenRows = new WeakSet();
		var current = null;
		var lastSwitchAt = 0;
		var pending = false;
		var releaseScheduled = false;

		function statusList() {
			return document.querySelectorAll('div[role="status"]');
		}

		function liveStatuses() {
			var list = statusList();
			var live = [];
			for (var i = 0; i < list.length; i++) {
				if (tracked.has(list[i])) live.push(list[i]);
			}
			return live;
		}

		/** 同值不写：Text.data 赋值即使值不变也会入队 characterData mutation
		 *  record，进而再次触发本插件自己的 MutationObserver；当 current 恰为
		 *  "Deep diving..."（与内置文案逐字相同）时，同值覆写会形成
		 *  sweep→observe→sweep 微任务风暴，饿死事件循环（2026-08-17 冻结事故）。
		 *  返回本次是否真的写了 DOM。 */
		function setText(el, label) {
			var first = el.firstChild;
			if (!first || first.nodeType !== 3 || first.data === label) return false;
			first.data = label;
			return true;
		}

		/** 认领时挂点击监听 + 可点击提示（cursor/title 不在 React vdom 里，
		 *  重渲不会回写覆盖）。点击 = 用户主动操作：切换语言、保留当前短语、
		 *  重置保底节流窗口防止自动轮换立刻覆盖，并同步所有活动状态行。 */
		var toggleReady = new WeakSet();
		function toggleHint() {
			return lang === "zh" ? "点击切换为 English" : "点击切换为中文";
		}
		function onToggle() {
			lang = lang === "zh" ? "en" : "zh";
			try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* noop */ }
			if (current === null || lastIndex < 0) return;
			current = labelFor(lastIndex);
			lastSwitchAt = Date.now();
			pending = false;
			var live = liveStatuses();
			for (var j = 0; j < live.length; j++) {
				setText(live[j], current);
				live[j].title = toggleHint();
			}
		}
		function attachToggle(el) {
			if (toggleReady.has(el)) return;
			toggleReady.add(el);
			el.addEventListener("click", onToggle);
			el.style.cursor = "pointer";
			el.title = toggleHint();
		}

		/** 立即切换：取下一条短语同步到所有活动状态行。 */
		function switchNow() {
			pending = false;
			var live = liveStatuses();
			if (live.length === 0) return;
			current = nextPhrase();
			lastSwitchAt = Date.now();
			for (var j = 0; j < live.length; j++) setText(live[j], current);
		}

		/** 轮换事件入口：窗口外立即切换；窗口内记 pending，到点补切。 */
		function onActivity() {
			if (liveStatuses().length === 0) { pending = false; return; } // 回合未运行
			var elapsed = Date.now() - lastSwitchAt;
			if (elapsed >= MIN_SWITCH_MS) { switchNow(); return; }
			pending = true;
			scheduleRelease(MIN_SWITCH_MS - elapsed);
		}

		function scheduleRelease(delay) {
			if (releaseScheduled) return;
			releaseScheduled = true;
			setTimeout(function () {
				releaseScheduled = false;
				if (!pending) return;
				var wait = MIN_SWITCH_MS - (Date.now() - lastSwitchAt);
				if (wait > 0) { scheduleRelease(wait); return; } // 时钟异常的保险
				switchNow();
			}, delay);
		}

		/** 扫描：认领新挂载的思考状态行；兜底 React 回写。 */
		function sweep() {
			var list = statusList();
			var hadTracked = false;
			for (var i = 0; i < list.length; i++) {
				if (tracked.has(list[i])) { hadTracked = true; break; }
			}
			for (var j = 0; j < list.length; j++) {
				var el = list[j];
				var first = el.firstChild;
				if (!first || first.nodeType !== 3) continue;
				if (tracked.has(el)) {
					// 兜底：React 若回写了内置文案，恢复当前短语。
					// current !== BUILTIN 是第二道闸：setText 已同值不写，
					// 这里显式排除，防未来重构绕过守卫复活风暴。
					if (first.data === BUILTIN && current !== null && current !== BUILTIN) setText(el, current);
					continue;
				}
				if (first.data !== BUILTIN) continue; // 不是思考状态行，不碰
				tracked.add(el);
				attachToggle(el);
				// 此前已无活动状态行 = 新回合开场：从袋里取新的一条；
				// 取完立刻置位，同一批挂载的多行（多会话并排）复用同一条。
				// 开场词即本回合首次展示：重置节流窗口，并丢弃上一回合
				// 遗留的 pending（新回合有自己的开场词，不需要补切）。
				if (!hadTracked) {
					current = nextPhrase();
					hadTracked = true;
					lastSwitchAt = Date.now();
					pending = false;
				}
				// 抽中原版短语（current === BUILTIN）时同值守卫会跳过写入，
				// 展示效果与写入完全一致，且不产生 mutation record。
				setText(el, current);
			}
		}

		/** 单个新增节点里找触发行：自身是 flow 行，或是包含 flow 行的容器。
		 *  ChatNodeSeat 的行不会互相嵌套，命中自身时不必再查后代。 */
		function countRow(row) {
			if (seenRows.has(row)) return false;
			var kind = row.getAttribute && row.getAttribute(FLOW_KIND_ATTR);
			if (TRIGGER_KINDS[kind] !== 1) return false;
			seenRows.add(row);
			return true;
		}

		function activityFromNode(node) {
			if (!node || node.nodeType !== 1) return false;
			var hit = false;
			if (node.hasAttribute && node.hasAttribute(FLOW_KIND_ATTR)) {
				if (countRow(node)) hit = true;
			} else if (node.querySelectorAll) {
				var inner = node.querySelectorAll(FLOW_SEL);
				for (var i = 0; i < inner.length; i++) {
					if (countRow(inner[i])) hit = true;
				}
			}
			return hit;
		}

		function collectActivity(mutations) {
			var hit = false;
			for (var i = 0; i < mutations.length; i++) {
				var added = mutations[i].addedNodes;
				if (!added) continue;
				for (var j = 0; j < added.length; j++) {
					if (activityFromNode(added[j])) hit = true;
				}
			}
			return hit;
		}

		// observer 回调可能成串到达：合并到微任务里一次处理；
		// 先 sweep（认领/兜底），再消费本批攒下的轮换事件
		var scheduled = false;
		var activityFlag = false;
		function onMutate(mutations) {
			if (collectActivity(mutations)) activityFlag = true;
			if (scheduled) return;
			scheduled = true;
			Promise.resolve().then(function () {
				scheduled = false;
				sweep();
				var act = activityFlag;
				activityFlag = false;
				if (act) onActivity();
			});
		}

		/** 3 秒维护扫描：认领兜底 + React 回写修复 + pending 的保险释放
		 *  （后台标签页定时器被节流时兜住窗口边界的补切）。不推进短语。 */
		function maintain() {
			sweep();
			if (pending && Date.now() - lastSwitchAt >= MIN_SWITCH_MS) switchNow();
		}

		function start() {
			sweep();
			setInterval(maintain, MAINTAIN_MS);
			// 只订阅 childList：认领只关心"新挂载的状态行"、轮换只关心
			// "新挂载的对话行"这类结构变化；characterData 会让流式输出的
			// 每次文本变更（含秒表每秒更新、每个流式 token）都触发一次
			// 全文档 querySelectorAll 扫描。
			new MutationObserver(onMutate).observe(document.body, {
				childList: true,
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
