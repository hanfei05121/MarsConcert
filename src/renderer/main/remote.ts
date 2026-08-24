// 手机遥控 - 控制窗桥接：
//  - 把控制窗 Vue store 里的播放状态（队列/当前歌/播放/音量/进度）定时推送给主进程，
//    主进程再广播给所有接入的手机 H5 页面。
//  - 接收主进程转来的「手机遥控指令」，转交 store 执行（点歌/暂停/切歌/音量/队列/弹幕）。
// 这样手机端无需改动任何桌面端业务逻辑，走的是同一套 store 动作。

import { store } from './store'
import type { RemoteCommand, RemoteState, RemoteSong } from '../../shared/types'

function toRemoteSong(s: { id: number; name: string; artist: string; duration?: number }): RemoteSong {
  return { id: s.id, name: s.name, artist: s.artist, duration: s.duration }
}

function snapshot(): RemoteState {
  const st = store.state
  return {
    queue: st.queue.map(toRemoteSong),
    history: st.history.map(toRemoteSong),
    currentSong: st.currentSong ? toRemoteSong(st.currentSong) : null,
    playing: st.playing,
    mode: st.mode,
    volumes: { ...st.volumes },
    currentTime: st.currentTime,
    duration: st.duration
  }
}

let timer: ReturnType<typeof setInterval> | null = null
let subscribed = false

function push() {
  window.api.remotePushState(snapshot())
}

function dispatch(cmd: RemoteCommand) {
  const st = store.state
  switch (cmd.cmd) {
    case 'togglePlay':
      store.togglePlay()
      break
    case 'prev':
      store.playPrev()
      break
    case 'next':
      store.playNext()
      break
    case 'reSing':
      store.reSing()
      break
    case 'toggleMode':
      store.toggleMode()
      break
    case 'setVolume':
      st.volumes = { ...st.volumes, ...cmd.vols }
      store.applyVolumes()
      break
    case 'playSong':
      store.addToQueue({ ...cmd.song })
      break
    case 'removeAt':
      store.removeQueueAt(cmd.index)
      break
    case 'topAt':
      store.topQueue(cmd.index)
      break
    case 'pinAt':
      store.pinToNext(cmd.index)
      break
  }
  // 指令执行后立刻回推一次，让手机界面马上反映结果（不用等下一个周期）
  window.setTimeout(push, 120)
}

export function initRemoteBridge() {
  if (subscribed) return
  subscribed = true
  window.api.onRemoteCommand((cmd) => dispatch(cmd))
  push()
  timer = setInterval(push, 800)
}