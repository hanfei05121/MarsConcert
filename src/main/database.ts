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
  /** 视频画面文件（<基名>.mp4，无音轨），所有模式共用 */
  video_path: string
  /** 原唱音频文件（<基名>_vocals.<ext>） */
  orig_path: string
  /** 伴奏音频文件（<基名>_instrumental.<ext>） */
  accomp_path: string
  lrc_path: string
  artist_avatar?: string
  logo?: string
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
      video_path TEXT NOT NULL DEFAULT '',
      orig_path TEXT NOT NULL UNIQUE,
      accomp_path TEXT NOT NULL,
      lrc_path TEXT NOT NULL DEFAULT '',
      duration REAL NOT NULL DEFAULT 0,
      lyric_offset REAL NOT NULL DEFAULT 0,
      artist_avatar TEXT NOT NULL DEFAULT '',
      logo TEXT NOT NULL DEFAULT '',
      create_time TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_song_name ON song(name);
    CREATE INDEX IF NOT EXISTS idx_song_artist ON song(artist);
  `)
  // 兼容旧库：已存在的表不会重跑 CREATE TABLE，需补齐新增列
  const cols = all('PRAGMA table_info(song)') as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'lyric_offset')) {
    run('ALTER TABLE song ADD COLUMN lyric_offset REAL NOT NULL DEFAULT 0')
  }
  if (!cols.some((c) => c.name === 'artist_avatar')) {
    run('ALTER TABLE song ADD COLUMN artist_avatar TEXT NOT NULL DEFAULT \'\'')
  }
  if (!cols.some((c) => c.name === 'logo')) {
    run('ALTER TABLE song ADD COLUMN logo TEXT NOT NULL DEFAULT \'\'')
  }
  if (!cols.some((c) => c.name === 'video_path')) {
    // 旧库（双视频方案）没有 video_path：先把 orig_path 回填为视频画面，
    // 待下一次扫描用新素材规范（video.mp4 + orig.m4a + accomp.m4a）覆盖
    run("ALTER TABLE song ADD COLUMN video_path TEXT NOT NULL DEFAULT ''")
    run('UPDATE song SET video_path = orig_path')
  }
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
      `UPDATE song SET name=?, artist=?, artist_avatar=?, logo=?, video_path=?, accomp_path=?, lrc_path=? WHERE orig_path=?`,
      [
        song.name,
        song.artist,
        song.artist_avatar ?? '',
        song.logo ?? '',
        song.video_path,
        song.accomp_path,
        song.lrc_path,
        song.orig_path
      ]
    )
    return false
  }
  run(
    `INSERT INTO song (name, artist, artist_avatar, logo, video_path, orig_path, accomp_path, lrc_path, duration, create_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      song.name,
      song.artist,
      song.artist_avatar ?? '',
      song.logo ?? '',
      song.video_path,
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
  // DB 列是 snake_case，Song 接口混用 camelCase（lyricOffset / artistAvatar），必须显式映射，
  // 否则这些字段会 undefined（头像不显示、歌词偏移无法恢复）。
  return rows.map(rowToSong)
}

/** 数据库行（snake_case）→ Song 对象（按 Song 接口字段名映射） */
function rowToSong(row: any): Song {
  return {
    id: row.id,
    name: row.name,
    artist: row.artist,
    video_path: row.video_path ?? '',
    orig_path: row.orig_path,
    accomp_path: row.accomp_path,
    lrc_path: row.lrc_path,
    duration: row.duration,
    lyricOffset: row.lyric_offset ?? 0,
    artistAvatar: row.artist_avatar ?? '',
    logo: row.logo ?? '',
    create_time: row.create_time
  }
}

/** 清理磁盘上已不存在的旧歌曲行（素材被删除或旧双视频格式残留），保持列表与磁盘一致 */
export function pruneSongs(keepPaths: string[]): number {
  let before = 0
  try {
    before = (all('SELECT COUNT(*) AS c FROM song')[0]?.c as number) ?? 0
  } catch {
    return 0
  }
  if (keepPaths.length === 0) {
    run('DELETE FROM song')
  } else {
    const marks = keepPaths.map(() => '?').join(',')
    run(`DELETE FROM song WHERE orig_path NOT IN (${marks})`, keepPaths)
  }
  const after = (all('SELECT COUNT(*) AS c FROM song')[0]?.c as number) ?? 0
  return before - after
}

export function countSongs(): number {
  const rows = all('SELECT COUNT(*) AS c FROM song')
  return (rows[0]?.c as number) ?? 0
}

export function updateDuration(id: number, duration: number): void {
  run('UPDATE song SET duration = ? WHERE id = ?', [duration, id])
}

export function updateLyricOffset(id: number, offset: number): void {
  run('UPDATE song SET lyric_offset = ? WHERE id = ?', [offset, id])
}
