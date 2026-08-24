// 共享类型与 IPC 通道定义（主进程 / 预加载 / 渲染进程通用）

export type VideoMode = 'orig' | 'accomp'

export interface Song {
  id: number
  name: string
  artist: string
  /** 视频画面文件（<基名>.mp4，无音轨），所有模式共用，避免切换时重新解码 */
  video_path: string
  /** 原唱音频文件（<基名>_vocals.<ext>） */
  orig_path: string
  /** 伴奏音频文件（<基名>_instrumental.<ext>） */
  accomp_path: string
  lrc_path: string
  duration: number
  /** 歌词相对视频的偏移（秒），正=歌词延后，用于校正官方 MV 长前奏等错位 */
  lyricOffset: number
  /** 歌手头像的 media:// 地址（artist.jpg，搜索/歌星视图用），为空表示无头像 */
  artistAvatar: string
  /** 歌曲展示图（底部栏/列表头像）：优先歌曲目录内的 logo.jpg，缺省回退到 artistAvatar */
  logo: string
  create_time: string
}

export interface Volumes {
  orig: number // 0~1
  accomp: number // 0~1
  master: number // 0~1
  mic: number // 0~1 麦克风增益
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
  /** 视频画面地址（<基名>.mp4，无音轨；主进程签发的 media:// token） */
  videoUrl: string
  /** 音频地址：orig=原唱（_vocals），accomp=伴奏（_instrumental），主进程签发的 media:// token */
  audioUrls: { orig: string; accomp: string }
}

/** 切原唱/伴奏时下发给播放窗的指令：模式 + 最新音频地址（点歌后素材变化也能即时生效） */
export interface ModePayload {
  mode: VideoMode
  audioUrls: { orig: string; accomp: string }
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
  /** 控制窗 → 主进程：停止播放，让副屏回到待点歌页（点下一首但已点为空时用） */
  PLAYER_STOP: 'player:stop',
  WINDOW_CONTROL: 'window:control',
  /** 播放窗（副屏）自身的最小化/最大化/关闭控制 */
  PLAYER_WINDOW_CONTROL: 'player-window:control',
  LIBRARY_OPEN: 'library:open',
  /** 控制窗 → 主进程：弹出目录选择器更换曲库路径，保存配置并立即重扫 */
  LIBRARY_CHOOSE: 'library:choose',
  // 播放窗 -> 主进程：Esc 最小化播放屏，把控制权还给控制台
  PLAYER_ESCAPE: 'player:escape',
  // 播放窗 -> 主进程：保存当前歌曲的歌词偏移（按歌曲持久化，免得每次重调）
  LYRIC_OFFSET_SET: 'lyric:setOffset',

  // 主进程 -> 控制窗 的推送（同步播放状态）
  SYNC_TIME: 'sync:time',
  SYNC_STATE: 'sync:state',
  SYNC_ENDED: 'sync:ended',

  // 主进程 -> 播放窗 的指令
  TO_PLAYER_LOAD: 'player:load',
  TO_PLAYER_SET_MODE: 'player:setMode',
  TO_PLAYER_CONTROL: 'player:control',
  TO_PLAYER_VOLUMES: 'player:setVolumes',
  /** 主进程 -> 播放窗：停止播放并回到待点歌页 */
  TO_PLAYER_STOP: 'player:stop',

  // 播放窗 -> 主进程 的事件
  FROM_PLAYER_TIME: 'player:time',
  FROM_PLAYER_STATE: 'player:state',
  FROM_PLAYER_ENDED: 'player:ended',

  // —— 手机遥控（手机 H5 <-> 主进程 HTTP 服务；主进程 <-> 控制窗/播放窗 转接）——
  /** 控制窗 -> 主进程：推送遥控状态快照 */
  REMOTE_PUSH_STATE: 'remote:pushState',
  /** 主进程 -> 控制窗：手机下达的遥控指令 */
  REMOTE_COMMAND: 'remote:command',
  /** 任意窗 -> 主进程：取手机遥控的服务地址 + 二维码（控制窗顶部/播放窗待机页展示用） */
  REMOTE_GET_INFO: 'remote:getInfo',
  /** 主进程 -> 播放窗：展示弹幕（副屏叠加） */
  DANMAKU: 'danmaku'
} as const

export interface RescanResult {
  added: number
  updated: number
  total: number
}

/** 选择曲库目录的结果：path 为 null 表示用户取消 */
export interface ChooseLibResult {
  path: string | null
  result: RescanResult | null
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
  /** 停止播放并让副屏回到待点歌页（点下一首但已点为空时） */
  stopPlayback(): Promise<void>
  windowControl(action: 'min' | 'max' | 'close'): Promise<void>
  /** 播放窗（副屏）：最小化 / 最大化 / 关闭 */
  playerWindowControl(action: 'min' | 'max' | 'close'): Promise<void>
  openLibFolder(): Promise<string>
  /** 弹出目录选择器更换曲库路径，保存配置并立即重扫；取消时 path 为 null */
  chooseLibFolder(): Promise<ChooseLibResult>
  /** 播放窗：Esc 退出/最小化，把控制权还给控制台 */
  escape(): Promise<void>
  /** 播放窗：保存当前歌曲的歌词偏移（秒） */
  setLyricOffset(songId: number, offset: number): Promise<void>

  // —— 播放窗接收指令 ——
  onLoad(cb: (p: Playload) => void): () => void
  onSetMode(cb: (p: ModePayload) => void): () => void
  onControl(cb: (p: { action: TransportAction; payload?: number }) => void): () => void
  onVolumes(cb: (v: Volumes) => void): () => void
  /** 播放窗：停止播放并回到待点歌页 */
  onStop(cb: () => void): () => void

  // —— 播放窗 -> 主进程 上报 ——
  emitTime(data: { currentTime: number; duration: number }): void
  emitState(data: { playing: boolean }): void
  emitEnded(): void

  // —— 控制窗接收同步事件 ——
  onSyncTime(cb: (d: { currentTime: number; duration: number }) => void): () => void
  onSyncState(cb: (d: { playing: boolean }) => void): () => void
  onSyncEnded(cb: () => void): () => void

  // —— 手机遥控 ——
  /** 控制窗 -> 主进程：推送遥控状态快照（手机通过 HTTP/SSE 实时获取） */
  remotePushState(state: RemoteState): void
  /** 任意窗 -> 主进程：取手机遥控服务信息（访问地址 + 扫码二维码） */
  getRemoteInfo(): Promise<RemoteInfo>
  /** 控制窗接收主进程转发的手机遥控指令 */
  onRemoteCommand(cb: (cmd: RemoteCommand) => void): () => void
  /** 播放窗接收主进程转来的弹幕（副屏叠加） */
  onDanmaku(cb: (d: DanmakuItem) => void): () => void
}

/** 手机遥控：主进程本地 HTTP 服务信息 */
export interface RemoteInfo {
  /** 手机访问的完整地址，如 http://192.168.1.100:17890/mobile.html */
  url: string
  /** 监听端口 */
  port: number
  /** 二维码图片 dataURL（PNG），渲染进 <img src> 即可 */
  qrDataUrl: string
}

/** 手机遥控：播放状态快照（控制窗实时推送到主进程，再广播给手机） */
export interface RemoteState {
  queue: RemoteSong[]
  history: RemoteSong[]
  currentSong: RemoteSong | null
  playing: boolean
  mode: VideoMode
  volumes: Volumes
  currentTime: number
  duration: number
}

/** 手机遥控：歌曲的精简字段（手机端只需名称/歌手用于点歌与展示） */
export interface RemoteSong {
  id: number
  name: string
  artist: string
  /** 时长（秒，用于列表展示） */
  duration?: number
}

/** 手机遥控：手机下达的指令（主进程 -> 控制窗，转交 store 执行） */
export type RemoteCommand =
  | { cmd: 'togglePlay' }
  | { cmd: 'prev' }
  | { cmd: 'next' }
  | { cmd: 'reSing' }
  | { cmd: 'toggleMode' }
  | { cmd: 'setVolume'; vols: Partial<Volumes> }
  /** 点歌：完整的 Song 对象（主进程已按 id 从曲库解析） */
  | { cmd: 'playSong'; song: Song }
  | { cmd: 'removeAt'; index: number }
  /** 置顶并立即播放（点击已点行） */
  | { cmd: 'topAt'; index: number }
  /** 置顶到下一首（当前播完后即唱，不打断当前） */
  | { cmd: 'pinAt'; index: number }

/** 弹幕：主进程 -> 播放窗（副屏叠加显示） */
export interface DanmakuItem {
  id: number
  text: string
}
