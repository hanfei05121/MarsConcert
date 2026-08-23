<script setup lang="ts">
import { computed } from 'vue'
import { AudioOutlined } from '@ant-design/icons-vue'
import type { LyricLine } from '../lrc'

const props = defineProps<{
  lines: LyricLine[]
  active: number
  now: number // 当前歌词时间（视频时间 - 歌词偏移）
}>()

// 长前奏隐藏：首句歌词晚于 10s 才出现（前奏纯伴奏），前奏期间不显示歌词，
// 临近首句 5s 内才显示首句预览；已开唱（active >= 0）恒显示；无歌词时仍显示“暂无歌词”占位。
const INTRO_HIDE_SEC = 10 // 首句晚于该秒数视为“长前奏”
const INTRO_PREVIEW_SEC = 5 // 前奏最后 5 秒内显示首句预览
const visible = computed(() => {
  if (props.active >= 0) return true
  if (props.lines.length === 0) return true
  const first = props.lines[0].time
  return !(first > INTRO_HIDE_SEC && props.now < first - INTRO_PREVIEW_SEC)
})

// 当前行索引（未开始时取首行作为“即将开始”预览）
const curIdx = computed(() => (props.active >= 0 ? props.active : 0))
// 偶数行 → 当前行落在左上；奇数行 → 当前行落到右下（KTV 左右交替高亮）
const isEven = computed(() => curIdx.value % 2 === 0)

// 上方槽（始终靠左）与下方槽（始终靠右）各自显示的内容
const topText = computed(() => {
  if (props.lines.length === 0) return ''
  return isEven.value
    ? props.lines[curIdx.value]?.text
    : props.lines[curIdx.value + 1]?.text
})
const bottomText = computed(() => {
  if (props.lines.length === 0) return ''
  return isEven.value
    ? props.lines[curIdx.value + 1]?.text
    : props.lines[curIdx.value]?.text
})

// 哪个槽是当前行（高亮），哪个是下一句（预览）
const topIsCur = computed(() => isEven.value)
const bottomIsCur = computed(() => !isEven.value)

// —— 长停顿倒计时：临近下一句的最后 5 秒显示 5 格倒计时，每秒熄灭一格 ——
const PAUSE_GAP_SEC = 15 // 句中停顿超过该秒数才启用倒计时（避免正常换气停顿也触发）
const PAUSE_COUNTDOWN_SEC = 5 // 倒计时格数（每秒减一格，5→1）

// 下一句目标歌词（未开唱时即首句）
const targetLine = computed<LyricLine | null>(() => {
  const i = props.active >= 0 ? props.active + 1 : 0
  return props.lines[i] ?? null
})
// 当前停顿时长（上一句歌词时间/歌曲起点 → 下一句歌词时间）
const pauseGap = computed(() => {
  if (!targetLine.value) return 0
  const prev = props.active >= 0 ? props.lines[props.active].time : 0
  return targetLine.value.time - prev
})
// 距下一句的剩余秒数
const remain = computed(() =>
  targetLine.value ? targetLine.value.time - props.now : 0
)
// 倒计时格数：0=不显示；剩余在 (0,5] 内时 5→1 递减。
// 歌曲开头（未开唱）恒启用；句中停顿仅当停顿 >15s 才启用。
const countdown = computed(() => {
  if (!targetLine.value) return 0
  const r = remain.value
  if (r <= 0 || r > PAUSE_COUNTDOWN_SEC) return 0
  if (props.active >= 0 && pauseGap.value <= PAUSE_GAP_SEC) return 0
  return Math.ceil(r)
})

// 倒计时对齐方向：跟着「下一句」所在的槽位走——
// 偶数 active：下一句在下槽（右下）→ 靠右；奇数 active / 未开唱：下一句在上槽（左上）→ 靠左
const countdownRight = computed(() => props.active >= 0 && props.active % 2 === 0)
</script>

<template>
  <div class="lyrics" v-show="visible">
    <div v-if="lines.length === 0" class="placeholder">暂无歌词</div>
    <template v-else>
      <!-- 倒计时：跟随下一句所在槽位左右交替，5 格每秒熄灭一格，提示该起唱了 -->
      <div v-if="countdown > 0" class="countdown" :class="{ right: countdownRight }">
        <span v-for="n in PAUSE_COUNTDOWN_SEC" :key="n" class="dot" :class="{ on: n <= countdown }" />
      </div>
      <div class="row top" :class="topIsCur ? 'cur' : 'nxt'">
        {{ topText }}
        <AudioOutlined v-if="!topText && topIsCur" class="ph-note" />
      </div>
      <div v-if="bottomText" class="row bottom" :class="bottomIsCur ? 'cur' : 'nxt'">
        {{ bottomText }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.lyrics {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 22px;
  padding: 0 6% 6%;
  pointer-events: none;
}
.placeholder {
  color: rgba(255, 255, 255, 0.4);
  font-size: 20px;
  text-align: center;
}
.row {
  width: 100%;
  line-height: 1.35;
  color: #fff;
  /* 深色描边阴影：防止视频为白色背景时看不见字 */
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9), 0 0 3px rgba(0, 0, 0, 0.85);
  transition: color 0.28s ease, text-shadow 0.28s ease, transform 0.28s ease,
    opacity 0.28s ease;
}
/* 当前句为空时的音符占位（继承行高亮色） */
.ph-note {
  vertical-align: -0.12em;
  opacity: 0.85;
}
/* 上槽：始终靠左 */
.top {
  text-align: left;
}
/* 下槽：始终靠右 */
.bottom {
  text-align: right;
}
/* 当前行（高亮，随行号奇偶在左上/右下交替） */
.cur {
  font-size: 42px;
  font-weight: 800;
  /* 火星炽红：与普通白字形成明显色差（经典 KTV 效果） */
  color: #ff5a2e;
  /* 炽红辉光 + 深色描边：白底下也清晰可见 */
  text-shadow: 0 0 26px rgba(255, 77, 46, 0.7), 0 2px 6px rgba(0, 0, 0, 0.9),
    0 0 3px rgba(0, 0, 0, 0.85);
  transform: scale(1.03);
}
/* 下一句（预览，字号与高亮一致、正常白色，落在对角） */
.nxt {
  font-size: 42px;
  font-weight: 600;
  color: #fff;
  transform: scale(1);
}
/* —— 倒计时（跟随歌词左右交替：靠左 / 靠右） —— */
.countdown {
  display: flex;
  justify-content: flex-start;
  gap: 14px;
}
.countdown.right {
  justify-content: flex-end;
}
.dot {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.45);
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease,
    transform 0.3s ease;
}
/* 亮着的格：火星炽红 + 辉光（与当前句高亮色一致） */
.dot.on {
  background: #ff5a2e;
  border-color: #ff5a2e;
  box-shadow: 0 0 14px rgba(255, 77, 46, 0.85);
}
</style>
