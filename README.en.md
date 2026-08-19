# dsh-deep-verbs

> [简体中文](README.md)（默认） | **English**

> Tired of the built-in status line showing `Deep diving...` forever?
> Want the model to show some personality while it thinks?
> Then this plugin is for you.

A **pure plugin** for DeepSeek Harness (DSH) that only handles swapping the **status line copy**:
1. **Random phrase per turn**: a bilingual (EN/ZH) pool of 73 "deep" phrases, drawn from a shuffled bag (no repeats within a bag, no same phrase across bag boundaries);
2. **Event-driven rotation**: each new reasoning segment or tool call switches to the next phrase, at least 3 seconds apart (events inside the window merge into one catch-up switch at the window edge — rapid tool calls change the word only once);
3. **Click to toggle language**: click the status line to re-display the current phrase in the other language (no re-draw), synced across all parallel sessions; the choice is stored in `localStorage` and restored on reload;
4. **The timer is untouched**: the built-in "N分N秒" clock still appears after 15 seconds.

**Does not modify any `@deepseek-ai/dsh-*` source code.**

> **Design reference**: the phrase-rotation play is inspired by **Claude Code**'s spinner verbs —
> it samples a random gerund (*Wandering… / Combobulating… / Noodling…*) each time the spinner
> mounts, much like "one random phrase per turn"; 60 of this plugin's phrases are directly
> borrowed from that same word list.

## Feature 1: random per turn + event-driven rotation

```
[user message]
Deep diving...            ← built-in: forever
        ↓ claimed by the plugin
Deep Seeking...           ← random phrase at turn start
Deep cooking...           ← switches on each new segment / tool call
深潜中…（1分23秒）         ← language toggles on click; timer still shows after 15s
```

- **Shuffled-bag draw**: a bag of 73 indices is reshuffled only when exhausted — no short-term repeats, no same phrase across bag boundaries;
- **Random at turn start**: the first status row of a turn draws a phrase; rows mounted in the same batch (parallel sessions) share it;
- **Event-driven**: a newly mounted `assistant-step` (reasoning/answer segment) or `tool-call` (tool call, incl. retries) row advances the phrase; streamed tokens never mount rows, so no false triggers; re-inserted rows are deduped;
- **Throttle floor**: at least 3 seconds between switches (`MIN_SWITCH_MS`); events inside the window merge into one catch-up switch at the boundary;
- **No rotation during long thinking**: without new rows the phrase stays put until the next event.

## Feature 2: click to toggle EN/ZH

```
Deep Seeking...            ← click the status line (pointer cursor + tooltip)
        ↓
深度求索中…               ← same phrase, other language; no re-draw
```

- **Same phrase, other language**: `Deep Seeking...` ↔ `深度求索中…` — the two pools are index-aligned, so the phrase never jumps;
- **Synced everywhere**: all active status rows (parallel sessions) toggle together;
- **Persisted**: the choice is stored in `localStorage` (`dsh-deep-verbs:lang`) and restored on reload;
- **User action wins**: a click resets the 3-second floor, so an imminent auto-rotation can't instantly override the language you just picked.

## Phrase pools

### Original 13

| EN | ZH | meaning |
| --- | --- | --- |
| `Deep diving...` | `深潜中…` | the original: diving |
| `Deep seeking...` | `深度求索中…` | DeepSeek's official Chinese name |
| `Deep delving...` | `刨根问底中…` | delve into |
| `Deep surfacing...` | `喷涂彩虹中…` | coming up for air (whale spout) |
| `Deep breaching...` | `跃出海面中…` | breaching (whale logo nod) |
| `Deep bubbling...` | `海底冒泡中…` | bubbling on the seafloor |
| `Deep singing...` | `引吭高歌中…` | whale song |
| `Deep fishing...` | `摸鱼中…` | slacking off |
| `Deep sinking...` | `沉底中…` | sinking to think slowly |
| `Deep sleeping...` | `呼呼大睡中…` | sound asleep (long-thinking joke) |
| `Deep napping...` | `偷偷打盹中…` | sneaking a nap (long-thinking joke) |
| `Deep dreaming...` | `白日做梦中…` | daydreaming |
| `Deep cooking...` | `小火慢炖中…` | let me cook |

### 60 more, borrowed from Claude Code's spinner verbs

> The following 60 phrases are taken from Claude Code's spinner word list (40 introduced in v0.5.0, 20 added in v0.6.0)
> (`github.com/ConardLi/easy-agent`), grouped as culinary / exploration / brains / whale /
> whimsy / slacking / science / existential / free-spirited.

| mood | EN | ZH |
| --- | --- | --- |
| Culinary | `Deep baking...` | `烘焙中…` |
| Culinary | `Deep brewing...` | `酿造中…` |
| Culinary | `Deep caramelizing...` | `熬糖色中…` |
| Culinary | `Deep fermenting...` | `发酵中…` |
| Culinary | `Deep flambéing...` | `喷火炙烤中…` |
| Culinary | `Deep frosting...` | `抹奶油中…` |
| Culinary | `Deep garnishing...` | `摆盘中…` |
| Culinary | `Deep julienning...` | `切丝中…` |
| Culinary | `Deep kneading...` | `揉面中…` |
| Culinary | `Deep leavening...` | `发面中…` |
| Culinary | `Deep marinating...` | `腌制入味中…` |
| Culinary | `Deep proofing...` | `醒面中…`（dough resting = thinking） |
| Culinary | `Deep sautéing...` | `爆炒中…` |
| Culinary | `Deep seasoning...` | `调味中…` |
| Culinary | `Deep simmering...` | `咕嘟咕嘟中…` |
| Culinary | `Deep stewing...` | `文火炖煮中…` |
| Culinary | `Deep tempering...` | `回火中…` |
| Culinary | `Deep whisking...` | `打发中…` |
| Culinary | `Deep zesting...` | `削皮中…` |
| Exploration | `Deep spelunking...` | `洞窟探秘中…`（cave cousin of deep diving） |
| Exploration | `Deep burrowing...` | `挖洞中…` |
| Brains | `Deep ruminating...` | `反刍中…`（cud-chewing thoughts） |
| Brains | `Deep incubating...` | `孵化中…` |
| Brains | `Deep percolating...` | `渗滤中…`（coffee dripping） |
| Whale | `Deep honking...` | `哔哔鸣笛中…`（whale honk） |
| Whimsy | `Deep noodling...` | `瞎鼓捣中…` |
| Whimsy | `Deep doodling...` | `涂鸦中…` |
| Whimsy | `Deep waddling...` | `摇摇晃晃中…` |
| Whimsy | `Deep frolicking...` | `撒欢中…` |
| Whimsy | `Deep moseying...` | `溜达中…` |
| Whimsy | `Deep moonwalking...` | `太空步中…` |
| Slacking | `Deep photosynthesizing...` | `光合作用中…`（sunbathing and zoning out） |
| Science | `Deep precipitating...` | `沉淀中…` |
| Existential | `Deep combobulating...` | `拼拼凑凑中…` |
| Existential | `Deep recombobulating...` | `重组中…` |
| Free-spirited | `Deep levitating...` | `悬空冥想中…` |
| Free-spirited | `Deep metamorphosing...` | `蜕变中…` |
| Free-spirited | `Deep zigzagging...` | `蛇皮走位中…` |
| Free-spirited | `Deep boondoggling...` | `瞎忙活中…` |
| Free-spirited | `Deep gallivanting...` | `到处浪中…` |
| Craft | `Deep crafting...` | `打磨中…` |
| Craft | `Deep forging...` | `锻造中…` |
| Brains | `Deep deliberating...` | `斟酌中…` |
| Brains | `Deep inferring...` | `推演中…` |
| Brains | `Deep puzzling...` | `解谜中…` |
| Brains | `Deep reticulating...` | `编织中…` |
| Wandering | `Deep wandering...` | `游弋中…` |
| Wandering | `Deep meandering...` | `漫步中…` |
| Wandering | `Deep orbiting...` | `绕飞中…` |
| Fluid | `Deep cascading...` | `飞瀑中…` |
| Fluid | `Deep churning...` | `翻腾中…` |
| Fluid | `Deep billowing...` | `鼓涌中…` |
| Fluid | `Deep swirling...` | `回旋中…` |
| Fluid | `Deep undulating...` | `起伏中…` |
| Flight | `Deep fluttering...` | `扑棱中…` |
| Flight | `Deep swooping...` | `俯冲中…` |
| Groove | `Deep shimmying...` | `扭摆中…` |
| Groove | `Deep grooving...` | `踩点中…` |
| Slacking | `Deep lollygagging...` | `磨洋工中…` |
| Growth | `Deep sprouting...` | `冒芽中…` |

## Installation

```powershell
pwsh install.ps1            # or: powershell -ExecutionPolicy Bypass -File install.ps1
```

The script prefers `~/.dsh/profiles/desktop` (desktop build), falling back to `profiles/web`; junction-links this directory into `profiles/node_modules/dsh-deep-verbs`; registers the insert in the profile's `cordis.patch.yml`.

Then **fully quit the DSH process** and restart (closing the window is not enough); the desktop window restarts on its own, browser users just refresh.

Manual install is equivalent to:

1. `mklink /J %USERPROFILE%\.dsh\profiles\node_modules\dsh-deep-verbs <this directory>`
2. Append to `<profile>\cordis.patch.yml`:
   ```yaml
   - insert:
       - id: dsh-deep-verbs
         name: 'dsh-deep-verbs'
   ```
3. Restart DSH.

## How it works (why no source changes)

- The built-in TurnStatus renders `<div role="status">Deep diving...<span>clock</span></div>`; React re-renders every second but **never writes back the DOM text node** while the string child is unchanged — so rewriting that text node in the browser side sticks.
- Rotation is **event-driven**: every chat row (`ChatNodeSeat`) carries a host-internal `data-chat-flow-kind` attribute (DSH's own scroll anchoring relies on it — a stable detail); a newly mounted `assistant-step` / `tool-call` / `model-retry` row counts as one rotation event.
- The `MutationObserver` subscribes to **childList only** (streamed text changes never trigger scans) and both claims new turn status rows and captures rotation events; a 3-second maintenance scan only covers claim fallback, repairing the rare React write-back of the built-in text, and catching up pending switches when background-tab timers are throttled (it never advances the phrase).
- The click listener is attached when a status row is claimed; `cursor` / `title` hints live outside React's vdom, so re-renders don't clobber them (same mechanism as the text node).
- Every DOM write goes through a "same-value, no write" guard: assigning `Text.data` enqueues a mutation record even when the value is unchanged, so writing the built-in phrase back verbatim would spin a sweep→observe→sweep microtask storm (the 2026-08-17 freeze incident; fixed in v0.2.1 with a regression test).

## Notes

- If a future DSH release changes the built-in text `Deep diving...`, the plugin degrades to a no-op; if it drops the `data-chat-flow-kind` attribute, it degrades to "new phrase per turn, no in-turn rotation" — neither touches any other UI.
- Phrase pools, the switch interval, and the language key all live in the constants at the top of `client.js`.

## Customization

Edit the `PHRASES_EN` / `PHRASES_ZH` arrays in `client.js`: English phrases stay lowercase `deep xxxing` (auto-capitalized with `...` on display); Chinese phrases keep the `…中` suffix (auto-appended `…`); the two arrays are **index-aligned** — same index = same phrase, and the language toggle maps by index. The minimum switch interval is `MIN_SWITCH_MS` (3000ms default — a floor, not a beat: slower events mean slower rotation). Restart DSH after saving.

## Dev self-test

```bash
node verify.mjs
```

Drives the bundle's rewrite / rotation / throttle / storm-regression / language-toggle paths with a tiny DOM shim and a fake clock — no browser needed.

## Uninstall

Delete the `profiles/node_modules/dsh-deep-verbs` link and remove the matching `- insert` block from `cordis.patch.yml`, then restart DSH.
