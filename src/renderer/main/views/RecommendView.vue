<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import ChartBlock from '../components/ChartBlock.vue'
import MorphingText from '../../components/MorphingText.vue'
import coalBall from '../../assets/coal-ball.jpg'
import { onAdd, onPlay } from '../useQueueActions'

const state = store.state

/** Hero 标语：形变轮播，逐条「融成一团再凝回下一条」 */
const heroTexts = ['欢迎来到 MarsConcert 火星演唱会', '火星乌托邦', '尽情大声欢笑']

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
        <!-- 标题：文字形变轮播（MorphingText / 原 RoleRotator 效果），逐条融化再凝结 -->
        <h1 class="hero-title">
          <MorphingText :texts="heroTexts" :morph-time="2.5" :cool-down-time="1.5" />
        </h1>
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
/* —— 火星人 Hero（玻璃面板 + 火星红辉光）—— */
.mars-hero {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px 24px;
  margin-bottom: 4px;
  border-radius: 18px;
  background:
    radial-gradient(560px 220px at 0% 0%, rgba(255, 77, 46, 0.22), transparent 62%),
    var(--glass-sheen),
    var(--bg-1);
  border: 1px solid var(--line);
  box-shadow: var(--glass-edge), 0 14px 40px rgba(255, 77, 46, 0.14), var(--shadow-glass);
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
  /* 字号决定形变文字大小（MorphingText 的容器高度按 1.5em 跟随它）。
     上限压在 34px：最长一条「欢迎来到 MarsConcert 火星演唱会」约 16.5em 宽，
     34px 时约 560px，而 hero 文字区最窄也有 500px 上下 —— 不会撑出容器被裁。 */
  font-size: clamp(22px, 2.2vw, 34px);
  font-weight: 800;
  color: var(--text-0);
  /* nowrap 的长文案不会撑破 hero，超出部分由 MorphingText 自己裁 */
  overflow: hidden;
}
.hero-text {
  /* 关键：min-width:0 才能让 flex 子项在长文案时不把 hero 撑开 */
  flex: 1;
  min-width: 0;
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