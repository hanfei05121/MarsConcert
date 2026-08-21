const CDP = 'http://127.0.0.1:9222'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const ts = await (await fetch(CDP + '/json')).json()
  const t = ts.find((x) => x.url.includes('index.html'))
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let seq = 0
  const pend = new Map()
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id) }
  }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value

  const state = await ev(`(() => ({
    appChildren: document.querySelector('#app') ? document.querySelector('#app').children.length : null,
    bodyHead: document.body.innerHTML.slice(0, 400),
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.getAttribute('title') || ('txt:' + b.textContent.trim().slice(0, 6))).slice(0, 15),
    bottombar: !!document.querySelector('.bottombar'),
    topbar: !!document.querySelector('.topbar')
  }))()`)
  console.log(JSON.stringify(state, null, 1))
  process.exit(0)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
