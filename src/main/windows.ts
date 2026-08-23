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
    title: '火星点歌台 · MARS KTV',
    backgroundColor: '#14100e',
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
    const p = screen.getPrimaryDisplay().bounds
    const external = displays.find(
      (d) => !(d.bounds.x === p.x && d.bounds.y === p.y && d.bounds.width === p.width && d.bounds.height === p.height)
    )
    return external ?? screen.getPrimaryDisplay()
  }
  return screen.getPrimaryDisplay()
}

/** 播放窗（副屏/电视）：无边框铺满扩展屏，仅展示 MV + 歌词
 *  关键：刻意不使用 alwaysOnTop / 真正 fullscreen / win.focus()。
 *  否则播放窗会变成系统级置顶 + 独占全屏并抢走焦点，
 *  导致控制台与其它软件点不动、只能关副屏才能夺回控制权。
 */
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
    fullscreen: false,
    title: '桌面系统测试 · 播放屏',
    backgroundColor: '#000000',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 播放窗被控制台/其它窗口盖住时不节流，配合前端可见性恢复逻辑，
      // 避免“切到别的页面就暂停”（Chromium 会对隐藏窗口的静音视频暂停）
      backgroundThrottling: false
    }
  })

  const url = rendererUrl('player')
  if (url) win.loadURL(url)
  else win.loadFile(join(__dirname, '../renderer/player.html'))

  // 用无边框窗口“铺满”目标屏幕达到视觉全屏，但不进入独占全屏、也不置顶，
  // 这样控制台在主屏可正常点击，副屏照样全屏放 MV，且随时可 Alt+Tab 切走。
  win.setBounds({ x, y, width, height })
  return win
}
