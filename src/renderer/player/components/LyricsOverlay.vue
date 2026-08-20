<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { LyricLine } from '../lrc'

const props = defineProps<{
  lines: LyricLine[]
  active: number
}>()

const container = ref<HTMLElement | null>(null)

watch(
  () => props.active,
  async (idx) => {
    await nextTick()
    if (!container.value) return
    const el = container.value.querySelector<HTMLElement>(`[data-i="${idx}"]`)
    if (el) {
      const top = el.offsetTop - container.value.clientHeight / 2 + el.clientHeight / 2
      container.value.scrollTo({ top, behavior: 'smooth' })
    }
  }
)
</script>

<template>
  <div class="lyrics" ref="container">
    <div v-if="lines.length === 0" class="placeholder">暂无歌词</div>
    <div
      v-for="(line, i) in lines"
      :key="i"
      :data-i="i"
      class="line"
      :class="{ active: i === active }"
    >
      {{ line.text }}
    </div>
  </div>
</template>

<style scoped>
.lyrics {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 42%;
  padding: 40px 6% 60px;
  overflow: hidden;
  text-align: center;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.85) 70%);
  mask-image: linear-gradient(180deg, transparent, #000 25%, #000 100%);
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 25%, #000 100%);
  scroll-behavior: smooth;
}
.placeholder {
  color: rgba(255, 255, 255, 0.4);
  font-size: 20px;
}
.line {
  font-size: 26px;
  line-height: 1.5;
  padding: 6px 0;
  color: rgba(255, 255, 255, 0.45);
  transition: color 0.25s ease, transform 0.25s ease, opacity 0.25s ease;
  transform: scale(0.96);
}
.line.active {
  color: #fff;
  font-size: 34px;
  font-weight: 800;
  transform: scale(1.04);
  text-shadow: 0 0 24px rgba(255, 61, 139, 0.7), 0 0 8px rgba(124, 92, 255, 0.6);
}
</style>
