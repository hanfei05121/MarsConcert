<script setup lang="ts">
/**
 * MorphingText —— 文字形变轮播（「融成一团再凝回下一条」）。
 *
 * 搬运自 careercompass-main-vue 的 MorphingText.vue + RoleRotator.vue，
 * 合并成一个自包含组件（那边 RoleRotator 只是 tailwind class 包装层，本项目没有 tailwind）：
 * - 两个绝对定位的 span 叠在一起，用 blur + opacity 交叉过渡：
 *   blur = min(8/x - 8, 100)，opacity = x^0.4
 * - 外层套一个 SVG 阈值滤镜（feColorMatrix alpha×255-140）+ blur(0.6px)，
 *   把模糊文字压成硬边形状 → 观感就是「融成一团再凝回文字」
 * - 去掉站内依赖（useReducedMotion / useSiteReady）：减少动效时只显示第一条、不做形变
 * - 左对齐、字号继承调用方；容器高度用 1.5em 跟随字号，嵌进标题里即自适应
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 轮播文案，逐条形变切换 */
    texts: string[]
    /** 单次形变时长（秒） */
    morphTime?: number
    /** 形变之间的停顿（秒） */
    coolDownTime?: number
  }>(),
  { morphTime: 1.5, coolDownTime: 0.5 },
)

/** 两层文字的公共定位类名（绝对定位叠在一起） */
const SLOT_CLASS = 'mt-slot'
const FILTER_ID = 'morphing-text-threshold'

const rootRef = ref<HTMLElement | null>(null)
const text1Ref = ref<HTMLElement | null>(null)
const text2Ref = ref<HTMLElement | null>(null)

/** 系统「减少动效」偏好 */
const motionQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

const textIndex = ref(0)
/** 形变进度与冷却计时 */
let morph = 0
let coolDown = 0
let lastTime = 0
let morphing = false
let rafId = 0
let started = false
let inView = true
let pageVisible = true
let observer: IntersectionObserver | null = null

function setStyles(fraction: number) {
  const t1 = text1Ref.value
  const t2 = text2Ref.value
  if (!t1 || !t2 || props.texts.length === 0) return

  const next = fraction
  const prev = 1 - fraction

  t2.style.filter = `blur(${Math.min(8 / next - 8, 100)}px)`
  t2.style.opacity = `${next ** 0.4 * 100}%`

  t1.style.filter = `blur(${Math.min(8 / prev - 8, 100)}px)`
  t1.style.opacity = `${prev ** 0.4 * 100}%`

  t1.textContent = props.texts[textIndex.value % props.texts.length] ?? ''
  t2.textContent = props.texts[(textIndex.value + 1) % props.texts.length] ?? ''
}

/** 推进形变 */
function doMorph() {
  morphing = false
  morph -= coolDown
  coolDown = 0

  let fraction = morph / props.morphTime
  if (fraction > 1) {
    coolDown = props.coolDownTime
    fraction = 1
  }

  setStyles(fraction)
  if (fraction === 1) textIndex.value += 1
}

/** 形变结束后的静置态 */
function doCooldown() {
  morph = 0
  if (morphing) return
  morphing = true
  const t1 = text1Ref.value
  const t2 = text2Ref.value
  if (!t1 || !t2) return
  t2.style.filter = 'none'
  t2.style.opacity = '100%'
  t1.style.filter = 'none'
  t1.style.opacity = '0%'
}

/** 初始画面：显示第一条 */
function firstRender() {
  const t1 = text1Ref.value
  const t2 = text2Ref.value
  if (!t1 || !t2) return
  t1.textContent = props.texts[0] ?? ''
  t2.textContent = props.texts[1] ?? props.texts[0] ?? ''
  t1.style.filter = 'none'
  t1.style.opacity = '100%'
  t2.style.filter = 'none'
  t2.style.opacity = '0%'
}

function animate(newTime: number) {
  rafId = 0
  if (!started) return

  if (lastTime === 0) lastTime = newTime
  const dt = Math.min(0.05, (newTime - lastTime) / 1000)
  lastTime = newTime

  coolDown -= dt
  if (coolDown <= 0) doMorph()
  else doCooldown()

  // 离屏 / 页面隐藏时不再排帧，回来时由 syncVisibility 续上
  if (inView && pageVisible) rafId = requestAnimationFrame(animate)
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function syncVisibility() {
  pageVisible = document.visibilityState === 'visible'
  if (started && inView && pageVisible) {
    if (!rafId) {
      lastTime = 0
      rafId = requestAnimationFrame(animate)
    }
    return
  }
  stopLoop()
}

function start() {
  if (started) return
  started = true
  firstRender()
  lastTime = 0
  syncVisibility()
}

onMounted(() => {
  // 减少动效时只显示第一条，不做形变
  if (motionQuery?.matches) {
    started = true
    firstRender()
    return
  }

  firstRender()

  if (rootRef.value) {
    observer = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true
        syncVisibility()
      },
      { rootMargin: '80px' },
    )
    observer.observe(rootRef.value)
  }

  document.addEventListener('visibilitychange', syncVisibility)
  start()
})

onBeforeUnmount(() => {
  started = false
  stopLoop()
  observer?.disconnect()
  observer = null
  document.removeEventListener('visibilitychange', syncVisibility)
})
</script>

<template>
  <span ref="rootRef" class="morphing-text">
    <span ref="text1Ref" :class="SLOT_CLASS" />
    <span ref="text2Ref" :class="SLOT_CLASS" />

    <!-- 阈值滤镜：把模糊文字压成硬边，形成「融化再凝结」的形变观感 -->
    <svg
      id="morphing-text-filters"
      width="0"
      height="0"
      class="morphing-text-filters"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <filter :id="FILTER_ID">
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 255 -140"
          />
        </filter>
      </defs>
    </svg>
  </span>
</template>

<style scoped>
.morphing-text {
  position: relative;
  display: block;
  width: 100%;
  /* 高度跟随字号（1.5em 留出模糊扩散的余量，避免形变时边缘被裁） */
  height: 1.5em;
  overflow: hidden;
  text-align: left;
  /* 字号由调用方继承（h1 / class 决定），这里只管排版 */
  font-size: inherit;
  font-weight: 800;
  line-height: 1.15;
  /* 阈值滤镜把模糊文字压成硬边，形成「融化再凝结」的形变观感 */
  filter: url(#morphing-text-threshold) blur(0.6px);
}

/* 两层文字叠在一起，由 JS 通过 blur / opacity 交叉过渡 */
.mt-slot {
  position: absolute;
  inset-inline: 0;
  top: 0;
  display: inline-block;
  width: 100%;
  white-space: nowrap;
}

.morphing-text-filters {
  position: fixed;
  width: 0;
  height: 0;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .morphing-text {
    filter: none;
  }
}
</style>
