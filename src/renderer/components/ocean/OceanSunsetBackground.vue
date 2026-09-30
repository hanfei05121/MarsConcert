<script setup lang="ts">
/**
 * OceanSunsetBackground —— 实时海洋 · 夕阳光影背景层。
 *
 * 只负责三件事：挂容器、把 props 透传给引擎、卸载时把 GPU 上下文收干净。
 * 真正的着色器在 ./oceanEngine（Three.js WebGPU + TSL，移植自 open-sea-skin）。
 *
 * three 那部分体积不小（约 1MB），所以引擎是动态 import 的：只有当皮肤真的切到
 * 海洋时才下载，歌单/搜索页不会为它买单。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { OceanEngine } from './oceanEngine'
import type { OceanQuality } from '../../main/oceanSkin'
import { oceanRuntime } from '../../main/oceanSkin'

const props = withDefaults(
  defineProps<{
    /** 波浪大小 0~100 */
    sea?: number
    /** 日光 0~100（0 = 黄昏金红，100 = 正午） */
    daylight?: number
    /** 自动昼夜循环 */
    autoCycle?: boolean
    quality?: OceanQuality
    /** 层叠层级：-1 让它垫在星尘之下、玻璃面板之后 */
    zIndex?: number
    opacity?: number
  }>(),
  // 默认与 oceanSkin 的 DEFAULTS 对齐：日光 80、精细画质
  { sea: 45, daylight: 80, autoCycle: false, quality: 'high', zIndex: -1, opacity: 1 }
)

const emit = defineEmits<{ ready: []; fail: [message: string] }>()

const hostRef = ref<HTMLDivElement | null>(null)
const ready = ref(false)
let engine: OceanEngine | null = null
let disposed = false

/** 把失败原因留下来给弹窗看：出问题时用户不该只看到一片黑 */
function reportError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  ready.value = false
  oceanRuntime.failed = true
  oceanRuntime.error = message
  emit('fail', message)
}

onMounted(async () => {
  const host = hostRef.value
  if (!host) return
  try {
    const { createOceanEngine } = await import('./oceanEngine')
    if (disposed) return
    engine = await createOceanEngine({
      container: host,
      quality: props.quality,
      sea: props.sea,
      daylight: props.daylight,
      autoCycle: props.autoCycle,
      onFirstFrame: () => {
        ready.value = true
        oceanRuntime.ready = true
        // 首帧保险可能先报了「未启动」，实际只是编译偏慢：既然出帧了就把那条告警撤掉
        oceanRuntime.failed = false
        oceanRuntime.error = ''
        oceanRuntime.liveDaylight = props.daylight
        emit('ready')
      },
      onDaylightChange: (value) => {
        oceanRuntime.liveDaylight = value
      },
      // 渲染循环内部报错（多半是 TSL 编译失败）：交给弹窗显示原因
      onError: (err) => {
        reportError(err)
      }
    })
    // 加载期间组件已被卸载：把刚建好的上下文立刻收掉，别漏一个 WebGPU device
    if (disposed) {
      engine.dispose()
      engine = null
    }
  } catch (err) {
    reportError(err)
  }
})

onBeforeUnmount(() => {
  disposed = true
  oceanRuntime.ready = false
  engine?.dispose()
  engine = null
})

watch(
  () => props.sea,
  (v) => engine?.setSea(v)
)
watch(
  () => props.daylight,
  (v) => engine?.setDaylight(v)
)
watch(
  () => props.autoCycle,
  (v) => engine?.setAutoCycle(v)
)
</script>

<template>
  <div
    class="ocean-layer"
    :class="{ ready }"
    :style="{ zIndex: String(zIndex), '--ocean-opacity': String(opacity) }"
    aria-hidden="true"
  >
    <div ref="hostRef" class="ocean-host" />
  </div>
</template>

<style scoped>
.ocean-layer {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  /* 首帧出图前保持透明：避免海面「蹦」出来的硬切 */
  opacity: 0;
  transition: opacity 1.4s ease;
}
.ocean-layer.ready {
  opacity: var(--ocean-opacity, 1);
}
.ocean-host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* 兜底底色：着色器编译完成前露出的也是深色海面基调，不是白底 */
  background: #05070a;
}
.ocean-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
