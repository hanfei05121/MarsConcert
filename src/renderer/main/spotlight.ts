import type { Directive } from 'vue'

/**
 * v-spotlight —— 让「跟随鼠标的圆形渐变光斑」落在列表行上。
 *
 * 指令做两件事：
 *   1. 打上 data-spotlight 标记 —— 光斑只认这个标记（.row[data-spotlight]::before），
 *      因为 .row 这个类名在别处也被复用（弹窗里的滑块行），不能一竿子全打上光斑；
 *   2. 把光标位置写成行内坐标的两个 CSS 变量（--gx / --gy，单位 px）。
 * 光斑长什么样、用什么颜色，全部交给 style.css，
 * 这样「换色」永远只有一处（与左侧导航选中态同色，见 --spot-* 变量）。
 *
 * 用法：<div class="row" v-spotlight>…</div>
 */
type SpotEl = HTMLElement & {
  _spotMove?: (e: PointerEvent) => void
  _spotRaf?: number
}

export const spotlight: Directive<HTMLElement> = {
  mounted(el) {
    const host = el as SpotEl
    el.dataset.spotlight = ''
    let x = 0
    let y = 0
    let queued = false

    // 一帧最多写一次样式：pointermove 触发频率远高于刷新率，合并掉多余的计算
    const flush = () => {
      queued = false
      el.style.setProperty('--gx', x.toFixed(1) + 'px')
      el.style.setProperty('--gy', y.toFixed(1) + 'px')
    }

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      x = e.clientX - r.left
      y = e.clientY - r.top
      if (queued) return
      queued = true
      host._spotRaf = requestAnimationFrame(flush)
    }

    host._spotMove = onMove
    el.addEventListener('pointermove', onMove, { passive: true })
  },

  unmounted(el) {
    const host = el as SpotEl
    delete el.dataset.spotlight
    if (host._spotMove) el.removeEventListener('pointermove', host._spotMove)
    if (host._spotRaf) cancelAnimationFrame(host._spotRaf)
    host._spotMove = undefined
    host._spotRaf = undefined
  }
}
