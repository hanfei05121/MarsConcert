<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import ChartBlock from '../components/ChartBlock.vue'
import coalBall from '../../assets/coal-ball.jpg'
import { onAdd, onPlay } from '../useQueueActions'

const state = store.state

// —— 首页榜单（本地库派生，无播放量数据，用入库顺序近似）——
const rising = computed(() => state.allSongs.slice(0, 8)) // 飙升榜：取前面批次
const fresh = computed(() => [...state.allSongs].slice(-8).reverse()) // 新歌榜：最新入库在前
</script>

<template>
  <div class="scroll">
    <!-- 火星人专属 Hero -->
    <div class="mars-hero">
      <img class="hero-mascot" :src="coalBall" alt="黑煤球" />
      <div class="hero-text">
        <div class="hero-kicker">MARS EDITION · 火星人专属点歌台</div>
        <h1 class="hero-title">火星人，欢迎回家 🔥</h1>
        <p class="hero-sub">黑煤球已就位。点一首歌，把整座火星唱成你的主场。</p>
      </div>
    </div>

    <div class="charts">
      <ChartBlock title="飙升榜" badge="日榜" :songs="rising" @add="onAdd" @play="onPlay" />
      <ChartBlock title="新歌排行榜" badge="日榜" :songs="fresh" @add="onAdd" @play="onPlay" />
    </div>
  </div>
</template>

<style scoped>
/* —— 火星人 Hero —— */
.mars-hero {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px 24px;
  margin-bottom: 4px;
  border-radius: 18px;
  background:
    radial-gradient(560px 200px at 0% 0%, rgba(255, 77, 46, 0.18), transparent 60%),
    linear-gradient(120deg, var(--bg-2), var(--bg-1));
  border: 1px solid var(--line);
  box-shadow: var(--shadow-glow);
}
.hero-mascot {
  width: 92px;
  height: 92px;
  flex-shrink: 0;
  border-radius: 50%;
  filter: drop-shadow(0 6px 18px rgba(255, 77, 46, 0.4));
}
.hero-kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--accent-2);
  text-transform: uppercase;
}
.hero-title {
  margin: 6px 0 4px;
  font-size: 26px;
  font-weight: 800;
  color: var(--text-0);
}
.hero-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 18px;
}
</style>