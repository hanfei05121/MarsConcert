// 手机遥控服务：在本地起一个 HTTP + SSE 服务，供同一局域网内的手机 H5 扫码接入。
// 职责：
//  - 静态托管 build 出来的手机端 H5（dist/renderer/mobile.html）
//  - POST /api/command：接收手机指令（点歌/控制/音量/队列/弹幕），转交给控制窗执行
//  - GET  /remote     ：Server-Sent Events，向手机的每个页面实时推送播放状态与弹幕
//  - 生成二维码（http://<内网IP>:<端口>/mobile.html），供主控制窗/副屏待机页展示
//
// 设计取舍：不用 WebSocket，改用更简单的 HTTP + SSE，减少运行时依赖（仅需 qrcode 生成二维码）。

import { createServer, type Server, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { networkInterfaces } from 'node:os'
import QRCode from 'qrcode'
import { getSongs } from './database'
import type { DanmakuItem, RemoteCommand, RemoteInfo, RemoteSong, RemoteState, Song, Volumes } from '../shared/types'

const PORT = 17890
/** build 产物里的渲染进程目录（手机 H5 从这里出） */
const RENDER_DIR = join(__dirname, '../renderer')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json'
}

export interface RemoteServerOptions {
  /** 把手机指令转发给控制窗（经由 IPC 交给 Vue store 执行） */
  forwardToControl: (cmd: RemoteCommand) => void
  /** 弹幕：转发给副屏播放窗叠加显示 */
  onDanmaku: (item: DanmakuItem) => void
}

export interface RemoteServerHandle {
  /** 控制窗推送的播放状态快照（广播给所有手机页面） */
  setState(state: RemoteState): void
  getInfo(): RemoteInfo
}

let danmakuSeq = 0

/** 找到内网 IPv4 地址（展示在二维码/地址里，手机需和 PC 同一局域网才能访问） */
function lanAddress(): string {
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return '127.0.0.1'
}

export function startRemoteServer(opts: RemoteServerOptions): RemoteServerHandle {
  let server: Server | null = null
  let remoteUrl = ''
  let qrDataUrl = ''
  let lastStateJson = ''
  let infoCached: RemoteInfo | null = null
  /** SSE 客户端集合：每个手机页面一个 open 的响应流 */
  const clients = new Set<ServerResponse>()

  function broadcast(obj: unknown) {
    const payload = `data: ${JSON.stringify(obj)}\n\n`
    for (const res of clients) {
      try {
        res.write(payload)
      } catch {
        /* 断开即由 close 清掉 */
      }
    }
  }

  function resolveHost(): { url: string; port: number } {
    const port = server?.address() && typeof server?.address() === 'object' ? (server.address() as { port: number }).port : PORT
    return { url: `http://${lanAddress()}:${port}/mobile.html`, port }
  }

  // 静态资源：限定在 dist/renderer 内，防路径穿越
  async function serveStatic(urlPath: string, res: ServerResponse) {
    const clean = urlPath.split('?')[0]
    const rel = clean === '/' ? 'mobile.html' : clean.replace(/^\//, '')
    const file = normalize(join(RENDER_DIR, rel))
    if (!file.startsWith(RENDER_DIR + '\\') && !file.startsWith(RENDER_DIR + '/') && file !== RENDER_DIR + '\\mobile.html') {
      res.writeHead(403).end('forbidden')
      return
    }
    try {
      const st = await stat(file)
      if (!st.isFile()) throw new Error('not a file')
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'content-length': body.length })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  }

  function handleCommand(body: unknown, res: ServerResponse) {
    const msg = body as Record<string, any>
    const op = msg?.op
    try {
      switch (op) {
        case 'search': {
          const kw = typeof msg.q === 'string' ? msg.q : ''
          const songs: RemoteSong[] = getSongs(kw).map((s) => ({ id: s.id, name: s.name, artist: s.artist }))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: true, songs }))
          return
        }
        case 'play': {
          const song: Song | undefined = getSongs().find((s) => s.id === Number(msg.id))
          if (!song) return res.writeHead(404).end(JSON.stringify({ ok: false, error: 'song not found' }))
          opts.forwardToControl({ cmd: 'playSong', song: { ...song } })
          res.end(JSON.stringify({ ok: true }))
          return
        }
        case 'control': {
          const name = msg.name as string
          if (name === 'togglePlay') opts.forwardToControl({ cmd: 'togglePlay' })
          else if (name === 'next') opts.forwardToControl({ cmd: 'next' })
          else if (name === 'prev') opts.forwardToControl({ cmd: 'prev' })
          else if (name === 'reSing') opts.forwardToControl({ cmd: 'reSing' })
          else if (name === 'toggleMode') opts.forwardToControl({ cmd: 'toggleMode' })
          else return res.writeHead(400).end(JSON.stringify({ ok: false, error: 'unknown control' }))
          res.end(JSON.stringify({ ok: true }))
          return
        }
        case 'volume': {
          const vols = (msg.vols ?? {}) as Partial<Volumes>
          opts.forwardToControl({ cmd: 'setVolume', vols })
          res.end(JSON.stringify({ ok: true }))
          return
        }
        case 'queue': {
          const action = msg.action as string
          const index = Number(msg.index)
          if (action === 'remove') opts.forwardToControl({ cmd: 'removeAt', index })
          else if (action === 'top') opts.forwardToControl({ cmd: 'topAt', index })
          else return res.writeHead(400).end(JSON.stringify({ ok: false, error: 'unknown queue action' }))
          res.end(JSON.stringify({ ok: true }))
          return
        }
        case 'danmaku': {
          const text = String(msg.text ?? '').trim()
          if (!text) return res.end(JSON.stringify({ ok: false, error: 'empty' }))
          const item: DanmakuItem = { id: ++danmakuSeq, text }
          opts.onDanmaku(item) // -> 副屏
          broadcast({ type: 'danmaku', id: item.id, text: item.text }) // -> 各手机页面即时回显
          res.end(JSON.stringify({ ok: true }))
          return
        }
        case 'hello': {
          res.end(JSON.stringify({ ok: true, url: resolveHost().url }))
          return
        }
        default:
          res.writeHead(400).end(JSON.stringify({ ok: false, error: 'unknown op' }))
      }
    } catch (e) {
      res.writeHead(500).end(JSON.stringify({ ok: false, error: String(e) }))
    }
  }

  server = createServer((req, res) => {
    const urlPath = req.url || '/'
    if (urlPath === '/remote') {
      // —— SSE：实时推送状态/弹幕到手机页面 ——
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-accel-buffering': 'no'
      })
      res.write(': connected\n\n')
      clients.add(res)
      if (lastStateJson) res.write(`data: ${lastStateJson}\n\n`)
      req.on('close', () => clients.delete(res))
      return
    }
    if (urlPath === '/api/command' && req.method === 'POST') {
      let buf = ''
      req.on('data', (c) => (buf += c))
      req.on('end', () => {
        let json: unknown = {}
        try {
          json = buf ? JSON.parse(buf) : {}
        } catch {
          /* 忽略非法 JSON */
        }
        handleCommand(json, res)
      })
      return
    }
    serveStatic(urlPath, res)
  })

  const port = parseInt(process.env.MARS_REMOTE_PORT ?? String(PORT), 10) || PORT
  server.listen(port, '0.0.0.0', () => {
    const { url, port: p } = resolveHost()
    remoteUrl = url
    // 异步预生成二维码并缓存，getInfo 时已就绪
    QRCode.toDataURL(url, { width: 280, margin: 1 })
      .then((d) => {
        qrDataUrl = d
        infoCached = { url, port: p, qrDataUrl: d }
      })
      .catch(() => {})
    // eslint-disable-next-line no-console
    console.log(`[remote] 手机遥控服务已启动：${url}`)
  })

  return {
    setState(state) {
      const json = JSON.stringify({ type: 'state', state })
      if (json === lastStateJson) return
      lastStateJson = json
      broadcast(JSON.parse(json))
    },
    getInfo() {
      if (infoCached) return infoCached
      return {
        url: remoteUrl || resolveHost().url,
        port: resolveHost().port,
        qrDataUrl
      }
    }
  }
}