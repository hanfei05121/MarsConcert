<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const banners = [
  { title: '热门金曲榜', sub: '本周最热 KTV 必点', grad: 'linear-gradient(120deg,#ff9922,#ff5e7e)' },
  { title: '新歌首发', sub: '最新 MV 抢先唱', grad: 'linear-gradient(120deg,#7c5cff,#21e6c1)' },
  { title: '经典老歌', sub: '回忆杀·一唱就破防', grad: 'linear-gradient(120deg,#ff9922,#7c5cff)' },
  { title: '欢唱party', sub: '聚会嗨唱合集', grad: 'linear-gradient(120deg,#21e6c1,#ff9922)' }
]

const idx = ref(0)
let timer: number | undefined

function go(n: number) {
  idx.value = (n + banners.length) % banners.length
}
function next() {
  go(idx.value + 1)
}
function prev() {
  go(idx.value - 1)
}

onMounted(() => {
  timer = window.setInterval(next, 4000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="banner">
    <div
      class="slide"
      :style="{ background: banners[idx].grad }"
    >
      <div class="text">
        <div class="t">{{ banners[idx].title }}</div>
        <div class="s">{{ banners[idx].sub }}</div>
      </div>
      <div class="deco">♪</div>
    </div>

    <button class="nav prev" @click="prev">‹</button>
    <button class="nav next" @click="next">›</button>

    <div class="dots">
      <span
        v-for="(b, i) in banners"
        :key="i"
        class="dot"
        :class="{ on: i === idx }"
        @click="go(i)"
      />
    </div>
  </div>
</template>

<style scoped>
.banner {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  height: 200px;
  flex-shrink: 0;
}
.slide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 48px;
}
.text .t {
  font-size: 34px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}
.text .s {
  margin-top: 8px;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.92);
}
.deco {
  font-size: 120px;
  color: rgba(255, 255, 255, 0.18);
}
.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.nav:hover {
  background: rgba(0, 0, 0, 0.5);
}
.nav.prev {
  left: 12px;
}
.nav.next {
  right: 12px;
}
.dots {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
}
.dot.on {
  background: #fff;
  width: 20px;
  border-radius: 4px;
}
</style>
