// 把曲库素材统一重命名为「歌手 - 歌曲」基名 + 后缀的新规范：
//   video.mp4 / video.mkv ...        → <歌手> - <歌曲>.mp4（保留原扩展名）
//   orig.mp3 / orig.m4a ...          → <歌手> - <歌曲>_vocals.<扩展名>
//   accomp.mp3 / accomp.m4a ...      → <歌手> - <歌曲>_instrumental.<扩展名>
//   <基名>-vocal / -vocals / -instrumental.mp3（下载源连字符写法）→ _vocals / _instrumental
// 用法：
//   node scripts/rename-lib.mjs --dry   # 仅打印将要重命名的清单
//   node scripts/rename-lib.mjs          # 实际执行（幂等，可重复运行）
import { existsSync, readdirSync, renameSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

const LIB = 'E:/song-lib'
const AUDIO_EXTS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv']
const DRY = process.argv.includes('--dry')

const log = { renamed: 0, skipped: 0, items: [] }

function renameTo(dir, oldName, newName) {
  const oldPath = join(dir, oldName)
  const newPath = join(dir, newName)
  if (!existsSync(oldPath) || oldName === newName) return
  if (existsSync(newPath)) {
    log.skipped++
    log.items.push(`⏭ 跳过：${oldName} → ${newName}（目标已存在）`)
    return
  }
  if (!DRY) renameSync(oldPath, newPath)
  log.renamed++
  log.items.push(`${DRY ? '· 将' : '✓'} ${oldName} → ${newName}`)
}

// 规范化音轨后缀：兼容下载源常见的 -vocal / -vocals / -instrumental（连字符、单复数）写法
function normalizeSuffixes(dir) {
  let files = []
  try {
    files = readdirSync(dir)
  } catch {
    return
  }
  for (const f of files) {
    const m = f.match(/^(.+?)[-_](vocal|vocals|instrumental)\.(mp3)$/i)
    if (!m) continue
    const plural = m[2].toLowerCase() === 'instrumental' ? 'instrumental' : 'vocals'
    renameTo(dir, f, `${m[1]}_${plural}.${m[3].toLowerCase()}`)
  }
}

function renameSong(dir, base) {
  // 视频：video.<ext> → <base>.<ext>（不动已按新规范命名的文件）
  for (const ext of VIDEO_EXTS) renameTo(dir, `video.${ext}`, `${base}.${ext}`)
  // 原唱：orig.<ext> → <base>_vocals.<ext>
  for (const ext of AUDIO_EXTS) renameTo(dir, `orig.${ext}`, `${base}_vocals.${ext}`)
  // 伴奏：accomp.<ext> → <base>_instrumental.<ext>
  for (const ext of AUDIO_EXTS) renameTo(dir, `accomp.${ext}`, `${base}_instrumental.${ext}`)
  // 下载源变体：-vocal / -vocals / -instrumental → _vocals / _instrumental
  normalizeSuffixes(dir)
}

if (!existsSync(LIB)) {
  console.error(`素材库不存在: ${LIB}`)
  process.exit(1)
}

for (const entry of readdirSync(LIB)) {
  const dir = join(LIB, entry)
  if (!statSync(dir).isDirectory()) continue // 跳过根目录散文件（如 *.crdownload）

  let subDirs = []
  try {
    subDirs = readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory())
  } catch {
    continue
  }

  if (subDirs.length > 0) {
    // 新布局：<lib>/<歌手>/<歌曲>/，基名 = 「歌手 - 歌曲」
    for (const song of subDirs) renameSong(join(dir, song), `${entry} - ${song}`)
  } else {
    // 旧扁平布局：<lib>/<歌曲>/，基名 = 目录名
    renameSong(dir, entry)
  }
}

console.log(log.items.join('\n'))
console.log(`\n${DRY ? '[dry-run] 将要重命名' : '完成'}：重命名 ${log.renamed} 个，跳过 ${log.skipped} 个`)
