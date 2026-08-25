<script setup lang="ts">
// 副屏待机页 · 火星演唱会主题动态背景（Canvas · 银河系版）
// 视觉概念：置身银河内部 ——
//   1. 深空底色 + 银心暖光
//   2. 银河星带：斜贯全屏的高密度星尘带 + 彩色星云 + 尘埃暗带（叠加混合出云雾感）
//   3. 三层视差闪烁星场（带内更密集）
//   4. 火星行星：大气辉光 + 流动条带 + 环形山 + 晨昏线 + 边缘轮廓光
//   5. 星环特效：火星周围多层倾斜椭圆星环（半透明光环带 + 沿环流动的发光星点）
//   6. 脉冲扩散光环：以火星为中心周期性向外扩散的淡光环（节奏呼吸感）
//   7. 华丽流星（渐变拖尾 + 发光头部）+ 上升余烬火星 + 暗角聚焦
// 全程纯本地 Canvas 绘制，无外部资源，跟随窗口大小自适应。

import { onMounted, onBeforeUnmount, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let W = 0
let H = 0
let time = 0

interface Star {
  x: number
  y: number
  r: number
  base: number
  phase: number
  speed: number
  layer: number // 0 远 1 中 2 近
  color: string
}
interface Ember {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  alpha: number
  phase: number
  life: number
  maxLife: number
  hue: string
}
interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  len: number
}
/** 星环上的发光星点 */
interface RingStar {
  angle: number
  speed: number
  size: number
  alpha: number
  twinkle: number
}

let stars: Star[] = []
let embers: Ember[] = []
let meteors: Meteor[] = []
let ringStars: RingStar[] = []
let emberTarget = 30

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

const STAR_COLORS = ['#ffffff', '#fff3e0', '#ffd9b0', '#ffb27a', '#ff8f6b', '#cfe0ff', '#ffe9c4']

/** 银河星带的中心线（斜贯屏幕）与半厚度 */
function bandConfig() {
  return {
    // 从左下到右上的斜线
    x1: -W * 0.1,
    y1: H * 0.85,
    x2: W * 1.1,
    y2: H * 0.18,
    /** 带的半厚度（像素） */
    thick: Math.min(W, H) * 0.16
  }
}

function init() {
  stars = []
  // 带外星场：三层视差
  const far = Math.floor((W * H) / 9000)
  const mid = Math.floor((W * H) / 26000)
  const near = Math.floor((W * H) / 70000)
  const addLayer = (count: number, layer: number, rMin: number, rMax: number, baseMin: number, baseMax: number) => {
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(rMin, rMax),
        base: rand(baseMin, baseMax),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.6, 2.2),
        layer,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
      })
    }
  }
  addLayer(far, 0, 0.35, 0.9, 0.2, 0.55)
  addLayer(mid, 1, 0.8, 1.5, 0.35, 0.8)
  addLayer(near, 2, 1.4, 2.4, 0.5, 1)

  // 银河带内密集星尘：距中心线越近越密
  const b = bandConfig()
  const bandCount = Math.floor((W * H) / 1400)
  for (let i = 0; i < bandCount; i++) {
    // 沿带长随机取点，厚度按高斯近似（中间密两头疏）
    const t = Math.random()
    const cx = b.x1 + (b.x2 - b.x1) * t
    const cy = b.y1 + (b.y2 - b.y1) * t
    let off = 0
    for (let k = 0; k < 3; k++) off += rand(-1, 1)
    off = (off / 3) * b.thick
    const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1) + Math.PI / 2
    const x = cx + Math.cos(ang) * off
    const y = cy + Math.sin(ang) * off
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue
    stars.push({
      x,
      y,
      r: rand(0.3, 1.3),
      base: rand(0.15, 0.8) * (1 - Math.min(1, Math.abs(off) / b.thick) * 0.55),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.8, 2.5),
      layer: 0,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
    })
  }

  // 余烬火星
  embers = []
  emberTarget = Math.max(22, Math.floor((W * H) / 26000))
  for (let i = 0; i < emberTarget; i++) spawnEmber(true)
  meteors = []

  // 星环星点：分布在最外层环带上，绕行速度略有差异
  ringStars = []
  for (let i = 0; i < 90; i++) {
    ringStars.push({
      angle: rand(0, Math.PI * 2),
      speed: rand(0.0012, 0.0028) * (Math.random() < 0.15 ? -1 : 1),
      size: rand(0.8, 2.2),
      alpha: rand(0.4, 1),
      twinkle: rand(0, Math.PI * 2)
    })
  }
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = canvas.clientWidth || window.innerWidth
  H = canvas.clientHeight || window.innerHeight
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  init()
}

function spawnEmber(anywhere = false) {
  embers.push({
    x: Math.random() * W,
    y: anywhere ? Math.random() * H : H + 14,
    r: rand(0.9, 3),
    vx: rand(-0.3, 0.3),
    vy: rand(-0.65, -0.15),
    alpha: rand(0.25, 0.95),
    phase: rand(0, Math.PI * 2),
    life: 0,
    maxLife: rand(240, 560),
    hue: Math.random() < 0.55 ? '255,110,50' : Math.random() < 0.5 ? '255,170,90' : '255,70,40'
  })
}

function spawnMeteor() {
  meteors.push({
    x: rand(W * 0.1, W * 0.92),
    y: rand(0, H * 0.3),
    vx: rand(7, 13),
    vy: rand(3, 5.5),
    life: 0,
    maxLife: rand(60, 110),
    len: rand(110, 200)
  })
}

// —— 1. 深空底色：纵向渐变 + 银心暖光 ——
function drawBackground() {
  const bg = ctx!.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#05030a')
  bg.addColorStop(0.5, '#0a0510')
  bg.addColorStop(1, '#140a08')
  ctx!.fillStyle = bg
  ctx!.fillRect(0, 0, W, H)

  // 银心方向（右上）一团暖光
  const core = ctx!.createRadialGradient(W * 0.8, H * 0.25, 0, W * 0.8, H * 0.25, Math.max(W, H) * 0.55)
  core.addColorStop(0, 'rgba(255,140,90,0.13)')
  core.addColorStop(0.5, 'rgba(150,60,80,0.07)')
  core.addColorStop(1, 'rgba(0,0,0,0)')
  ctx!.fillStyle = core
  ctx!.fillRect(0, 0, W, H)
}

/** 沿银河带方向旋转画布并绘制（便于用水平矩形/渐变画带状物） */
function withBandTransform(fn: () => void) {
  const b = bandConfig()
  const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1)
  ctx!.save()
  ctx!.translate(W / 2, H / 2)
  ctx!.rotate(ang)
  ctx!.translate(-W / 2, -H / 2)
  fn()
  ctx!.restore()
}

// —— 2. 银河星带：云雾光带 + 尘埃暗带 ——
function drawGalaxyBand() {
  ctx!.globalCompositeOperation = 'lighter'
  withBandTransform(() => {
    const cy = H / 2
    const bw = Math.hypot(W, H) * 1.2
    const th = Math.min(W, H) * 0.16

    // 云雾亮带（多段彩色渐变叠加，模拟银河辉光）
    const clouds: Array<{ x: number; w: number; c: string }> = [
      { x: 0.1, w: 0.5, c: 'rgba(180,120,160,0.10)' },
      { x: 0.35, w: 0.35, c: 'rgba(255,170,110,0.12)' },
      { x: 0.6, w: 0.45, c: 'rgba(120,110,200,0.09)' },
      { x: 0.85, w: 0.4, c: 'rgba(255,120,70,0.10)' }
    ]
    for (const c of clouds) {
      const g = ctx!.createRadialGradient(bw * c.x, cy, 0, bw * c.x, cy, th * 1.6)
      g.addColorStop(0, c.c)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.fillStyle = g
      // 用超宽矩形铺满整个带高（径向渐变在垂直方向衰减）
      ctx!.fillRect(bw * c.x - th * 1.6, cy - th * 1.6, th * 3.2, th * 3.2)
    }

    // 沿带轴的呼吸流动：一条亮芯线
    const core = ctx!.createLinearGradient(0, cy - th * 0.25, 0, cy + th * 0.25)
    const pulse = 0.05 + 0.025 * Math.sin(time * 0.003)
    core.addColorStop(0, 'rgba(255,220,180,0)')
    core.addColorStop(0.5, `rgba(255,220,180,${pulse})`)
    core.addColorStop(1, 'rgba(255,220,180,0)')
    ctx!.fillStyle = core
    ctx!.fillRect(0, cy - th * 0.25, bw, th * 0.5)
  })
  ctx!.globalCompositeOperation = 'source-over'

  // 尘埃暗带：银河中的暗裂（普通混合压暗），沿带方向错落的暗斑
  withBandTransform(() => {
    const cy = H / 2
    const bw = Math.hypot(W, H) * 1.2
    const th = Math.min(W, H) * 0.16
    ctx!.globalAlpha = 0.35
    for (let i = 0; i < 6; i++) {
      const x = bw * (0.06 + i * 0.17)
      const y = cy + Math.sin(i * 2.7) * th * 0.3
      const r = th * rand(0.35, 0.6)
      const g = ctx!.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(8,4,10,0.9)')
      g.addColorStop(1, 'rgba(8,4,10,0)')
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(x, y, r, 0, Math.PI * 2)
      ctx!.fill()
    }
    ctx!.globalAlpha = 1
  })
}

// —— 3. 三层视差星场：闪烁 + 大星十字光芒（叠加混合发光） ——
function drawStars() {
  ctx!.globalCompositeOperation = 'lighter'
  const drift = time * 0.008
  for (const s of stars) {
    const parallax = [0.12, 0.35, 1][s.layer]
    const x = (s.x + drift * parallax) % W
    const tw = 0.5 + 0.5 * Math.sin(time * 0.002 * s.speed + s.phase)
    const a = s.base * (0.25 + 0.75 * tw)
    const glow = ctx!.createRadialGradient(x, s.y, 0, x, s.y, s.r * 4)
    glow.addColorStop(0, hexA(s.color, a * 0.9))
    glow.addColorStop(1, hexA(s.color, 0))
    ctx!.fillStyle = glow
    ctx!.beginPath()
    ctx!.arc(x, s.y, s.r * 4, 0, Math.PI * 2)
    ctx!.fill()
    ctx!.fillStyle = hexA(s.color, a)
    ctx!.beginPath()
    ctx!.arc(x, s.y, s.r, 0, Math.PI * 2)
    ctx!.fill()
    if (s.layer === 2 && s.r > 1.8) {
      const flare = s.r * (5 + 4 * tw)
      ctx!.strokeStyle = hexA(s.color, a * 0.5)
      ctx!.lineWidth = 0.8
      ctx!.beginPath()
      ctx!.moveTo(x - flare, s.y)
      ctx!.lineTo(x + flare, s.y)
      ctx!.moveTo(x, s.y - flare)
      ctx!.lineTo(x, s.y + flare)
      ctx!.stroke()
    }
  }
  ctx!.globalCompositeOperation = 'source-over'
}

/** #rrggbb + alpha -> rgba() */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** 火星中心与半径（多处绘制复用） */
function marsConfig() {
  return {
    cx: W * 0.72,
    cy: H * 0.76,
    r: Math.min(W, H) * 0.22
  }
}

// —— 4. 火星行星：大气辉光 / 流动条带 / 环形山 / 晨昏线 / 轮廓光 ——
function drawMars() {
  const { cx, cy, r } = marsConfig()

  // 多层大气辉光
  ctx!.globalCompositeOperation = 'lighter'
  for (const [mult, alpha] of [
    [2.4, 0.05],
    [1.8, 0.08],
    [1.35, 0.13]
  ] as Array<[number, number]>) {
    const glow = ctx!.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * mult)
    glow.addColorStop(0, `rgba(255,110,60,${alpha})`)
    glow.addColorStop(1, 'rgba(255,110,60,0)')
    ctx!.fillStyle = glow
    ctx!.beginPath()
    ctx!.arc(cx, cy, r * mult, 0, Math.PI * 2)
    ctx!.fill()
  }
  ctx!.globalCompositeOperation = 'source-over'

  // 球体本体（左上受光）
  const body = ctx!.createRadialGradient(cx - r * 0.38, cy - r * 0.38, r * 0.06, cx, cy, r * 1.05)
  body.addColorStop(0, '#ffd2a0')
  body.addColorStop(0.3, '#ff8f4d')
  body.addColorStop(0.62, '#e35218')
  body.addColorStop(0.88, '#8f2c10')
  body.addColorStop(1, '#571a09')
  ctx!.fillStyle = body
  ctx!.beginPath()
  ctx!.arc(cx, cy, r, 0, Math.PI * 2)
  ctx!.fill()

  // 表面流动条带 + 环形山（裁进球体）
  ctx!.save()
  ctx!.beginPath()
  ctx!.arc(cx, cy, r, 0, Math.PI * 2)
  ctx!.clip()
  ctx!.globalAlpha = 0.15
  ctx!.fillStyle = '#5c1d0a'
  for (let i = -3; i <= 3; i++) {
    const y = cy + i * r * 0.2
    const wob = Math.sin(time * 0.008 + i * 2.4) * r * 0.03
    ctx!.beginPath()
    ctx!.ellipse(cx + wob, y, r * 1.08, r * 0.05, 0, 0, Math.PI * 2)
    ctx!.fill()
  }
  ctx!.globalAlpha = 0.2
  ctx!.fillStyle = '#4a1708'
  const craters: Array<[number, number, number]> = [
    [-0.32, -0.08, 0.12],
    [0.28, 0.18, 0.09],
    [0.06, -0.36, 0.08],
    [-0.14, 0.34, 0.06],
    [0.4, -0.3, 0.05]
  ]
  for (const [dx, dy, rr] of craters) {
    ctx!.beginPath()
    ctx!.arc(cx + dx * r, cy + dy * r, rr * r, 0, Math.PI * 2)
    ctx!.fill()
  }
  // 晨昏线阴影（右下暗侧）
  const shade = ctx!.createRadialGradient(cx + r * 0.55, cy + r * 0.55, r * 0.1, cx, cy, r * 1.1)
  shade.addColorStop(0, 'rgba(20,5,2,0.55)')
  shade.addColorStop(0.6, 'rgba(20,5,2,0.2)')
  shade.addColorStop(1, 'rgba(20,5,2,0)')
  ctx!.globalAlpha = 1
  ctx!.fillStyle = shade
  ctx!.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx!.restore()

  // 左上高光
  const hl = ctx!.createRadialGradient(cx - r * 0.42, cy - r * 0.42, 0, cx - r * 0.42, cy - r * 0.42, r * 0.8)
  hl.addColorStop(0, 'rgba(255,235,205,0.4)')
  hl.addColorStop(1, 'rgba(255,235,205,0)')
  ctx!.fillStyle = hl
  ctx!.beginPath()
  ctx!.arc(cx, cy, r, 0, Math.PI * 2)
  ctx!.fill()

  // 边缘轮廓光
  ctx!.strokeStyle = 'rgba(255,180,120,0.5)'
  ctx!.lineWidth = Math.max(1.2, r * 0.012)
  ctx!.beginPath()
  ctx!.arc(cx, cy, r - ctx!.lineWidth / 2, Math.PI * 0.75, Math.PI * 1.75)
  ctx!.stroke()
}

// —— 5. 星环特效：火星周围多层倾斜椭圆星环 + 沿环流动的发光星点 ——
function drawRings() {
  const { cx, cy, r } = marsConfig()
  const tilt = -0.42 // 倾斜角（弧度）：环面斜过行星
  const rings = [
    { a: r * 1.55, b: r * 0.34, alpha: 0.16, width: 5 }, // 内环
    { a: r * 1.85, b: r * 0.42, alpha: 0.22, width: 7 }, // 中环（最亮）
    { a: r * 2.15, b: r * 0.5, alpha: 0.1, width: 4 } // 外环
  ]

  ctx!.save()
  ctx!.translate(cx, cy)
  ctx!.rotate(tilt)

  ctx!.globalCompositeOperation = 'lighter'
  for (const ring of rings) {
    // 呼吸透明度，让环有生命感
    const breathe = 0.75 + 0.25 * Math.sin(time * 0.002 + ring.a * 0.01)
    ctx!.strokeStyle = `rgba(255,190,130,${ring.alpha * breathe})`
    ctx!.lineWidth = ring.width
    ctx!.beginPath()
    ctx!.ellipse(0, 0, ring.a, ring.b, 0, 0, Math.PI * 2)
    ctx!.stroke()
    // 内侧更亮的一圈细线
    ctx!.strokeStyle = `rgba(255,240,210,${ring.alpha * breathe * 0.7})`
    ctx!.lineWidth = 1.2
    ctx!.beginPath()
    ctx!.ellipse(0, 0, ring.a - ring.width * 0.8, ring.b * 0.98, 0, 0, Math.PI * 2)
    ctx!.stroke()
  }

  // 沿最外环流动的发光星点
  const outer = rings[2]
  for (const rs of ringStars) {
    rs.angle += rs.speed
    const x = Math.cos(rs.angle) * outer.a
    const y = Math.sin(rs.angle) * outer.b
    const tw = 0.5 + 0.5 * Math.sin(time * 0.06 + rs.twinkle)
    const a = rs.alpha * tw
    const g = ctx!.createRadialGradient(x, y, 0, x, y, rs.size * 3)
    g.addColorStop(0, `rgba(255,240,215,${a})`)
    g.addColorStop(1, 'rgba(255,240,215,0)')
    ctx!.fillStyle = g
    ctx!.beginPath()
    ctx!.arc(x, y, rs.size * 3, 0, Math.PI * 2)
    ctx!.fill()
  }
  ctx!.restore()
  ctx!.globalCompositeOperation = 'source-over'
}

// —— 6. 脉冲扩散光环：以火星为中心周期性向外扩散的淡光环 ——
function drawPulseRings() {
  const { cx, cy, r } = marsConfig()
  const period = 240 // 每个脉冲周期（帧）
  const count = 2 // 同时存在的脉冲数（相位错开）
  ctx!.globalCompositeOperation = 'lighter'
  for (let i = 0; i < count; i++) {
    const t = ((time + (period / count) * i) % period) / period // 0~1
    const radius = r * 1.3 + t * r * 2.4
    const alpha = (1 - t) * 0.14
    ctx!.strokeStyle = `rgba(255,150,90,${alpha})`
    ctx!.lineWidth = 2.5 * (1 - t) + 0.5
    ctx!.beginPath()
    ctx!.ellipse(cx, cy, radius, radius * 0.62, -0.42, 0, Math.PI * 2)
    ctx!.stroke()
  }
  ctx!.globalCompositeOperation = 'source-over'
}

// —— 7. 华丽流星：渐变拖尾 + 发光头部 ——
function drawMeteors() {
  ctx!.globalCompositeOperation = 'lighter'
  for (const m of meteors) {
    m.life++
    m.x += m.vx
    m.y += m.vy
    const t = m.life / m.maxLife
    const alpha = Math.sin(Math.PI * Math.min(1, t))
    const ang = Math.atan2(m.vy, m.vx)
    const tx = m.x - Math.cos(ang) * m.len
    const ty = m.y - Math.sin(ang) * m.len
    const grad = ctx!.createLinearGradient(m.x, m.y, tx, ty)
    grad.addColorStop(0, `rgba(255,248,235,${alpha * 0.95})`)
    grad.addColorStop(0.3, `rgba(255,170,90,${alpha * 0.5})`)
    grad.addColorStop(1, 'rgba(255,120,60,0)')
    ctx!.strokeStyle = grad
    ctx!.lineWidth = 2.2
    ctx!.lineCap = 'round'
    ctx!.beginPath()
    ctx!.moveTo(m.x, m.y)
    ctx!.lineTo(tx, ty)
    ctx!.stroke()
    const head = ctx!.createRadialGradient(m.x, m.y, 0, m.x, m.y, 7)
    head.addColorStop(0, `rgba(255,255,245,${alpha})`)
    head.addColorStop(1, 'rgba(255,255,245,0)')
    ctx!.fillStyle = head
    ctx!.beginPath()
    ctx!.arc(m.x, m.y, 7, 0, Math.PI * 2)
    ctx!.fill()
  }
  ctx!.globalCompositeOperation = 'source-over'
  meteors = meteors.filter((m) => m.life < m.maxLife && m.x > -m.len && m.y < H + m.len)
}

// —— 8. 余烬火星：从底部缓缓升起、闪烁发光飘散 ——
function drawEmbers() {
  ctx!.globalCompositeOperation = 'lighter'
  for (const e of embers) {
    e.life++
    e.x += e.vx + Math.sin(time * 0.02 + e.phase) * 0.2
    e.y += e.vy
    const t = e.life / e.maxLife
    const fade = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.55) / 0.45)
    if (fade <= 0) continue
    const a = e.alpha * fade * (0.7 + 0.3 * Math.sin(time * 0.05 + e.phase))
    const g = ctx!.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3.2)
    g.addColorStop(0, `rgba(${e.hue},${a})`)
    g.addColorStop(1, `rgba(${e.hue},0)`)
    ctx!.fillStyle = g
    ctx!.beginPath()
    ctx!.arc(e.x, e.y, e.r * 3.2, 0, Math.PI * 2)
    ctx!.fill()
  }
  ctx!.globalCompositeOperation = 'source-over'
  embers = embers.filter((e) => e.life < e.maxLife)
  while (embers.length < emberTarget) spawnEmber()
}

// —— 暗角：四周压暗，聚焦中央 ——
function drawVignette() {
  const v = ctx!.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx!.fillStyle = v
  ctx!.fillRect(0, 0, W, H)
}

function frame() {
  raf = requestAnimationFrame(frame)
  if (!ctx) return
  time++
  ctx.clearRect(0, 0, W, H)
  drawBackground()
  drawGalaxyBand()
  drawStars()
  drawMars()
  drawRings()
  drawPulseRings()
  drawMeteors()
  drawEmbers()
  drawVignette()
  if (meteors.length < 2 && Math.random() < 0.005) spawnMeteor()
}

function onResize() {
  resize()
}

onMounted(() => {
  resize()
  window.addEventListener('resize', onResize)
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <canvas ref="canvasRef" class="mars-bg" />
</template>

<style scoped>
.mars-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
