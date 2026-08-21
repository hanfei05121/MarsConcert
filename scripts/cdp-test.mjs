// CDP 驱动测试 v2：等播放窗就绪后再切模式，确认伴奏是否出声
const CDP_BASE = 'http://127.0.0.1:9222'

async function getTargets() {
  const res = await fetch(`${CDP_BASE}/json`)
  return res.json()
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.seq = 0
    this.pending = new Map()
  }
  async open() {
    await new Promise((res, rej) => {
      this.ws.onopen = res
      this.ws.onerror = rej
    })
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    }
  }
  send(method, params = {}) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (r.exceptionDetails) throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  close() {
    try { this.ws.close() } catch {}
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function findTarget(kind) {
  for (let i = 0; i < 30; i++) {
    const targets = await getTargets()
    const t = kind === 'player'
      ? targets.find((x) => x.url.includes('player.html'))
      : targets.find((x) => x.url.includes('index.html'))
    if (t) return t
    await sleep(400)
  }
  throw new Error(`target ${kind} not found`)
}

/** 轮询直到播放窗出现 <video> 且 topbar 徽标等于期望文本 */
async function waitPlayerReady(cdp, expectMode) {
  for (let i = 0; i < 40; i++) {
    const s = await cdp.eval(`(() => {
      const v = document.querySelector('video');
      const m = document.querySelector('.mode');
      return { hasVideo: !!v, badge: m ? m.textContent : null };
    })()`)
    if (s.hasVideo && s.badge === expectMode) return s
    await sleep(300)
  }
  throw new Error('player not ready, expect ' + expectMode)
}

async function snapshot(cdp, label) {
  const s = await cdp.eval(`(() => {
    const a = document.querySelector('audio');
    const v = document.querySelector('video');
    const badge = document.querySelector('.audio-warn');
    return {
      audioSrc: a ? (a.currentSrc || a.src) : null,
      audioPaused: a ? a.paused : null,
      audioVolume: a ? a.volume : null,
      audioReadyState: a ? a.readyState : null,
      audioError: a && a.error ? a.error.code : null,
      audioTime: a ? a.currentTime.toFixed(2) : null,
      videoPaused: v ? v.paused : null,
      videoTime: v ? v.currentTime.toFixed(2) : null,
      videoError: v && v.error ? v.error.code : null,
      videoDuration: v ? Math.round(v.duration) : null,
      badge: badge ? badge.textContent : null,
      modeBadge: document.querySelector('.mode') ? document.querySelector('.mode').textContent : null
    };
  })()`)
  console.log(`\n===== ${label} =====`)
  console.log(JSON.stringify(s, null, 1))
}

/** 在主窗发指令并等播放窗徽标变为期望文本 */
async function switchModeAndWait(main, player, mode, label) {
  await main.eval(`window.api.setMode('${mode}')`)
  const expect = mode === 'orig' ? '原唱' : '伴奏'
  for (let i = 0; i < 40; i++) {
    const s = await player.eval(`document.querySelector('.mode') ? document.querySelector('.mode').textContent : null`)
    if (s === expect) {
      await sleep(1500)
      await snapshot(player, label)
      return
    }
    await sleep(300)
  }
  throw new Error('mode switch to ' + mode + ' not observed')
}

async function main() {
  const mainTarget = await findTarget('main')
  const main = new CDP(mainTarget.webSocketDebuggerUrl)
  await main.open()

  const playResult = await main.eval(`(async () => {
    const songs = await window.api.getSongs('双音轨');
    if (!songs.length) return 'NO_SONG';
    await window.api.playSong(songs[0]);
    return songs[0].name;
  })()`)
  console.log('played:', playResult)

  const playerTarget = await findTarget('player')
  const player = new CDP(playerTarget.webSocketDebuggerUrl)
  await player.open()

  // 等加载完成（徽标=原唱）
  await waitPlayerReady(player, '原唱')
  await sleep(1200)
  await snapshot(player, '原唱模式（就绪后基线）')

  // 切伴奏：等徽标变「伴奏」再快照
  await switchModeAndWait(main, player, 'accomp', '伴奏模式（切换后）')

  // 切回原唱
  await switchModeAndWait(main, player, 'orig', '原唱模式（切回）')

  main.close()
  player.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
