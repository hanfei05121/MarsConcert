import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { AppConfig } from '../shared/types'

const PRELOAD = join(__dirname, '../preload/index.js')

function rendererUrl(page: 'index' | 'player'): string | undefined {
  const base = process.env.ELECTRON_RENDERER_URL
  return base ? `${base}/${page}.html` : undefined
}

/** 控制窗（主屏）：点歌、搜索、调音量、切歌 */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: '桌面系统测试 · 控制台',
    backgroundColor: '#0b0e14',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const url = rendererUrl('index')
  if (url) win.loadURL(url)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

/** 选择播放窗口要用的屏幕：优先扩展屏，否则使用主屏 */
function pickPlayerDisplay(config: AppConfig) {
  const displays = screen.getAllDisplays()
  if (displays.length > 1) {
    if (config.playerScreenId >= 0) {
      const found = displays.find((d) => d.id === config.playerScreenId)
      if (found) return found
    }
    // 默认选择非主屏（扩展屏）
    const external = displays.find((d) => !d.bounds.equals(screen.getPrimaryDisplay().bounds))
    return external ?? screen.getPrimaryDisplay()
  }
  return screen.getPrimaryDisplay()
}

/** 播放窗（副屏/电视）：无边框、置顶、全屏，仅展示 MV + 歌词 */
export function createPlayerWindow(config: AppConfig): BrowserWindow {
  const display = pickPlayerDisplay(config)
  const { x, y, width, height } = display.bounds

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    fullscreen: true,
    title: '桌面系统测试 · 播放屏',
    backgroundColor: '#000000',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const url = rendererUrl('player')
  if (url) win.loadURL(url)
  else win.loadFile(join(__dirname, '../renderer/player.html'))

  // 确保它在目标屏幕并置顶
  win.setBounds({ x, y, width, height })
  win.focus()
  return win
}
