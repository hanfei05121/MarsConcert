import { app, ipcMain, BrowserWindow, protocol } from 'electron'
import { readFileSync, existsSync } from 'node:fs'
import { loadConfig, saveConfig } from './config'
import { getSongs, updateDuration, initDatabase } from './database'
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

function readLrc(path: string): string {
  if (!path || !existsSync(path)) return ''
  try {
    return readFileSync(path, 'utf-8')
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
    const lrc = readLrc(song.lrc_path)
    sendToPlayer(IPC.TO_PLAYER_LOAD, { song, lrc, mode: currentMode, volumes })
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

  // 注册本地媒体协议，让渲染进程通过 media:// 访问 D:/ 下的视频文件
  protocol.registerFileProtocol('media', (request, callback) => {
    let p = decodeURIComponent(request.url.slice('media://'.length).replace(/^\/+/, ''))
    callback({ path: p })
  })

  mainWindow = createMainWindow()
  playerWindow = createPlayerWindow(config)

  registerIpc()

  // 启动即扫描素材库
  scanLibrary(config.songLibPath)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  playerWindow.on('closed', () => {
    playerWindow = null
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow()
    playerWindow = createPlayerWindow(config)
    registerIpc()
  }
})
