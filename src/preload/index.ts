import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type { KaraokeApi } from '../shared/types'

function subscribe<T extends (...args: any[]) => void>(
  channel: string,
  cb: (...args: any[]) => void
): () => void {
  const listener = (_e: Electron.IpcRendererEvent, ...args: any[]) => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: KaraokeApi = {
  // 控制窗 -> 主进程
  getSongs: (search?: string) => ipcRenderer.invoke(IPC.SONGS_LIST, search),
  rescan: () => ipcRenderer.invoke(IPC.LIBRARY_RESCAN),
  getConfig: () => ipcRenderer.invoke(IPC.CONFIG_GET),
  saveConfig: (cfg) => ipcRenderer.invoke(IPC.CONFIG_SAVE, cfg),
  playSong: (song) => ipcRenderer.invoke(IPC.PLAYER_PLAY, song),
  setMode: (mode) => ipcRenderer.invoke(IPC.PLAYER_SET_MODE, mode),
  control: (action, payload) => ipcRenderer.invoke(IPC.PLAYER_CONTROL, action, payload),
  setVolumes: (vols) => ipcRenderer.invoke(IPC.PLAYER_SET_VOLUMES, vols),
  stopPlayback: () => ipcRenderer.invoke(IPC.PLAYER_STOP),
  windowControl: (action) => ipcRenderer.invoke(IPC.WINDOW_CONTROL, action),
  openLibFolder: () => ipcRenderer.invoke(IPC.LIBRARY_OPEN),
  chooseLibFolder: () => ipcRenderer.invoke(IPC.LIBRARY_CHOOSE),
  escape: () => ipcRenderer.invoke(IPC.PLAYER_ESCAPE),
  setLyricOffset: (songId, offset) => ipcRenderer.invoke(IPC.LYRIC_OFFSET_SET, songId, offset),

  // 播放窗接收指令
  onLoad: (cb) => subscribe(IPC.TO_PLAYER_LOAD, cb),
  onSetMode: (cb) => subscribe(IPC.TO_PLAYER_SET_MODE, cb),
  onControl: (cb) => subscribe(IPC.TO_PLAYER_CONTROL, cb),
  onVolumes: (cb) => subscribe(IPC.TO_PLAYER_VOLUMES, cb),
  onStop: (cb) => subscribe(IPC.TO_PLAYER_STOP, cb),

  // 播放窗 -> 主进程 上报
  emitTime: (data) => ipcRenderer.send(IPC.FROM_PLAYER_TIME, data),
  emitState: (data) => ipcRenderer.send(IPC.FROM_PLAYER_STATE, data),
  emitEnded: () => ipcRenderer.send(IPC.FROM_PLAYER_ENDED),

  // 控制窗接收同步事件
  onSyncTime: (cb) => subscribe(IPC.SYNC_TIME, cb),
  onSyncState: (cb) => subscribe(IPC.SYNC_STATE, cb),
  onSyncEnded: (cb) => subscribe(IPC.SYNC_ENDED, cb)
}

contextBridge.exposeInMainWorld('api', api)
