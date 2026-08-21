import { createHash } from 'node:crypto'

// media:// token -> 真实路径。渲染进程只拿到不透明的 token，杜绝路径拼接注入
export const mediaTokens = new Map<string, string>()

/** 为一个本地媒体文件签发 media://res/<token> 地址，并登记 token->路径 映射 */
export function mediaTokenFor(path: string): string {
  const token = createHash('sha1').update(path).digest('base64url')
  mediaTokens.set(token, path)
  return `media://res/${token}`
}

/** 按扩展名推断正确的 Content-Type（图片用对 mime，<img> 才能正常渲染） */
export function mimeOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp'
  }
  return map[ext] ?? 'application/octet-stream'
}
