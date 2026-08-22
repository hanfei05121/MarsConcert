import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { upsertSong, countSongs, pruneSongs } from './database'
import { mediaTokenFor } from './media'
import type { RescanResult } from '../shared/types'

interface LrcMeta {
  title?: string
  artist?: string
}

// 只认这几种素材文件，其余一律不碰：logo.jpg / *.lrc / *.mp4 / *_vocals.mp3 / *_instrumental.mp3
const VIDEO_EXTS = ['mp4']
const AUDIO_EXTS = ['mp3']

/**
 * 在歌目录下按「候选基名 + 扩展名列表」找第一个存在的文件，返回完整路径（找不到返回 ''）。
 * bases 支持多个候选（按优先级），例如 ['<基名>_vocals', '<基名>']：命中前者优先。
 */
function findFile(dir: string, bases: string | string[], exts: string[]): string {
  const list = Array.isArray(bases) ? bases : [bases]
  for (const base of list) {
    for (const ext of exts) {
      const p = join(dir, `${base}.${ext}`)
      if (existsSync(p)) return p
    }
  }
  return ''
}

/**
 * 在歌目录内按「<分隔符><后缀>.<扩展名>」直扫文件（不依赖基名/前缀猜测）。
 * 分隔符 `-` 或 `_` 均可（兼容下载源写法，如 华晨宇 - 怪诞心理学-vocal.mp3）；
 * suffixPattern 支持正则（如 'vocals?' 同时认 vocal / vocals 单复数）。
 */
function findBySuffix(dir: string, suffixPattern: string, exts: string[]): string {
  try {
    const re = new RegExp(`[-_](?:${suffixPattern})\\.(?:${exts.join('|')})$`, 'i')
    const f = readdirSync(dir).find((n) => re.test(n))
    return f ? join(dir, f) : ''
  } catch {
    return ''
  }
}

/**
 * 在歌目录内兜底找任意背景视频文件（只看扩展名、不看基名/前缀），
 * 排除 vocals/instrumental 等音轨文件，兼容目录名与文件名不一致的场景
 * （如目录《不重逢》内文件实际叫「华晨宇 - 不重逢.mp4」）。
 */
function findAnyVideo(dir: string, exts: string[]): string {
  try {
    const f = readdirSync(dir).find((n) => {
      if (/[-_](vocals?|instrumental|原唱|伴奏)\./i.test(n)) return false
      const e = n.toLowerCase().split('.').pop() ?? ''
      return exts.includes(e)
    })
    return f ? join(dir, f) : ''
  } catch {
    return ''
  }
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

/** 在歌曲目录内找歌曲展示图（只认 logo.jpg），签发 media:// token；找不到返回 '' */
function findLogoImage(dir: string): string {
  try {
    const av = readdirSync(dir).find((f) => f.toLowerCase() === 'logo.jpg')
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
  // —— 素材识别（只认这几种文件，其余一律不碰）——
  //   logo.jpg / *.lrc / *.mp4 / *_vocals.mp3 / *_instrumental.mp3
  // 基名候选：新布局下文件名带歌手前缀（"华晨宇 - 烟火里的尘埃"），旧布局下即歌曲目录名
  const baseCandidates = artistFromDir
    ? [`${artistFromDir} - ${songName}`, `${artistFromDir}${songName}`, songName]
    : [songName]

  // 视频画面：<基名>.mp4 → 目录内任意 .mp4（只看后缀、不看前缀，兼容目录名与文件名不一致）
  let video = findFile(dir, baseCandidates, VIDEO_EXTS)
  if (!video) video = findAnyVideo(dir, VIDEO_EXTS)

  // 原唱音频：<基名>_vocals.mp3 → 目录内任意 -vocal(s).mp3 / _vocal(s).mp3（不依赖基名/分隔符猜测）
  let origAudio = findFile(dir, baseCandidates.map((b) => `${b}_vocals`), AUDIO_EXTS)
  if (!origAudio) origAudio = findBySuffix(dir, 'vocals?', AUDIO_EXTS)

  // 伴奏音频：<基名>_instrumental.mp3 → 目录内任意 -instrumental.mp3 / _instrumental.mp3
  let accompAudio = findFile(dir, baseCandidates.map((b) => `${b}_instrumental`), AUDIO_EXTS)
  if (!accompAudio) accompAudio = findBySuffix(dir, 'instrumental', AUDIO_EXTS)

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
        files.find((f) =>
          baseCandidates.some((b) => f.toLowerCase() === `${b.toLowerCase()}.lrc`)
        ) ??
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

  // 缺原唱时仍记录预期路径（<基名>_vocals.mp3），便于播放窗提示与 prune 比对
  const origPath = origAudio || join(dir, `${baseCandidates[0]}_vocals.mp3`)
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
 * 只识别这几种素材文件（其余一律不碰）：
 *   logo.jpg（歌曲展示图）、*.lrc（歌词）、*.mp4（背景视频）、
 *   *_vocals.mp3（原唱）、*_instrumental.mp3（伴奏）。
 * 支持两种布局：
 * - 新布局：<lib>/<歌手>/<歌曲>/，素材以「歌手 - 歌曲」为基名
 *   （如 华晨宇 - 烟火里的尘埃.mp4 / _vocals.mp3 / _instrumental.mp3），
 *   歌手文件夹内放一张 artist.jpg 即全歌手共享头像。
 * - 旧扁平布局（兼容）：<lib>/<歌曲>/，基名即目录名，歌手由 artist.txt / LRC [ar:] 推断。
 * 歌词文件优先 video.lrc，兼容 orig.lrc / <基名>.lrc。
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
      !!findAnyVideo(dir, VIDEO_EXTS) ||
      !!findBySuffix(dir, 'vocals?', AUDIO_EXTS) ||
      !!findBySuffix(dir, 'instrumental', AUDIO_EXTS)

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
