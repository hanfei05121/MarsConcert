import { app, ipcMain, BrowserWindow, protocol, shell } from 'electron'
import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { Readable } from 'node:stream'
import { loadConfig, saveConfig } from './config'
import { getSongs, updateDuration, updateLyricOffset, initDatabase } from './database'
import { scanLibrary } from './scanner'
import { createMainWindow, createPlayerWindow } from './windows'
import { IPC } from '../shared/types'
import type { AppConfig, Song, VideoMode, Volumes } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let playerWindow: BrowserWindow | null = null
let config: AppConfig = loadConfig()
let currentSong: Song | null = null
let currentMode: VideoMode = config.videoMode
let volumes: Volumes = config.volumes

// 必须在 app ready 之前注册，赋予 media:// 跨域加载本地文件的权限
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true }
  }
])

// media:// token -> 真实路径。渲染进程只拿到不透明的 token，杜绝路径拼接注入
const mediaTokens = new Map<string, string>()

/** 为一个本地媒体文件签发 media://res/<token> 地址，并登记 token->路径 映射 */
function mediaTokenFor(path: string): string {
  const token = createHash('sha1').update(path).digest('base64url')
  mediaTokens.set(token, path)
  return `media://res/${token}`
}

function readLrc(path: string): string {
  if (!path || !existsSync(path)) return ''
  try {
    const buf = readFileSync(path)
    let text = buf.toString('utf-8')
    // 出现替换符 → 歌词多为 GBK/GB2312 编码，回退按 GB18030 解码
    if (text.includes('\uFFFD')) {
      try {
        text = new TextDecoder('gb18030').decode(buf)
      } catch {
        /* 保持原文 */
      }
    }
    return text
  } catch {
    return ''
  }
}

function sendToPlayer(channel: string, ...args: unknown[]) {
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.webContents.send(channel, ...args)
  }
}

function sendToMain(channel: string, ...args: unknown[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

function registerIpc() {
  // —— 控制窗调用 ——
  ipcMain.handle(IPC.SONGS_LIST, (_e, search?: string) => getSongs(search))
  ipcMain.handle(IPC.LIBRARY_RESCAN, () => scanLibrary(config.songLibPath))
  ipcMain.handle(IPC.CONFIG_GET, () => config)
  ipcMain.handle(IPC.CONFIG_SAVE, (_e, cfg: AppConfig) => {
    config = { ...config, ...cfg, volumes: { ...volumes, ...(cfg.volumes ?? {}) } }
    volumes = config.volumes
    currentMode = config.videoMode
    saveConfig(config)
    sendToPlayer(IPC.TO_PLAYER_VOLUMES, volumes)
    return config
  })

  ipcMain.handle(IPC.PLAYER_PLAY, (_e, song: Song) => {
    currentSong = song
    // 首次点歌时再创建播放窗，避免启动就全屏盖住控制台
    if (!playerWindow || playerWindow.isDestroyed()) {
      playerWindow = createPlayerWindow(config)
      playerWindow.on('closed', () => {
        playerWindow = null
        currentSong = null
      })
    }
    const lrc = readLrc(song.lrc_path)
    const payload = { song, lrc, mode: currentMode, volumes, urls: { orig: mediaTokenFor(song.orig_path), accomp: mediaTokenFor(song.accomp_path) } }
    const wc = playerWindow.webContents
    // 若窗口还在加载，等就绪后再下达指令，避免消息丢失
    if (wc.isLoading()) wc.once('did-finish-load', () => sendToPlayer(IPC.TO_PLAYER_LOAD, payload))
    else sendToPlayer(IPC.TO_PLAYER_LOAD, payload)
  })

  ipcMain.handle(IPC.PLAYER_SET_MODE, (_e, mode: VideoMode) => {
    currentMode = mode
    config.videoMode = mode
    saveConfig(config)
    sendToPlayer(IPC.TO_PLAYER_SET_MODE, mode)
  })

  ipcMain.handle(IPC.PLAYER_CONTROL, (_e, action: string, payload?: unknown) => {
    sendToPlayer(IPC.TO_PLAYER_CONTROL, { action, payload })
  })

  ipcMain.handle(IPC.PLAYER_SET_VOLUMES, (_e, vols: Volumes) => {
    volumes = vols
    config.volumes = vols
    saveConfig(config)
    sendToPlayer(IPC.TO_PLAYER_VOLUMES, vols)
  })

  // 保存当前歌曲的歌词偏移（按歌曲持久化）
  ipcMain.handle(IPC.LYRIC_OFFSET_SET, (_e, songId: number, offset: number) => {
    updateLyricOffset(songId, offset)
  })

  // 窗口控制（最小化 / 最大化 / 关闭）
  ipcMain.handle(IPC.WINDOW_CONTROL, (_e, action: string) => {
    const w = mainWindow
    if (!w || w.isDestroyed()) return
    if (action === 'min') w.minimize()
    else if (action === 'max') {
      if (w.isMaximized()) w.unmaximize()
      else w.maximize()
    } else if (action === 'close') w.close()
  })

  // 打开本地素材库文件夹（不存在则先创建）
  // 播放窗 Esc：最小化播放屏并把焦点还给控制台，避免被无边框窗口“困住”
  ipcMain.handle(IPC.PLAYER_ESCAPE, () => {
    if (playerWindow && !playerWindow.isDestroyed()) playerWindow.minimize()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus()
  })

  ipcMain.handle(IPC.LIBRARY_OPEN, async () => {
    try {
      if (!existsSync(config.songLibPath)) mkdirSync(config.songLibPath, { recursive: true })
      const err = await shell.openPath(config.songLibPath)
      return err || 'ok'
    } catch (e) {
      return String(e)
    }
  })

  // —— 播放窗事件 -> 主进程 -> 控制窗 ——
  ipcMain.on(IPC.FROM_PLAYER_TIME, (_e, data: { currentTime: number; duration: number }) => {
    if (currentSong && data.duration > 0) updateDuration(currentSong.id, data.duration)
    sendToMain(IPC.SYNC_TIME, data)
  })
  ipcMain.on(IPC.FROM_PLAYER_STATE, (_e, data: { playing: boolean }) => {
    sendToMain(IPC.SYNC_STATE, data)
  })
  ipcMain.on(IPC.FROM_PLAYER_ENDED, () => {
    sendToMain(IPC.SYNC_ENDED)
  })
}

app.whenReady().then(async () => {
  config = loadConfig()
  volumes = config.volumes
  currentMode = config.videoMode

  // 初始化本地 SQLite（sql.js / WASM），必须在扫描前完成
  await initDatabase()

  protocol.handle('media', async (request) => {
    const token = new URL(request.url).pathname.replace(/^\//, '')
    const filePath = mediaTokens.get(token)
    if (!filePath) return new Response('not found', { status: 404 })
    try {
      const size = statSync(filePath).size
      const isMp3 = /\.mp3$/i.test(filePath)
      const range = request.headers.get('Range')
      let start = 0
      let end = size - 1
      let status = 200
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range)
        if (m) {
          status = 206
          if (m[1] === '' && m[2]) start = Math.max(size - parseInt(m[2], 10), 0)
          else {
            if (m[1]) start = parseInt(m[1], 10)
            if (m[2]) end = parseInt(m[2], 10)
          }
        }
      }
      const headers: Record<string, string> = {
        'Content-Type': isMp3 ? 'audio/mpeg' : 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1)
      }
      if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`
      const body = Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as BodyInit
      return new Response(body, { status, headers })
    } catch {
      return new Response('failed', { status: 500 })
    }
  })

  mainWindow = createMainWindow()

  registerIpc()

  // 素材库目录不存在则先创建，保证应用可正常启动，用户可直接拖入素材
  if (!existsSync(config.songLibPath)) mkdirSync(config.songLibPath, { recursive: true })

  // 启动即扫描素材库
  scanLibrary(config.songLibPath)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow()
    playerWindow = null
    registerIpc()
  }
})
