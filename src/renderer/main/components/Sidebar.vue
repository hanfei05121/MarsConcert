<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component, type CSSProperties } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HomeOutlined,
  AudioOutlined,
  CustomerServiceOutlined,
  TagsOutlined,
  ProfileOutlined,
  UserOutlined,
  FolderOutlined
} from '@ant-design/icons-vue'
import type { ViewName } from '../store'
import { store } from '../store'
import { navDir } from '../navDir'

const route = useRoute()
const router = useRouter()

const menus: { key: ViewName; label: string; icon: Component }[] = [
  { key: 'recommend', label: '推荐', icon: HomeOutlined },
  { key: 'search', label: '歌曲', icon: AudioOutlined },
  { key: 'artists', label: '歌星', icon: CustomerServiceOutlined },
  { key: 'category', label: '分类', icon: TagsOutlined },
  { key: 'playlists', label: '歌单', icon: ProfileOutlined },
  { key: 'mine', label: '我的', icon: UserOutlined }
]

/* ============ 弧形滚轮几何 ============
   弧心在侧栏左侧很远处，选项沿圆弧排布（扇形）：
     · 弧顶 = 「基准线」（nav 垂直居中），压在线上时文字正好水平，越远的项越倾斜 → 扇形张角。
     · 只有正压线（pos 为整数）的那一项才高亮；滚动/拖动途中一律不亮。 */
const RADIUS = 640 // 弧半径（px）：越大弧越平缓
const STEP = 62 // 紧邻基准线那一格的弧长（px）：越大越透气
const GAP_RATIO = 0.74 // 每往两端远一格，间距就乘这个系数（近疏远密 → 有纵深，也不会顶出导航区）
const TILT = 1 // 跟随弧面的倾斜系数（0 = 全部水平，1 = 完全贴合弧切线）
const DEG = 180 / Math.PI
/** 基准线在导航区里的纵向位置（%）：偏上，免得导航上方空一大块 */
const BASELINE = '39%'
/** 缓动收敛速度：每帧吃掉剩余距离的 30%（≈210ms 落定，再快就看不到滚动感） */
const EASE = 0.3
/** 落定阈值（槽位）：小于它就直接归位，保证「到达基准线」是一次干脆的落点而不是慢慢逼近 */
const SETTLE_EPS = 0.008
/** 滚轮停手多久算一次滚动结束，然后吸附到最近一项 */
const SNAP_DELAY = 120

/** 槽位偏移 → 累计弧长（px）：0 → 0；±1 → STEP；±2 → STEP + STEP×RATIO …（近疏远密） */
function arcOffset(d: number) {
  const sign = d < 0 ? -1 : 1
  const a = Math.abs(d)
  const n = Math.floor(a)
  let sum = 0
  let gap = STEP
  for (let k = 0; k < n; k++) {
    sum += gap
    gap *= GAP_RATIO
  }
  return sign * (sum + gap * (a - n))
}

/** 路由对应的槽位 */
const routeIndex = computed(() => {
  const i = menus.findIndex((m) => m.key === route.name)
  return i < 0 ? 0 : i
})

const navEl = ref<HTMLElement | null>(null)
const dragging = ref(false)
/** 压在基准线上的槽位：整数 = 某一项正压线；小数 = 正在滚动 */
const pos = ref(routeIndex.value)
/** 缓动目标槽位（非响应式，逐帧读写） */
let target = pos.value

let raf = 0
let snapTimer: ReturnType<typeof setTimeout> | undefined

const clamp = (v: number) => Math.min(menus.length - 1, Math.max(0, v))

/** 缓动：每帧把 pos 拉向 target；只有「落定」那一帧才算到达基准线 */
function tick() {
  const diff = target - pos.value
  if (Math.abs(diff) < SETTLE_EPS) {
    pos.value = target
    raf = 0
    landed()
    return
  }
  pos.value += diff * EASE
  raf = requestAnimationFrame(tick)
}
function startAnim() {
  if (!raf) raf = requestAnimationFrame(tick)
}
function stopAnim() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

/** 到达基准线 → 才切页（高亮由 pos 是否为整数推导，见 isLit） */
function landed() {
  if (!Number.isInteger(target)) return
  const key = menus[target]?.key
  if (!key || key === route.name) return
  // 记下滚动方向：右侧页面据此决定从上方还是下方淡入（跟滚轮同向）
  const from = menus.findIndex((m) => m.key === route.name)
  navDir.value = from >= 0 && target < from ? -1 : 1
  router.push({ name: key }).catch(() => {})
}

function clearSnap() {
  if (snapTimer) clearTimeout(snapTimer)
  snapTimer = undefined
}
/** 停手后吸附到最近的一项 */
function snap() {
  const s = clamp(Math.round(target))
  if (s === target) {
    if (!raf) landed()
    return
  }
  target = s
  startAnim()
}

/* —— 滚轮：自由滚动，停手 160ms 后吸附 —— */
function onWheel(e: WheelEvent) {
  if (dragging.value) return
  e.preventDefault()
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1
  target = clamp(target + (e.deltaY * unit) / 100)
  startAnim()
  clearSnap()
  snapTimer = setTimeout(snap, SNAP_DELAY)
}

/* —— 拖动：跟手滚动，松手吸附（参考图里的「滑动浏览」）—— */
let dragY0 = 0
let dragT0 = 0
let moved = 0
function onDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  stopAnim()
  clearSnap()
  dragging.value = true
  moved = 0
  dragY0 = e.clientY
  dragT0 = target
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
function onMove(e: PointerEvent) {
  if (!dragging.value) return
  const dy = e.clientY - dragY0
  moved = Math.max(moved, Math.abs(dy))
  target = clamp(dragT0 - dy / STEP) // 往下拖 = 往回转
  pos.value = target // 拖动期间跟手，不做缓动
}
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  if (!dragging.value) return
  dragging.value = false
  const s = clamp(Math.round(target))
  target = s
  if (Math.abs(pos.value - s) < SETTLE_EPS) {
    pos.value = s
    landed()
    return
  }
  startAnim()
}

/* —— 点击：把这一项转到基准线上，压线后才切页 —— */
function onItemClick(i: number) {
  if (moved > 6) {
    moved = 0 // 刚才那一下是拖动，不算点击
    return
  }
  clearSnap()
  stopAnim()
  target = clamp(i)
  if (pos.value === target) {
    landed()
    return
  }
  startAnim()
}

/* —— 外部（顶栏返回等）改路由时，滚轮跟着转过去 —— */
watch(routeIndex, (i) => {
  if (dragging.value) return
  if (Math.round(target) === i && pos.value === i) return
  target = i
  if (pos.value === i) {
    landed()
    return
  }
  startAnim()
})

/** 由「距基准线的槽位数」算出弧上的位置 / 朝向 / 明暗。
    间距近疏远密：近处留白充足（邻项之间有 10px 空隙），远端自动压缩，
    所以基准线偏上时「停在第 1 项」和「停在第 6 项」都不会有项被导航区上下缘裁掉。 */
function itemStyle(i: number): CSSProperties {
  const off = i - pos.value
  const th = arcOffset(off) / RADIUS
  const d = Math.abs(off)
  const op = Math.max(0.22, 1 - d * 0.2)
  return {
    transform:
      `translate3d(${((Math.cos(th) - 1) * RADIUS).toFixed(2)}px, ` +
      `calc(${(Math.sin(th) * RADIUS).toFixed(2)}px - 50%), 0) ` +
      `rotate(${(th * DEG * TILT).toFixed(2)}deg) ` +
      `scale(${(1 - Math.min(d, 5) * 0.035).toFixed(3)})`,
    opacity: op.toFixed(3),
    filter: d < 0.05 ? 'none' : `blur(${Math.min(d * 0.55, 1.6).toFixed(2)}px)`,
    zIndex: String(100 - Math.round(Math.min(d, 5) * 10)),
    pointerEvents: d > 4.4 ? 'none' : 'auto'
  }
}

/** 只有压线的那一项亮：滚动途中 pos 是小数 → 谁都不亮 */
function isLit(i: number) {
  return !dragging.value && Number.isInteger(pos.value) && Math.round(pos.value) === i
}

/** 当前曲库目录的文件夹名（D:\song-lib → song-lib），左下角展示用 */
const libName = computed(() => {
  const p = store.state.config?.songLibPath
  if (!p) return '未设置'
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p
})

onMounted(() => {
  navEl.value?.addEventListener('wheel', onWheel, { passive: false })
})
onBeforeUnmount(() => {
  navEl.value?.removeEventListener('wheel', onWheel)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  stopAnim()
  clearSnap()
})
</script>

<template>
  <aside class="sidebar">
    <!-- 用户区 -->
    <div class="user">
      <div class="avatar coal" title="火星人 · 黑煤球"></div>
      <div class="uinfo">
        <div class="nick">MarsConcert</div>
      </div>
    </div>

    <!-- 弧形滚轮导航：滚轮 / 拖动旋转，压到基准线的那一项才亮 -->
    <nav
      ref="navEl"
      class="nav"
      :class="{ dragging }"
      :style="{ '--baseline': BASELINE }"
      @pointerdown="onDown"
    >
      <span class="baseline" aria-hidden="true"></span>

      <button
        v-for="(m, i) in menus"
        :key="m.key"
        class="item"
        :class="{ active: isLit(i) }"
        :style="itemStyle(i)"
        @click="onItemClick(i)"
      >
        <span class="ic"><component :is="m.icon" /></span>
        <span class="lb">{{ m.label }}</span>
      </button>
    </nav>

    <!-- 我的资源：点击选择曲库目录 -->
    <div class="cloud" title="点击选择曲库目录" @click="store.chooseLib()">
      <span class="ic"><FolderOutlined /></span>
      <div class="clbinfo">
        <span class="clbtitle">我的资源</span>
        <span class="clbpath">{{ libName }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  /* 侧栏宽度：改这里要同步 PlaylistPopup.vue 的 inset 左值 */
  width: 400px;
  flex-shrink: 0;
  /* 玻璃侧栏：半透明面板 + 发丝描边 + 顶边高光 */
  border-right: 1px solid var(--line);
  box-shadow: var(--glass-edge), var(--shadow-glass);
  display: flex;
  flex-direction: column;
  padding: 16px 16px;
}
.user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  margin-bottom: 10px;
}
.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--ctrl-accent-soft);
  color: var(--ctrl-accent-ink);
  font-weight: 800;
  font-size: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--ctrl-accent-line);
}
/* 火星人吉祥物：黑煤球 */
.avatar.coal {
  background: url(../../assets/coal-ball.jpg) center / cover no-repeat;
  box-shadow: 0 0 0 2px var(--accent-soft), 0 0 14px var(--accent-soft);
}
.nick {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
}

/* —— 弧形滚轮 —— */
.nav {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
}
.nav.dragging,
.nav.dragging .item {
  cursor: grabbing;
}
/* 基准刻度线：**常亮**（一直橙色 + 外发光），不再是「压线那一刻才亮」。
   纵向位置由 --baseline 决定（与 items 同源，改一处即可）；右端固定在 x=46，只往左加长。 */
.baseline {
  position: absolute;
  left: 20px;
  top: var(--baseline, 39%);
  width: 26px;
  height: 2px;
  transform: translateY(-50%);
  border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
  pointer-events: none;
}
.item {
  position: absolute;
  left: 72px;
  right: 24px;
  top: var(--baseline, 39%);
  height: 56px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 20px;
  border: none;
  border-radius: 14px;
  background: transparent;
  box-shadow: none;
  color: var(--text-1);
  font-size: 28px;
  font-weight: 600;
  white-space: nowrap;
  text-align: left;
  cursor: pointer;
  transform-origin: 50% 50%;
  /* 只过渡配色：位移/透明度/模糊是逐帧算出来的，加过渡会拖成橡皮筋 */
  transition: background 0.3s ease, box-shadow 0.3s ease, color 0.3s ease;
  will-change: transform, opacity, filter;
}
.item:hover {
  background: transparent;
  color: var(--text-0);
}
.item.active,
.item.active:hover {
  /* 压线的那一项：橙玻璃 + 放大加粗（控件统一色 soft 档） */
  background: var(--ctrl-accent-soft), var(--bg-2);
  color: var(--ctrl-accent-ink);
  font-size: 30px;
  font-weight: 800;
  box-shadow: inset 0 0 0 1px var(--ctrl-accent-line), 0 6px 18px rgba(255, 77, 46, 0.18);
}
.ic {
  font-size: 22px;
}

.cloud {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding: 14px 18px;
  border-radius: 12px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  color: var(--text-1);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 250, 246, 0.08);
  transition: var(--ease);
}
.cloud:hover {
  background: var(--bg-3);
  color: var(--accent);
  transform: translateY(2px);
}
.clbinfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.clbtitle {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
}
.clbpath {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}
</style>
