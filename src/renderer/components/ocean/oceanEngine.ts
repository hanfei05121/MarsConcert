/**
 * Open Sea —— 实时海洋 · 夕阳光影引擎（Three.js WebGPU + TSL 节点着色器）
 *
 * 移植自 open-sea-skin / shared/ocean.js（仓库 hanfei05121/dsh-theme-sea，MIT）。
 * 着色器与日光调色板逐段保留原样，只改了三处宿主相关的东西：
 *   1. 去掉皮肤模式（skin=1）的 DOM 查询、loader、postMessage 通信；
 *   2. 把模块里的「全局单例」收敛成 createOceanEngine() 句柄，交给 Vue 生命周期管理；
 *   3. 相机环绕改为内部推导 —— 背景层是 pointer-events:none，OrbitControls 收不到
 *      任何指针事件，留着它只是白背一份依赖；环绕速度与上游 autoRotateSpeed 0.12 等价。
 *
 * 尺寸以「容器」为准而不是 window：主控制台的背景层是铺满 .app 的一层，不是独立页面。
 *
 * 之后要同步上游改动时，对照 shared/ocean.js 的 SECTION 2 / 3 / 4 / 5 / 6 逐段比对即可。
 */

import * as THREE from 'three/webgpu'
import {
  Fn, pass, uniform, float, vec2, vec3, vec4, If,
  sin, cos, dot, cross, normalize, mix, pow, max, clamp, fract, floor,
  smoothstep, distance, reflect,
  positionLocal, positionWorld, cameraPosition
} from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

/** 流畅 / 精细两档。没有「自动」：按设备猜档猜错还得手动再调，不如让人自己选 */
export type OceanQuality = 'low' | 'high'

/* -------------------------------------------------------------------------- */
/* SECTION 1 · 共享 uniform（单实例引擎，模块级持有即可）                       */
/* -------------------------------------------------------------------------- */

const uTime = uniform(0)
const uSea = uniform(0.25 + (45 / 100) * 1.5)
const uSunDir = uniform(new THREE.Vector3(0, 0.5, -0.87))
const uSunColor = uniform(new THREE.Vector3(1, 1, 1))
const uHorizonColor = uniform(new THREE.Vector3(1, 1, 1))
const uZenithColor = uniform(new THREE.Vector3(1, 1, 1))
const uDeepColor = uniform(new THREE.Vector3(1, 1, 1))
const uShallowColor = uniform(new THREE.Vector3(1, 1, 1))

/* -------------------------------------------------------------------------- */
/* SECTION 2 · Gerstner 涌浪（与独立站点版本一致）                              */
/* -------------------------------------------------------------------------- */

const GERSTNER_DEFS = [
  { dir: [1.0, 0.0], wavelength: 60.0, steepness: 0.12 },
  { dir: [0.6, 0.8], wavelength: 31.0, steepness: 0.12 },
  { dir: [-0.7, 0.7], wavelength: 18.0, steepness: 0.09 },
  { dir: [0.3, -0.95], wavelength: 9.5, steepness: 0.07 },
  { dir: [-0.35, -0.94], wavelength: 5.0, steepness: 0.05 }
].map((w) => {
  const len = Math.hypot(w.dir[0], w.dir[1])
  const dx = w.dir[0] / len
  const dy = w.dir[1] / len
  const k = (Math.PI * 2) / w.wavelength
  const c = Math.sqrt(9.8 * k)
  return { dx, dy, k, c, a0: w.steepness / k }
})

const wavePosition = Fn(([xz, time, sea]: [any, any, any]) => {
  let x = xz.x
  let y = float(0)
  let z = xz.y
  for (const w of GERSTNER_DEFS) {
    const dir = vec2(w.dx, w.dy)
    const f = float(w.k).mul(dir.dot(xz).sub(time.mul(float(w.c))))
    const a = float(w.a0).mul(sea)
    x = x.add(a.mul(dir.x).mul(cos(f)))
    y = y.add(a.mul(sin(f)))
    z = z.add(a.mul(dir.y).mul(cos(f)))
  }
  return vec3(x, y, z)
})

const waveNormal = Fn(([xz, time, sea]: [any, any, any]) => {
  let tx = float(1)
  let ty = float(0)
  let tz = float(0)
  let bx = float(0)
  let by = float(0)
  let bz = float(1)
  for (const w of GERSTNER_DEFS) {
    const dir = vec2(w.dx, w.dy)
    const f = float(w.k).mul(dir.dot(xz).sub(time.mul(float(w.c))))
    const a = float(w.a0).mul(sea)
    const s = sin(f)
    const co = cos(f)
    const ak = a.mul(float(w.k))
    const aks = ak.mul(s)
    const akc = ak.mul(co)
    tx = tx.sub(aks.mul(dir.x).mul(dir.x))
    ty = ty.add(akc.mul(dir.x))
    tz = tz.sub(aks.mul(dir.x).mul(dir.y))
    bx = bx.sub(aks.mul(dir.x).mul(dir.y))
    by = by.add(akc.mul(dir.y))
    bz = bz.sub(aks.mul(dir.y).mul(dir.y))
  }
  return normalize(cross(vec3(bx, by, bz), vec3(tx, ty, tz)))
})

const waveCrest = Fn(([xz, time, sea]: [any, any, any]) => {
  let crest = float(0)
  for (const w of GERSTNER_DEFS) {
    const f = float(w.k).mul(vec2(w.dx, w.dy).dot(xz).sub(time.mul(float(w.c))))
    crest = crest.add(float(w.a0).mul(sea).mul(sin(f)))
  }
  return crest
})

/* -------------------------------------------------------------------------- */
/* SECTION 3 · 程序化梯度噪声 + FBM                                            */
/* -------------------------------------------------------------------------- */

const hash2 = Fn(([p]: [any]) => {
  // 把 sin 的输入压在小范围内：点积过大会让远场在部分集显上出现条带。
  const q = p.sub(floor(p.div(289)).mul(289))
  const a = sin(q.dot(vec2(127.1, 311.7))).mul(43758.5453)
  const b = sin(q.dot(vec2(269.5, 183.3))).mul(43758.5453)
  return vec2(fract(a).mul(2).sub(1), fract(b).mul(2).sub(1))
})

const gradNoise = Fn(([p]: [any]) => {
  const i = floor(p)
  const f = fract(p)
  const u = f.mul(f).mul(f.mul(f.mul(6).sub(15)).add(10))
  const g00 = hash2(i)
  const g10 = hash2(i.add(vec2(1, 0)))
  const g01 = hash2(i.add(vec2(0, 1)))
  const g11 = hash2(i.add(vec2(1, 1)))
  const n00 = g00.dot(f)
  const n10 = g10.dot(f.sub(vec2(1, 0)))
  const n01 = g01.dot(f.sub(vec2(0, 1)))
  const n11 = g11.dot(f.sub(vec2(1, 1)))
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y)
})

const fbm = Fn(([p]: [any]) => {
  const o1 = gradNoise(p)
  const o2 = gradNoise(p.mul(2.04).add(vec2(17.3, 9.1))).mul(0.5)
  const o3 = gradNoise(p.mul(4.11).add(vec2(42.7, 28.6))).mul(0.25)
  return o1.add(o2).add(o3)
})

const detailHeight = Fn(([xz, time]: [any, any]) => {
  const driftA = vec2(time.mul(0.55), time.mul(0.32))
  const driftB = vec2(time.mul(-0.4), time.mul(0.5))
  return fbm(xz.mul(0.85).add(driftA)).add(fbm(xz.mul(2.1).add(driftB)).mul(0.45))
})

/* -------------------------------------------------------------------------- */
/* SECTION 4 · 共享解析天空                                                     */
/* cloudMask 用来门控云层 FBM：天穹恒为 1，海面只在反射真正可见处才付这份噪声。 */
/* -------------------------------------------------------------------------- */

const skyColor = Fn(([dir, cloudMask]: [any, any]) => {
  const d = normalize(dir)
  const up = clamp(d.y, -0.15, 1)
  const col = mix(uHorizonColor, uZenithColor, pow(max(up, 0), 0.42)).toVar()

  // 地平线以下压暗。注意 WGSL 的 smoothstep 要求 low < high，反序（GLSL 才容忍）
  // 会让整条片元着色器编译失败、海面全黑 —— 等价写法是 1 - smoothstep(-0.15, 0, y)。
  col.assign(
    mix(
      col,
      uDeepColor.mul(1.4).add(uHorizonColor.mul(0.25)),
      float(1).sub(smoothstep(-0.15, 0, d.y))
    )
  )

  const s = max(dot(d, uSunDir), 0)
  col.addAssign(uSunColor.mul(pow(s, 10)).mul(0.18))
  col.addAssign(uSunColor.mul(smoothstep(0.9994, 0.9998, s)).mul(30))

  // 云只出现在低空带：多数天空像素能省掉一次 FBM。
  // 同样避开 smoothstep 反序：smoothstep(0.6, 0.22, y) 写成 1 - smoothstep(0.22, 0.6, y)。
  const band = smoothstep(0.03, 0.16, d.y).mul(float(1).sub(smoothstep(0.22, 0.6, d.y)))
  If(band.mul(cloudMask).greaterThan(0.001), () => {
    const proj = d.xz.div(d.y.add(0.18)).mul(0.55)
    const cloudNoise = clamp(
      fbm(proj.add(vec2(uTime.mul(0.006), uTime.mul(0.003)))).mul(0.5).add(0.5),
      0,
      1
    )
    const cover = band.mul(smoothstep(0.62, 0.95, cloudNoise))
    const cloudColor = mix(vec3(0.92, 0.9, 0.87), uSunColor.mul(0.5), 0.45)
    col.assign(mix(col, cloudColor, cover.mul(0.6)))
  })

  return col
})

/* -------------------------------------------------------------------------- */
/* SECTION 5 · 海面材质                                                         */
/* 省算力：FBM 细节法线、sparkle、浪花泡沫（4 次 FBM = 12 次梯度噪声）只在距相机 */
/* 140 单位内跑 —— 再远地平线雾霭本来也会把它们糊掉。涌浪着色始终是解析的。      */
/* -------------------------------------------------------------------------- */

const DETAIL_RADIUS = 140

const oceanColor = Fn(() => {
  const P = positionWorld
  const xz = P.xz
  const time = uTime
  const sea = uSea
  const dist = distance(P, cameraPosition)

  const N0 = waveNormal(xz, time, sea)
  const N = N0.toVar()
  const crest = waveCrest(xz, time, sea)
  const V = normalize(cameraPosition.sub(P))

  const spec = vec3(0).toVar()
  const foam = float(0).toVar()

  If(dist.lessThan(DETAIL_RADIUS), () => {
    // 有限差分 FBM 细节法线（毛细碎浪）
    const e = float(0.1)
    const h0 = detailHeight(xz, time)
    const hx = detailHeight(xz.add(vec2(e, 0)), time)
    const hz = detailHeight(xz.add(vec2(0, e)), time)
    const detailScale = float(1.5).mul(sea.mul(0.6).add(0.4))
    N.assign(normalize(N.add(vec3(h0.sub(hx), 0, h0.sub(hz)).mul(detailScale))))

    // 太阳高光：噪声调制的细碎闪光 + 大面积光泽
    const H = normalize(uSunDir.add(V))
    const ndh = max(dot(N, H), 0)
    const sparkleNoise = clamp(
      fbm(xz.mul(0.3).add(vec2(time.mul(-0.07), time.mul(0.05)))).mul(0.5).add(0.5),
      0,
      1
    )
    spec.assign(
      uSunColor.mul(pow(ndh, 500).mul(mix(0.4, 3.4, sparkleNoise)).add(pow(ndh, 48).mul(0.12)))
    )

    // 浪尖泡沫
    const foamNoise = clamp(
      fbm(xz.mul(1.1).add(vec2(time.mul(0.22), time.mul(0.14)))).mul(0.5).add(0.5),
      0,
      1
    )
    foam.assign(smoothstep(0.5, 0.95, foamNoise).mul(smoothstep(1.0, 2.0, crest)).mul(0.85))
  })

  // 水体基色 + 逆光浪尖透光
  const col = mix(uDeepColor, uShallowColor, clamp(crest.mul(0.35).add(0.45), 0, 1)).toVar()
  const sss = pow(max(dot(V, uSunDir), 0), 3).mul(max(crest, 0)).mul(0.18)
  col.addAssign(uShallowColor.mul(uSunColor).mul(sss))

  // 天空反射（只在反射真正起作用处才算云 FBM）
  const R = reflect(V.negate(), N).toVar()
  R.y.assign(max(R.y, 0.04))
  const fresnel = float(0.02).add(
    float(0.98).mul(pow(float(1).sub(max(dot(N, V), 0)), 5))
  )
  col.assign(mix(col, skyColor(R.normalize(), fresnel.greaterThan(0.25)), fresnel))

  col.addAssign(spec)
  col.assign(mix(col, vec3(0.82, 0.88, 0.9), foam))

  const horizonFade = smoothstep(150, 290, dist)
  col.assign(mix(col, uHorizonColor, horizonFade))

  return vec4(col, 1)
})

/* -------------------------------------------------------------------------- */
/* SECTION 6 · 日光（CPU 侧双调色板插值）                                       */
/* -------------------------------------------------------------------------- */

const DAY = {
  zenith: [0.07, 0.2, 0.42],
  horizon: [0.52, 0.68, 0.82],
  sun: [1.0, 0.93, 0.8],
  deep: [0.015, 0.09, 0.11],
  shallow: [0.06, 0.32, 0.36]
}

const DUSK = {
  zenith: [0.03, 0.05, 0.16],
  horizon: [0.85, 0.36, 0.16],
  sun: [1.0, 0.42, 0.14],
  deep: [0.02, 0.045, 0.075],
  shallow: [0.09, 0.15, 0.2]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep01 = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** three 不带类型声明，这里只把真正用到的那一个方法描述出来，免得写成 any 满天飞 */
type Vec3Like = { set(x: number, y: number, z: number): void }

const mixRGB = (target: Vec3Like, dusk: number[], day: number[], t: number) => {
  target.set(lerp(dusk[0], day[0], t), lerp(dusk[1], day[1], t), lerp(dusk[2], day[2], t))
}

/** 当前日光刻度（0~100），供 UI 显示 */
let currentDaylight = 55

function applyTimeOfDay(t: number) {
  currentDaylight = Math.min(100, Math.max(0, t * 100))
  const elevation = lerp(-0.05, 0.62, t)
  const azimuth = lerp(-0.9, 0.9, t)
  const ce = Math.cos(elevation)
  const se = Math.sin(elevation)
  const sa = Math.sin(azimuth)
  const ca = Math.cos(azimuth)
  uSunDir.value.set(ce * sa, se, -ce * ca)

  const daylight = smoothstep01(0, 0.42, elevation)

  mixRGB(uZenithColor.value, DUSK.zenith, DAY.zenith, daylight)
  mixRGB(uHorizonColor.value, DUSK.horizon, DAY.horizon, daylight)
  mixRGB(uDeepColor.value, DUSK.deep, DAY.deep, daylight)
  mixRGB(uShallowColor.value, DUSK.shallow, DAY.shallow, daylight)

  const intensity = lerp(2.6, 1.6, daylight)
  uSunColor.value.set(
    lerp(DUSK.sun[0], DAY.sun[0], daylight) * intensity,
    lerp(DUSK.sun[1], DAY.sun[1], daylight) * intensity,
    lerp(DUSK.sun[2], DAY.sun[2], daylight) * intensity
  )
}

/* -------------------------------------------------------------------------- */
/* SECTION 7 · 引擎句柄                                                         */
/* -------------------------------------------------------------------------- */

export interface OceanEngineOptions {
  /** 渲染容器：引擎按它的 clientWidth / clientHeight 出图 */
  container: HTMLElement
  quality?: OceanQuality
  /** 波浪大小 0~100 */
  sea?: number
  /** 日光 0~100（0 = 黄昏金红，100 = 正午） */
  daylight?: number
  /** 自动昼夜循环：每 12 分钟走完一天 */
  autoCycle?: boolean
  /** 首帧出图后回调（用于淡入） */
  onFirstFrame?: () => void
  /** 自动循环运行时回传当前日光刻度，供 UI 展示 */
  onDaylightChange?: (daylight: number) => void
  /**
   * 渲染循环内部抛错时的回调（TSL 编译失败、上下文丢失等都走这里）。
   * 没有它的话错误会被 requestAnimationFrame 吞掉，界面只剩一片黑。
   */
  onError?: (error: unknown) => void
}

export interface OceanEngine {
  setSea(value: number): void
  setDaylight(value: number): void
  setAutoCycle(on: boolean): void
  /** 手动设过日光之后是否还挂着自动循环 —— 组件用它回写开关状态 */
  readonly autoCycle: boolean
  dispose(): void
}

/**
 * 在容器里起一座海。WebGPU 不可用时 three 会自动回退 WebGL2 后端（上游 2026-08-23
 * 冒烟测试确认可用），两个后端都挂了才 reject，由调用方兜底。
 */
export async function createOceanEngine(options: OceanEngineOptions): Promise<OceanEngine> {
  const { container } = options
  const quality = options.quality ?? 'high'
  // 「减弱动态效果」是系统级无障碍偏好，跟画质档位是两回事，仍然要尊重
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const lowEnd = quality === 'low'

  let pixelRatioCap = reduced ? 0.9 : lowEnd ? 1.0 : 1.5
  let basePixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCap)
  let frameRateCap = reduced ? 20 : lowEnd ? 30 : 60
  let frameMs = 1000 / frameRateCap
  const targetFps = reduced ? 18 : lowEnd ? 28 : 40
  const MIN_SCALE = 0.5
  let renderScale = 1

  const renderer = new THREE.WebGPURenderer({
    antialias: false, // PostProcessing 下 MSAA 本就不生效，关掉是纯省算力
    powerPreference: 'low-power'
  })
  renderer.setPixelRatio(basePixelRatio)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05070a)

  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 8000)

  // —— 海面 ——
  // 256×256 段（约 6.6 万顶点）：面积极大，但细节本来就在 FBM 法线里，够用且省显存。
  const oceanSegments = lowEnd || reduced ? 160 : 256
  const oceanGeometry = new THREE.PlaneGeometry(420, 420, oceanSegments, oceanSegments)
  oceanGeometry.rotateX(-Math.PI / 2)

  const oceanMaterial = new THREE.MeshBasicNodeMaterial()
  oceanMaterial.positionNode = wavePosition(positionLocal.xz, uTime, uSea)
  oceanMaterial.colorNode = oceanColor()

  const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial)
  ocean.frustumCulled = false
  scene.add(ocean)

  // —— 天穹 ——
  const skyMaterial = new THREE.MeshBasicNodeMaterial()
  skyMaterial.colorNode = skyColor(normalize(positionWorld), float(1))
  skyMaterial.side = THREE.BackSide
  skyMaterial.depthWrite = false

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4000, lowEnd ? 32 : 48, lowEnd ? 16 : 24),
    skyMaterial
  )
  sky.renderOrder = -1
  sky.frustumCulled = false
  scene.add(sky)

  // —— 后处理：场景 pass + TSL bloom（夕阳的辉光靠它）——
  const postProcessing = new THREE.PostProcessing(renderer)
  const scenePass = pass(scene, camera)
  const sceneColor = scenePass.getTextureNode('output')
  const bloomStrength = lowEnd ? 0.18 : 0.28
  postProcessing.outputNode = sceneColor.add(bloom(sceneColor, bloomStrength, 0.3, 0.9))

  /* —— 相机环绕 ——
     上游用 OrbitControls.autoRotate（skin 档 speed 0.12），换算成手动推导就是
     半径 17 / 高度 5.5 绕 (0, 1.5, 0) 以约 0.0125 rad/s 转一圈 ≈ 500 秒。 */
  const ORBIT_RADIUS = 17
  const ORBIT_SPEED = 0.0125
  function positionCamera(t: number) {
    const a = t * ORBIT_SPEED
    camera.position.set(Math.sin(a) * ORBIT_RADIUS, 5.5, Math.cos(a) * ORBIT_RADIUS)
    camera.lookAt(0, 1.5, 0)
  }
  positionCamera(0)

  function applyResolutionScale(scale: number) {
    renderer.setPixelRatio(basePixelRatio * scale)
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1)
  }

  function applySize() {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    applyResolutionScale(renderScale)
  }

  let autoCycle = options.autoCycle ?? false
  let manualDaylight = (options.daylight ?? 55) / 100
  applyTimeOfDay(autoCycle ? 0.5 + 0.5 * Math.sin(0) : manualDaylight)

  let disposed = false
  /** 是否走「场景 → bloom → 输出」的后处理链；WebGL2 回退时会关掉（见下方 init 之后） */
  let usePost = true
  /** 渲染循环因报错被主动停掉（只报一次错，不重复刷屏） */
  let halted = false
  let loopStarted = false
  let firstFrameShown = false
  let lastFrameTime = performance.now()
  let lastRenderAt = 0
  let fpsFrames = 0
  let fpsWindow = 0
  let adaptWindow = 0
  let fpsNow = 0
  let fpsStamp = performance.now()
  let adaptStamp = performance.now()
  let cycleWindow = 0

  /** 渲染出错：停掉循环并把错误交给调用方（只报一次） */
  function halt(err: unknown) {
    if (halted) return
    halted = true
    loopStarted = false
    renderer.setAnimationLoop(null)
    clearTimeout(firstFrameTimer)
    console.error('[OceanSunset] 渲染循环已停止：', err)
    options.onError?.(err)
  }

  function animate(now: number) {
    if (disposed || halted) return
    // 高精度时间戳 → delta，钳住避免卡顿造成跳变
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1)
    lastFrameTime = now

    uTime.value += dt * (reduced ? 0.12 : 1)
    positionCamera(uTime.value)

    // 帧率上限：显示器刷新高于 60Hz 时跳过不必要的工作
    if (now - lastRenderAt < frameMs - 0.5) return
    lastRenderAt = now

    try {
      if (usePost) postProcessing.render()
      else renderer.render(scene, camera)
    } catch (err) {
      if (usePost) {
        // 后处理链（TSL bloom）在个别后端上跑不起来：退一步只渲染场景本体，
        // 少一层辉光但海面还在，总好过一片黑。
        usePost = false
        console.warn('[OceanSunset] 后处理不可用，退回直接渲染：', err)
        return
      }
      // 连直接渲染都失败：停循环并把错误交出去，不然会每帧重复抛、控制台刷屏
      halt(err)
      return
    }

    // 滚动 FPS + 自适应分辨率（每 2 秒复查一次）
    fpsFrames += 1
    fpsWindow += (now - fpsStamp) / 1000
    fpsStamp = now
    adaptWindow += (now - adaptStamp) / 1000
    adaptStamp = now
    if (fpsWindow >= 0.5) {
      fpsNow = fpsFrames / fpsWindow
      fpsFrames = 0
      fpsWindow = 0
    }
    if (adaptWindow >= 2) {
      adaptWindow = 0
      if (fpsNow > 0) {
        if (fpsNow < targetFps - 8 && renderScale > MIN_SCALE) {
          renderScale = Math.max(MIN_SCALE, +(renderScale * 0.92).toFixed(3))
          applyResolutionScale(renderScale)
        } else if (fpsNow > targetFps + 8 && renderScale < 1) {
          renderScale = Math.min(1, +(renderScale * 1.06).toFixed(3))
          applyResolutionScale(renderScale)
        }
      }
    }

    // 自动昼夜循环：每 12 分钟走完一天（用户一拖日光滑块就会被关掉）
    if (autoCycle) {
      cycleWindow += dt
      if (cycleWindow >= 0.25) {
        cycleWindow = 0
        applyTimeOfDay(0.5 + 0.5 * Math.sin((uTime.value / 720) * Math.PI * 2))
        options.onDaylightChange?.(currentDaylight)
      }
    }

    if (!firstFrameShown) {
      firstFrameShown = true
      clearTimeout(firstFrameTimer)
      options.onFirstFrame?.()
    }
  }

  const onVisibility = () => {
    if (!loopStarted) return
    if (document.hidden) {
      renderer.setAnimationLoop(null)
    } else {
      lastFrameTime = performance.now()
      lastRenderAt = 0
      renderer.setAnimationLoop(animate)
    }
  }

  const resizeObserver = new ResizeObserver(() => applySize())
  resizeObserver.observe(container)
  document.addEventListener('visibilitychange', onVisibility)

  // 首帧保险：WebGPU 的着色器编译失败是「静默」的 —— 管线无效不会抛 JS 异常，
  // 渲染循环照跑、画面全黑，try/catch 也抓不到。超过 8 秒还见不到首帧就主动报出来，
  // 免得只剩控制台刷屏、界面一片黑还找不到入口。
  const firstFrameTimer = window.setTimeout(() => {
    if (firstFrameShown || halted || disposed) return
    options.onError?.(
      new Error('渲染未启动：着色器可能没编译通过（详见控制台里的 WebGPU / WGSL 报错）')
    )
  }, 8000)

  await renderer.init()

  if (renderer.backend.isWebGPUBackend !== true) {
    // WebGPU 不可用 → three 回退 WebGL2：降一档画质，保证主界面流畅优先。
    // 后处理链（TSL bloom）在 WebGL2 上不稳（上游也踩过黑底白字的坑），直接关掉，
    // 换来「一定出画面」—— 少一层辉光，海面本身照旧。
    usePost = false
    pixelRatioCap = 1.0
    basePixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCap)
    frameRateCap = 30
    frameMs = 1000 / frameRateCap
    renderScale = 0.6
  }

  applySize()
  lastFrameTime = performance.now()
  loopStarted = true
  renderer.setAnimationLoop(animate)

  return {
    setSea(value: number) {
      const v = Math.min(100, Math.max(0, value))
      uSea.value = 0.25 + (v / 100) * 1.5
    },
    setDaylight(value: number) {
      manualDaylight = Math.min(100, Math.max(0, value)) / 100
      if (!autoCycle) applyTimeOfDay(manualDaylight)
    },
    setAutoCycle(on: boolean) {
      autoCycle = on
      if (!on) applyTimeOfDay(manualDaylight)
      else cycleWindow = 1 // 立刻推一次，别让海面等 0.25 秒才动
    },
    get autoCycle() {
      return autoCycle
    },
    dispose() {
      disposed = true
      loopStarted = false
      clearTimeout(firstFrameTimer)
      renderer.setAnimationLoop(null)
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      try {
        renderer.dispose()
      } catch {
        /* 上下文已丢失时 dispose 可能抛错，忽略即可 */
      }
      renderer.domElement.remove()
    }
  }
}
