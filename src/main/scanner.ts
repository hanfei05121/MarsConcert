import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { upsertSong, countSongs } from './database'
import { mediaTokenFor } from './media'
import type { RescanResult } from '../shared/types'

interface LrcMeta {
  title?: string
  artist?: string
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

/**
 * 扫描素材库目录，自动入库。
 * 目录结构：<songLibPath>/<歌名>/orig.mp4 [accomp.mp4] [歌名.lrc]
 * 仅当存在 orig.mp4 时才登记为可用歌曲。
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

  for (const name of entries) {
    const dir = join(libPath, name)
    if (!statSync(dir).isDirectory()) continue

    const orig = join(dir, 'orig.mp4')
    const hasOrig = existsSync(orig)
    const accompFile = join(dir, 'accomp.mp4')
    const hasAccomp = existsSync(accompFile)

    // 歌词文件约定：优先使用 orig.lrc（与视频匹配的标准歌词），
    // 其余 歌名.lrc 作为兼容回退（仅当某歌目录没有 orig.lrc 时）
    let lrcPath = ''
    let lrcTitle: string | undefined
    let lrcArtist: string | undefined
    try {
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.lrc'))
      if (files.length > 0) {
        const preferred = files.find((f) => f.toLowerCase() === 'orig.lrc')
        lrcPath = join(dir, preferred ?? files[0])
        const meta = parseLrcMeta(lrcPath)
        lrcTitle = meta.title
        lrcArtist = meta.artist
      }
    } catch {
      /* ignore */
    }

    // 必须有原唱 MV 或歌词，才算一首可入库的歌（缺原唱时仍可展示列表，播放窗会提示缺素材）
    if (!hasOrig && !lrcPath) continue

    const origPath = hasOrig ? orig : orig // 缺原唱时仍记录预期路径，便于播放窗提示
    const accomp = hasAccomp ? accompFile : origPath

    // 作者名：优先读目录内 artist.txt（首行非空即作者），否则回退 LRC [ar:] 标签
    let artistName = lrcArtist
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

    // 头像图：检测目录内 artist/avatar/cover + 图片后缀，签发 media:// token
    let artistAvatar = ''
    try {
      const av = readdirSync(dir).find((f) =>
        /^(artist|avatar|cover)\.(jpg|jpeg|png|webp|gif)$/i.test(f)
      )
      if (av) artistAvatar = mediaTokenFor(join(dir, av))
    } catch {
      /* ignore */
    }

    const isNew = upsertSong({
      name: lrcTitle ?? name,
      artist: artistName ?? '',
      orig_path: origPath,
      accomp_path: accomp,
      lrc_path: lrcPath,
      artist_avatar: artistAvatar
    })
    if (isNew) result.added++
    else result.updated++
  }

  result.total = countSongs()
  console.log('[scanner] 扫描完成:', result)
  return result
}
