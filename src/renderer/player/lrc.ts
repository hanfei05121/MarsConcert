// 自研 LRC 歌词解析工具（无第三方依赖）
// 支持标准 [mm:ss.xx] / [mm:ss.xxx] 时间标签，多时间标签同行，忽略元数据标签

export interface LyricLine {
  time: number // 秒
  text: string
}

const TIME_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
const META_TAG = /^\[(ti|ar|al|by|offset|re|ve|kuwo|xiami):/i

export function parseLrc(raw: string): LyricLine[] {
  if (!raw) return []
  const out: LyricLine[] = []
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    if (!line.trim() || META_TAG.test(line)) continue

    const times: number[] = []
    let text = line
    let m: RegExpExecArray | null
    TIME_TAG.lastIndex = 0
    while ((m = TIME_TAG.exec(line)) !== null) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      let ms = 0
      if (m[3] !== undefined) {
        // 2 位当作百分秒，3 位当毫秒
        ms = m[3].length === 2 ? parseInt(m[3], 10) * 10 : parseInt(m[3], 10)
      }
      times.push(min * 60 + sec + ms / 1000)
      text = text.replace(m[0], '')
    }

    text = text.trim()
    if (times.length > 0 && text) {
      for (const t of times) out.push({ time: t, text })
    }
  }

  out.sort((a, b) => a.time - b.time)
  return out
}

/** 返回当前播放时间对应的歌词行索引（无匹配返回 -1） */
export function findActiveLine(lines: LyricLine[], time: number): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= time + 0.15) idx = i
    else break
  }
  return idx
}
