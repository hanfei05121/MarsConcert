import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { AppConfig } from '../shared/types'

const DEFAULT_CONFIG: AppConfig = {
  songLibPath: 'D:/song-lib',
  videoMode: 'orig',
  volumes: { orig: 1, accomp: 1, master: 1, mic: 1 },
  playerScreenId: -1
}

const appDataDir = join(app.getPath('userData'), 'app-data')
const configPath = join(appDataDir, 'config.json')

function ensureDir() {
  if (!existsSync(appDataDir)) mkdirSync(appDataDir, { recursive: true })
}

export function loadConfig(): AppConfig {
  ensureDir()
  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG)
    return { ...DEFAULT_CONFIG }
  }
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      volumes: { ...DEFAULT_CONFIG.volumes, ...(parsed.volumes ?? {}) }
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(cfg: AppConfig): void {
  ensureDir()
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
}

export function getAppDataDir(): string {
  return appDataDir
}
