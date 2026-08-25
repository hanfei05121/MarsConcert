import { store } from './store'
import type { Song } from '../../shared/types'

/**
 * 点歌/播放的共享动作：
 * 「点歌飞入已点」动画 + 加入队列 + 立即播放，供各视图组件复用。
 */

const QUEUE_FAB_ID = 'queue-fab'

/** 从点击的歌曲行/＋按钮飞一个亮点到已点按钮 */
function flyToQueue(song: Song, ev: MouseEvent) {
  store.addToQueue(song)
  const src = ev.currentTarget as HTMLElement | null
  const btn = document.getElementById(QUEUE_FAB_ID)
  if (!src || !btn) return
  const s = src.getBoundingClientRect()
  const t = btn.getBoundingClientRect()
  const x0 = s.left + s.width / 2
  const y0 = s.top + s.height / 2
  const x1 = t.left + t.width / 2
  const y1 = t.top + t.height / 2
  const dot = document.createElement('div')
  dot.className = 'fly-dot'
  dot.style.left = `${x0}px`
  dot.style.top = `${y0}px`
  document.body.appendChild(dot)
  const anim = dot.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(${x1 - x0}px - 50%), calc(${y1 - y0}px - 50%)) scale(0.35)`, opacity: 0.85 }
    ],
    { duration: 620, easing: 'cubic-bezier(.45,.05,.3,1)' }
  )
  anim.onfinish = () => {
    dot.remove()
    // 亮点落位后让已点按钮弹一下，呼应数字 +1
    btn.classList.remove('bump')
    void btn.offsetWidth // 强制重绘以重启动画
    btn.classList.add('bump')
    window.setTimeout(() => btn.classList.remove('bump'), 420)
  }
}

/** 单曲加号：加入已点队列 + 飞入动画 */
export function onAdd(song: Song, ev: MouseEvent) {
  flyToQueue(song, ev)
}

/** 点击播放：加入已点队列并置顶立即播放 + 飞入动画 */
export function onPlay(song: Song, ev: MouseEvent) {
  flyToQueue(song, ev)
  const i = store.state.queue.findIndex((s) => s.id === song.id)
  if (i >= 0) store.topQueue(i)
}