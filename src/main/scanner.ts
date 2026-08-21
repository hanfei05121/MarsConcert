import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { upsertSong, countSongs, pruneSongs } from './database'
import { mediaTokenFor } from './media'
import type { RescanResult } from '../shared/types'

interface LrcMeta {
  title?: string
  artist?: string
}

// 新素材规范：单视频 + 双音频（切换原唱/伴奏只换音频、不重新解码视频）
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv']
const AUDIO_EXTS = ['m4a', 'aac', 'mp3', 'wav', 'ogg', 'flac']

/** 在歌目录下按 basename + 扩展名列表找文件，返回存在的完整路径（找不到返回 ''） */
function findFile(dir: string, base: string, exts: string[]): string {
  for (const ext of exts) {
    const p = join(dir, `${base}.${ext}`)
    if (existsSync(p)) return p
  }
  return ''
}

/** 在目录下找歌手照片（artist/avatar/cover + 图片后缀），签发 media:// token */
function findArtistImage(dir: string): string {
  try {
    const av = readdirSync(dir).find((f) =>
      /^(artist|avatar|cover)\.(jpg|jpeg|png|webp|gif)$/i.test(f)
    )
    return av ? mediaTokenFor(join(dir, av)) : ''
  } catch {
    return ''
  }
}

/** 在歌曲目录内找歌曲专属展示图（logo.* / log.* + 图片后缀），签发 media:// token；找不到返回 '' */
function findLogoImage(dir: string): string {
  try {
    const av = readdirSync(dir).find((f) =>
      /^(logo|log)\.(jpg|jpeg|png|webp|gif)$/i.test(f)
    )
    return av ? mediaTokenFor(join(dir, av)) : ''
  } catch {
    return ''
  }
}

/** 从 LRC 文本中提取元数据标签 [ti:] [ar:] */
function parseLrcMeta(lrcPath: string): LrcMeta {
  try {
    const text = readFileSync(lrcPath, 'utf-8')
    const meta: LrcMeta = {}
    const ti = text.match(/\[ti:\s*(.+?)\s*\]/i)
    const ar = text.match(/\[ar:\s*(.+?)\s*\]/i)
    if (ti) meta.title = ti[1]
    if (ar) meta.artist = ar[1]
    return meta
  } catch {
    return {}
  }
}

interface ScanAcc {
  added: number
  updated: number
  seenPaths: string[]
}

/**
 * 扫描单个歌曲目录并入库。
 * @param dir         歌曲目录
 * @param songName    歌曲名（目录名，lrcTitle 存在时会被覆盖）
 * @param artistFromDir 新布局下由“歌手文件夹名”提供的歌手（旧布局为 undefined）
 * @param avatarFromDir  新布局下由“歌手文件夹”内的照片签发的头像（旧布局为 undefined）
 */
function scanSong(
  dir: string,
  songName: string,
  artistFromDir: string | undefined,
  avatarFromDir: string | undefined,
  acc: ScanAcc
): void {
  // —— 素材识别（单视频 + 双音频，兼容旧「双视频」素材）——
  // 新规范：video.mp4(无音轨) + orig.m4a + accomp.m4a
  // 旧规范回退：orig.mp4/accomp.mp4 自带音轨，<audio> 也能直接播其音轨
  const videoNew = findFile(dir, 'video', VIDEO_EXTS)
  const legacyOrig = findFile(dir, 'orig', VIDEO_EXTS) // orig.mp4 等（旧格式）
  const legacyAccomp = findFile(dir, 'accomp', VIDEO_EXTS)
  let origAudio = findFile(dir, 'orig', AUDIO_EXTS) // orig.m4a 等（新格式）
  let accompAudio = findFile(dir, 'accomp', AUDIO_EXTS)
  const video = videoNew || legacyOrig // 画面：优先 video.mp4，缺省回退旧 orig.mp4
  if (!origAudio) origAudio = legacyOrig // 原唱音频：优先 orig.m4a，回退旧 orig.mp4 的音轨
  if (!accompAudio) accompAudio = legacyAccomp // 伴奏音频：优先 accomp.m4a，回退旧 accomp.mp4

  // 歌词文件约定：优先使用 video.lrc（统一命名），兼容旧的 orig.lrc，
  // 其余 歌名.lrc 作为兜底（仅当目录内没有 video.lrc / orig.lrc 时）
  let lrcPath = ''
  let lrcTitle: string | undefined
  let lrcArtist: string | undefined
  try {
    const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.lrc'))
    if (files.length > 0) {
      const preferred =
        files.find((f) => f.toLowerCase() === 'video.lrc') ??
        files.find((f) => f.toLowerCase() === 'orig.lrc') ??
        files[0]
      lrcPath = join(dir, preferred)
      const meta = parseLrcMeta(lrcPath)
      lrcTitle = meta.title
      lrcArtist = meta.artist
    }
  } catch {
    /* ignore */
  }

  // 必须有视频画面或音频或歌词，才算一首可入库的歌
  if (!video && !origAudio && !lrcPath) return

  // 缺原唱时仍记录预期路径，便于播放窗提示
  const origPath = origAudio || join(dir, 'orig.m4a')
  const accomp = accompAudio || origPath
  acc.seenPaths.push(origPath)

  // 歌手名：歌手文件夹名（新布局）→ artist.txt 首行 → LRC [ar:] 标签（旧布局）
  let artistName = artistFromDir ?? lrcArtist
  try {
    const at = join(dir, 'artist.txt')
    if (existsSync(at)) {
      const t = readFileSync(at, 'utf-8')
      const line = t
        .split('\n')
        .map((s) => s.trim())
        .find((s) => s.length > 0)
      if (line) artistName = line
    }
  } catch {
    /* ignore */
  }

  // 头像：优先歌手文件夹内照片（新布局，全歌手共享一张）；歌目录自带图片（旧布局）兜底
  let artistAvatar = avatarFromDir || ''
  if (!artistAvatar) artistAvatar = findArtistImage(dir)

  // 歌曲展示图：优先歌曲目录内 logo.jpg（歌曲专属 Logo），缺省回退歌手头像 artist.jpg
  const logo = findLogoImage(dir) || artistAvatar

  const isNew = upsertSong({
    name: lrcTitle ?? songName,
    artist: artistName ?? '',
    video_path: video,
    orig_path: origPath,
    accomp_path: accomp,
    lrc_path: lrcPath,
    artist_avatar: artistAvatar,
    logo
  })
  if (isNew) acc.added++
  else acc.updated++
}

/**
 * 扫描素材库目录，自动入库。
 * 支持两种布局：
 * - 新布局：<lib>/<歌手>/<歌曲>/{video.mp4, orig.m4a, accomp.m4a, video.lrc}
 *   歌手文件夹内放一张照片（artist.jpg 等）即全歌手共享头像，无需每首歌配图。
 * - 旧布局（兼容）：<lib>/<歌曲>/{video.mp4, orig.mp4, ...}，歌手由 artist.txt / LRC [ar:] 推断。
 * 歌词文件统一命名为 video.lrc（兼容旧 orig.lrc）。
 */
export function scanLibrary(libPath: string): RescanResult {
  const result: RescanResult = { added: 0, updated: 0, total: 0 }
  if (!existsSync(libPath)) {
    console.warn('[scanner] 素材库目录不存在:', libPath)
    return result
  }

  let entries: string[] = []
  try {
    entries = readdirSync(libPath)
  } catch (e) {
    console.error('[scanner] 读取目录失败:', e)
    return result
  }

  const acc: ScanAcc = { added: 0, updated: 0, seenPaths: [] }

  for (const name of entries) {
    const dir = join(libPath, name)
    if (!statSync(dir).isDirectory()) continue

    // 判断是一级「歌手目录」还是旧版「歌曲目录」：
    // 含子目录且自身没有媒体文件 → 歌手目录（新布局）
    let subDirs: string[] = []
    try {
      subDirs = readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory())
    } catch {
      /* ignore */
    }
    const hasDirectMedia =
      !!findFile(dir, 'video', VIDEO_EXTS) || !!findFile(dir, 'orig', AUDIO_EXTS)

    if (subDirs.length > 0 && !hasDirectMedia) {
      // —— 新布局：<lib>/<歌手>/<歌曲>/ ——
      const avatar = findArtistImage(dir) // 歌手文件夹内的照片，全歌手共享
      for (const songName of subDirs) {
        scanSong(join(dir, songName), songName, name, avatar, acc)
      }
    } else {
      // —— 旧布局：<lib>/<歌曲>/ ——
      scanSong(dir, name, undefined, undefined, acc)
    }
  }

  result.added = acc.added
  result.updated = acc.updated

  // 清理磁盘上已不存在的旧行（素材移动/删除/旧格式残留），避免幽灵或重复歌曲
  try {
    const removed = pruneSongs(acc.seenPaths)
    if (removed > 0) console.log('[scanner] 清理失效歌曲行:', removed)
  } catch (e) {
    console.error('[scanner] 清理失败:', e)
  }

  result.total = countSongs()
  console.log('[scanner] 扫描完成:', result)
  return result
}
