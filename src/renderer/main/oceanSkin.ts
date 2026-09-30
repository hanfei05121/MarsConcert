/**
 * 主控制台的背景皮肤状态（海洋 / 丝绸 / 关）。
 *
 * 与 open-sea-skin 的关系：那边皮肤参数存在 Chrome storage / localStorage，再由
 * 宿主脚本注入 CSS 变量；这里是同一个思路，只是换成 Vue 的 reactive —— 组件直接读，
 * 写回 localStorage，落到 documentElement 上的 class 与 --ui-glass 变量。
 *
 * glass（玻璃不透明度）的语义与上游一致：40 = 面板最透（海面最抢戏），
 * 90 = 面板最实（歌词列表最清楚）。上游默认 72，这里沿用，映射成 --ui-glass 乘数。
 */
import { reactive, watch } from 'vue'

/** ocean = 实时海洋 · 夕阳光影；silk = 原来的丝绸；none = 只留火星星云底 */
export type LobbySkin = 'ocean' | 'silk' | 'none'
/** 只有两档：流畅优先 / 精细优先。原来那档「自动」按设备猜，猜错就得手动再调，不如让人直接选 */
export type OceanQuality = 'low' | 'high'

export interface OceanSkinState {
  skin: LobbySkin
  /** 波浪大小 0~100 */
  sea: number
  /** 日光 0~100（0 = 黄昏金红，100 = 正午） */
  daylight: number
  /** 玻璃不透明度 40~90 */
  glass: number
  /** 自动昼夜循环：每 12 分钟走完一天 */
  autoCycle: boolean
  quality: OceanQuality
}

const STORAGE_KEY = 'mars-lobby-skin'
/**
 * 存档格式版本。旧档（没有 v 字段）里日光是「金红时刻 14」，
 * 而这次把默认日光改成了 80 —— 不迁移的话改默认值对已装过的机器等于没改，
 * 打开还是旧的金红黄昏。所以旧档只把日光迁到新默认，其余（皮肤 / 波浪 / 玻璃）照旧。
 */
const STORAGE_VERSION = 1
/** glass 的基准值：乘数 1.0 对应上游默认观感 */
const GLASS_BASE = 72

const DEFAULTS: OceanSkinState = {
  // 默认就上海洋：日光 80（午后偏亮的日照海面），不再是贴地地平线的金红黄昏
  skin: 'ocean',
  sea: 45,
  daylight: 80,
  glass: GLASS_BASE,
  autoCycle: false,
  // 默认精细：本机起得动，就没必要先给一档糊的
  quality: 'high'
}

const SKINS: LobbySkin[] = ['ocean', 'silk', 'none']

function clamp(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function load(): OceanSkinState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const legacy = raw.v !== STORAGE_VERSION // 没有版本号的都是这次改默认值之前的档
    return {
      skin: SKINS.includes(raw.skin) ? raw.skin : DEFAULTS.skin,
      sea: clamp(raw.sea, 0, 100, DEFAULTS.sea),
      // 旧档的日光一律迁到新默认 80；新档尊重用户自己拖过的值
      daylight: legacy ? DEFAULTS.daylight : clamp(raw.daylight, 0, 100, DEFAULTS.daylight),
      glass: clamp(raw.glass, 40, 90, DEFAULTS.glass),
      autoCycle: raw.autoCycle === true,
      // 老数据里存过 'auto'：那档已经取消，落到默认的精细画质
      quality: (['low', 'high'] as OceanQuality[]).includes(raw.quality)
        ? raw.quality
        : DEFAULTS.quality
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export const oceanSkin = reactive<OceanSkinState>(load())

/**
 * 引擎回传的运行时信息（不持久化）。
 * 自动昼夜循环开起来时，日光刻度由引擎自己走，滑块只读显示这个值 ——
 * 不写回 oceanSkin.daylight，免得「引擎 → 状态 → 引擎」来回打架。
 */
export const oceanRuntime = reactive({
  /** 引擎是否已出首帧 */
  ready: false,
  /** 引擎初始化是否失败（无 WebGPU/WebGL 时兜底提示） */
  failed: false,
  /** 失败原因原文：直接显示在弹窗里，省得让人去翻控制台 */
  error: '',
  /** 自动循环时的实时日光刻度 0~100 */
  liveDaylight: 0
})

/**
 * 参数弹窗的开关（不持久化）。
 * 按钮长在侧栏底部「我的资源」旁边（Sidebar.vue），弹窗浮在它正上方（SkinPanel.vue）——
 * 两个组件不同，所以开关状态放这里共享。
 */
export const skinPanel = reactive({ open: false })

/**
 * 把皮肤状态落到 DOM：
 * - `skin-ocean` / `skin-silk` 两个 class 供 style.css 做背景层与星尘的取舍；
 * - `--ui-glass` 乘数驱动主界面全部玻璃面板的通透度（style.css 里乘在各 rgba 上）。
 */
function syncDom() {
  const root = document.documentElement
  // 引擎报错时也摘掉 skin-ocean：星尘与星云底重新接管兜底画面
  const oceanActive = oceanSkin.skin === 'ocean' && !oceanRuntime.failed
  root.classList.toggle('skin-ocean', oceanActive)
  root.classList.toggle('skin-silk', oceanSkin.skin === 'silk')
  root.style.setProperty('--ui-glass', (oceanSkin.glass / GLASS_BASE).toFixed(3))
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...oceanSkin, v: STORAGE_VERSION }))
  } catch {
    /* 隐私模式 / 配额满：设置不持久化也不该中断界面 */
  }
}

watch(oceanSkin, () => {
  syncDom()
  persist()
})

// 引擎起来 / 报错时也要重算 skin-ocean（它决定星尘的挂与摘）
watch(oceanRuntime, syncDom)

/** 恢复默认（弹窗里的「恢复默认」按钮） */
export function resetOceanSkin() {
  Object.assign(oceanSkin, { ...DEFAULTS })
}

// 模块加载即对齐一次 DOM：早于 App.vue 挂载，避免首帧闪一下默认玻璃度
syncDom()
