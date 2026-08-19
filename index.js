// dsh-more-emotions: DeepSeek Harness 插件（宿主半边）。
//
// 纯占位：保证该 loader entry 是"活的"（client-modules 只把活的 entry 编进
// window.__DSH_BOOT__），且 host（Node）进程能安全导入本包。
// 思考状态行文案轮换的全部逻辑都在前端 client.js。
export const name = 'dsh-more-emotions'

export function apply() {
  /* 纯前端实现，宿主无逻辑。 */
}
