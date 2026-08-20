// 共享类型与 IPC 通道定义（主进程 / 预加载 / 渲染进程通用）

export type VideoMode = 'orig' | 'accomp'

export interface Song {
  id: number
  name: string
  artist: string
  orig_path: string
  accomp_path: string
  lrc_path: string
  duration: number
  create_time: string
}

export interface Volumes {
  orig: number // 0~1
  accomp: number // 0~1
  master: number // 0~1
}

export interface AppConfig {
  songLibPath: string
  videoMode: VideoMode
  volumes: Volumes
  /** 上次播放窗口所在的屏幕 id，-1 表示自动选择扩展屏 */
  playerScreenId: number
}

export interface Playload {
  song: Song
  /** 已读取的 LRC 原始文本（可能为空） */
  lrc: string
  mode: VideoMode
  volumes: Volumes
}

export type TransportAction = 'play' | 'pause' | 'seek'

// 控制窗 -> 主进程 的 invoke 通道
export const IPC = {
  // 控制窗调用
  SONGS_LIST: 'songs:list',
  LIBRARY_RESCAN: 'library:rescan',
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',
  PLAYER_PLAY: 'player:play',
  PLAYER_SET_MODE: 'player:setMode',
  PLAYER_CONTROL: 'player:control',
  PLAYER_SET_VOLUMES: 'player:setVolumes',
  WINDOW_CONTROL: 'window:control',

  // 主进程 -> 控制窗 的推送（同步播放状态）
  SYNC_TIME: 'sync:time',
  SYNC_STATE: 'sync:state',
  SYNC_ENDED: 'sync:ended',

  // 主进程 -> 播放窗 的指令
  TO_PLAYER_LOAD: 'player:load',
  TO_PLAYER_SET_MODE: 'player:setMode',
  TO_PLAYER_CONTROL: 'player:control',
  TO_PLAYER_VOLUMES: 'player:setVolumes',

  // 播放窗 -> 主进程 的事件
  FROM_PLAYER_TIME: 'player:time',
  FROM_PLAYER_STATE: 'player:state',
  FROM_PLAYER_ENDED: 'player:ended'
} as const

export interface RescanResult {
  added: number
  updated: number
  total: number
}

/** 暴露给渲染进程的桥接 API（由 preload 实现，主进程 / 播放窗 / 控制窗共用） */
export interface KaraokeApi {
  // —— 控制窗 -> 主进程 ——
  getSongs(search?: string): Promise<Song[]>
  rescan(): Promise<RescanResult>
  getConfig(): Promise<AppConfig>
  saveConfig(cfg: AppConfig): Promise<AppConfig>
  playSong(song: Song): Promise<void>
  setMode(mode: VideoMode): Promise<void>
  control(action: TransportAction, payload?: number): Promise<void>
  setVolumes(vols: Volumes): Promise<void>
  windowControl(action: 'min' | 'max' | 'close'): Promise<void>

  // —— 播放窗接收指令 ——
  onLoad(cb: (p: Playload) => void): () => void
  onSetMode(cb: (mode: VideoMode) => void): () => void
  onControl(cb: (p: { action: TransportAction; payload?: number }) => void): () => void
  onVolumes(cb: (v: Volumes) => void): () => void

  // —— 播放窗 -> 主进程 上报 ——
  emitTime(data: { currentTime: number; duration: number }): void
  emitState(data: { playing: boolean }): void
  emitEnded(): void

  // —— 控制窗接收同步事件 ——
  onSyncTime(cb: (d: { currentTime: number; duration: number }) => void): () => void
  onSyncState(cb: (d: { playing: boolean }) => void): () => void
  onSyncEnded(cb: () => void): () => void
}
