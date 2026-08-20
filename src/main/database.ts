import { createRequire } from 'node:module'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { getAppDataDir } from './config'
import type { Song } from '../shared/types'

// sql.js 是 SQLite 的 WASM 移植版：纯 JS、无需原生编译，适合 Electron 环境。
// 之所以不用 better-sqlite3：其仅提供 Node 预编译包，在 Electron 中必须源码编译
// （需 MSVC/Python），本机通常不具备，会导致 npm install 失败。sql.js 完美规避。

const require = createRequire(import.meta.url)
// 注意：sql.js 的 package.json "exports" 未暴露 ./package.json 子路径，
// require.resolve('sql.js/package.json') 会抛 ERR_PACKAGE_PATH_NOT_EXPORTED。
// 改用其已开放的 ./dist/* 子路径直接定位 wasm。
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')

const DB_PATH = join(getAppDataDir(), 'karaoke.sqlite')

let SQL: SqlJsStatic | null = null
let db: Database | null = null

export interface SongInput {
  name: string
  artist: string
  orig_path: string
  accomp_path: string
  lrc_path: string
  duration?: number
}

export async function initDatabase(): Promise<void> {
  SQL = await initSqlJs({ locateFile: () => wasmPath })
  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH)
    db = new SQL.Database(new Uint8Array(buf))
  } else {
    if (!existsSync(getAppDataDir())) mkdirSync(getAppDataDir(), { recursive: true })
    db = new SQL.Database()
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS song (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT '',
      orig_path TEXT NOT NULL UNIQUE,
      accomp_path TEXT NOT NULL,
      lrc_path TEXT NOT NULL DEFAULT '',
      duration REAL NOT NULL DEFAULT 0,
      create_time TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_song_name ON song(name);
    CREATE INDEX IF NOT EXISTS idx_song_artist ON song(artist);
  `)
  persist()
}

function persist() {
  if (!db) return
  const data = db.export()
  writeFileSync(DB_PATH, Buffer.from(data))
}

function run(sql: string, params: unknown[] = []) {
  if (!db) throw new Error('database not initialized')
  const stmt = db.prepare(sql)
  stmt.run(params as any)
  stmt.free()
  persist()
}

function all(sql: string, params: unknown[] = []): any[] {
  if (!db) throw new Error('database not initialized')
  const stmt = db.prepare(sql)
  stmt.bind(params as any)
  const rows: any[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function upsertSong(song: SongInput): boolean {
  const existing = all('SELECT id FROM song WHERE orig_path = ?', [song.orig_path])
  if (existing.length > 0) {
    run(
      `UPDATE song SET name=?, artist=?, accomp_path=?, lrc_path=? WHERE orig_path=?`,
      [song.name, song.artist, song.accomp_path, song.lrc_path, song.orig_path]
    )
    return false
  }
  run(
    `INSERT INTO song (name, artist, orig_path, accomp_path, lrc_path, duration, create_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      song.name,
      song.artist,
      song.orig_path,
      song.accomp_path,
      song.lrc_path,
      song.duration ?? 0,
      new Date().toISOString()
    ]
  )
  return true
}

export function getSongs(search?: string): Song[] {
  const kw = search && search.trim() ? `%${search.trim()}%` : '%'
  const rows = search && search.trim()
    ? all('SELECT * FROM song WHERE name LIKE ? OR artist LIKE ? ORDER BY name COLLATE NOCASE', [kw, kw])
    : all('SELECT * FROM song ORDER BY name COLLATE NOCASE')
  return rows as Song[]
}

export function countSongs(): number {
  const rows = all('SELECT COUNT(*) AS c FROM song')
  return (rows[0]?.c as number) ?? 0
}

export function updateDuration(id: number, duration: number): void {
  run('UPDATE song SET duration = ? WHERE id = ?', [duration, id])
}
