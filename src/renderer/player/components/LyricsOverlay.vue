<script setup lang="ts">
import { computed } from 'vue'
import type { LyricLine } from '../lrc'

const props = defineProps<{
  lines: LyricLine[]
  active: number
}>()

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
</script>

<template>
  <div class="lyrics">
    <div v-if="lines.length === 0" class="placeholder">暂无歌词</div>
    <template v-else>
      <div class="row top" :class="topIsCur ? 'cur' : 'nxt'">
        {{ topText || (topIsCur ? '♪' : '') }}
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
  bottom: 12%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 22px;
  padding: 0 6% 6%;
  pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.55) 80%);
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
  /* 高亮粉：与普通白字形成明显色差（经典 KTV 效果） */
  color: #ff5ca8;
  /* 粉色辉光 + 深色描边：白底下也清晰可见 */
  text-shadow: 0 0 26px rgba(255, 61, 139, 0.65), 0 2px 6px rgba(0, 0, 0, 0.9),
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
</style>
