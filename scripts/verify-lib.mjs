// 用与 scanner.ts 完全一致的检测逻辑，对真实曲库 E:/song-lib 做端到端验证
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LIB = 'E:/song-lib'
// 与 scanner.ts 保持一致：只认 .mp4 / *_vocals.mp3 / *_instrumental.mp3
const VIDEO_EXTS = ['mp4']
const AUDIO_EXTS = ['mp3']

function findFile(dir, bases, exts) {
  const list = Array.isArray(bases) ? bases : [bases]
  for (const base of list) for (const ext of exts) {
    const p = join(dir, `${base}.${ext}`)
    if (existsSync(p)) return p
  }
  return ''
}
function findBySuffix(dir, suffixPattern, exts) {
  try {
    const re = new RegExp(`[-_](?:${suffixPattern})\\.(?:${exts.join('|')})$`, 'i')
    const f = readdirSync(dir).find((n) => re.test(n))
    return f ? join(dir, f) : ''
  } catch { return '' }
}
function findAnyVideo(dir, exts) {
  try {
    const f = readdirSync(dir).find((n) => {
      if (/[-_](vocals?|instrumental|原唱|伴奏)\./i.test(n)) return false
      const e = n.toLowerCase().split('.').pop() ?? ''
      return exts.includes(e)
    })
    return f ? join(dir, f) : ''
  } catch { return '' }
}
function detect(dir, songName, artistFromDir) {
  const baseCandidates = artistFromDir
    ? [`${artistFromDir} - ${songName}`, `${artistFromDir}${songName}`, songName]
    : [songName]
  let video = findFile(dir, baseCandidates, VIDEO_EXTS)
  if (!video) video = findAnyVideo(dir, VIDEO_EXTS)
  let origAudio = findFile(dir, baseCandidates.map((b) => `${b}_vocals`), AUDIO_EXTS)
  if (!origAudio) origAudio = findBySuffix(dir, 'vocals?', AUDIO_EXTS)
  let accompAudio = findFile(dir, baseCandidates.map((b) => `${b}_instrumental`), AUDIO_EXTS)
  if (!accompAudio) accompAudio = findBySuffix(dir, 'instrumental', AUDIO_EXTS)
  return { video: !!video, orig: !!origAudio, accomp: !!accompAudio,
    videoPath: video, origPath: origAudio || join(dir, `${baseCandidates[0]}_vocals.mp3`), accompPath: accompAudio }
}

let fail = 0
for (const artist of readdirSync(LIB)) {
  const aDir = join(LIB, artist)
  if (!statSync(aDir).isDirectory()) continue
  for (const song of readdirSync(aDir)) {
    const sDir = join(aDir, song)
    if (!statSync(sDir).isDirectory()) continue
    const r = detect(sDir, song, artist)
    const ok = r.video && r.orig && r.accomp
    if (!ok) fail++
    console.log(`${ok ? '✓' : '✗'} ${artist}/${song}`)
    console.log(`    video: ${r.videoPath || '(无)'}`)
    console.log(`    orig : ${r.origPath || '(无)'}`)
    console.log(`    accomp: ${r.accompPath || '(无)'}`)
  }
}
console.log(fail === 0 ? '\n全部歌曲素材识别正常' : `\n有 ${fail} 首识别异常`)
process.exit(fail === 0 ? 0 : 1)
