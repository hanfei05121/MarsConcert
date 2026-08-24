// 手机端遥控客户端：直接与主进程 HTTP 服务交互（不走 Electron IPC）。
//  - EventSource(SSE)：持续接收主进程广播的播放状态 / 弹幕
//  - POST /api/command：点歌 / 控制 / 音量 / 队列 / 发弹幕

import { reactive } from 'vue'
import type { RemoteState, RemoteSong, VideoMode, Volumes } from '../../shared/types'

interface DanmakuEcho {
  id: number
  text: string
}

export const mobile = reactive({
  connected: false,
  /** 最新的完整状态快照（推送目标） */
  state: null as RemoteState | null,
  queue: [] as RemoteSong[],
  history: [] as RemoteSong[],
  currentSong: null as RemoteSong | null,
  playing: false,
  mode: 'orig' as VideoMode,
  volumes: { orig: 1, accomp: 1, master: 1, mic: 1 } as Volumes,
  currentTime: 0,
  duration: 0,
  /** 本机收到/发出的弹幕回显（用于底部角标提示） */
  danmakus: [] as DanmakuEcho[]
})

let connectedRef = false

export function connect() {
  if (connectedRef) return
  connectedRef = true
  const es = new EventSource(`${location.origin}/remote`)
  es.onopen = () => {
    mobile.connected = true
  }
  es.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data)
      handle(d)
    } catch {
      /* 忽略 */
    }
  }
  es.onerror = () => {
    mobile.connected = false
  }
}

function handle(d: Record<string, any>) {
  if (d.type === 'state' && d.state) {
    const s: RemoteState = d.state
    mobile.state = s
    mobile.queue = s.queue
    mobile.history = s.history
    mobile.currentSong = s.currentSong
    mobile.playing = s.playing
    mobile.mode = s.mode
    mobile.volumes = s.volumes ?? mobile.volumes
    mobile.currentTime = s.currentTime ?? 0
    mobile.duration = s.duration ?? 0
  } else if (d.type === 'danmaku') {
    mobile.danmakus.push({ id: d.id, text: d.text })
    // 等滚动动画播完再移除（最长 ~11s）
    window.setTimeout(() => {
      const i = mobile.danmakus.findIndex((x) => x.id === d.id)
      if (i >= 0) mobile.danmakus.splice(i, 1)
    }, 12000)
  }
}

async function command(body: Record<string, unknown>): Promise<any> {
  try {
    const res = await fetch(`${location.origin}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'network' }
  }
}

export const api = {
  search: (q: string) => command({ op: 'search', q }),
  play: (id: number) => command({ op: 'play', id }),
  control: (name: string) => command({ op: 'control', name }),
  volume: (vols: Partial<Volumes>) => command({ op: 'volume', vols }),
  danmaku: (text: string) => command({ op: 'danmaku', text }),
  queueAction: (action: 'remove' | 'top' | 'pin', index: number) => command({ op: 'queue', action, index })
}