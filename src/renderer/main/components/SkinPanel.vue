<script setup lang="ts">
/**
 * SkinPanel —— 背景特效的参数弹窗。
 *
 * 触发按钮长在侧栏底部「我的资源」旁边（见 Sidebar.vue 的 .skin-trigger），
 * 这里只负责弹窗本身：位置锚在侧栏左下角、按钮正上方。
 *
 * 交互照搬 open-sea-skin 的那一套：波浪按钮 → 浮层面板，里面有皮肤切换、
 * 波浪大小 / 日光 / 玻璃不透明度三个滑块、自动昼夜循环、画质。视觉换成
 * MarsConcert 自己的火星玻璃（变量全部取自 style.css）。
 *
 * 面板里的每一项都直接写 oceanSkin，watch 会把变化同步给引擎（实时生效）并落 localStorage。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { oceanRuntime, oceanSkin, resetOceanSkin, skinPanel, type LobbySkin } from '../oceanSkin'
import { daylightLabel } from '../../components/ocean/daylight'

const panelRef = ref<HTMLDivElement | null>(null)

const SKIN_OPTIONS: Array<{ value: LobbySkin; label: string; hint: string }> = [
  { value: 'ocean', label: '海洋', hint: '实时海面 · 夕阳光影' },
  { value: 'silk', label: '丝绸', hint: '原丝绸流动背景' },
  { value: 'none', label: '关闭', hint: '只留火星星云底' }
]

const oceanOn = computed(() => oceanSkin.skin === 'ocean')

/** 日光滑块的位置：自动循环时跟随引擎实时值，否则用用户定的刻度 */
const sliderDaylight = computed(() =>
  oceanSkin.autoCycle ? Math.round(oceanRuntime.liveDaylight) : oceanSkin.daylight
)

/** 日光读数：给出当前时段名 */
const daylightText = computed(() =>
  daylightLabel(oceanSkin.autoCycle ? oceanRuntime.liveDaylight : oceanSkin.daylight)
)

function onDaylightInput(value: number | number[]) {
  const v = Math.round(Array.isArray(value) ? value[0] : value)
  oceanSkin.daylight = Math.min(100, Math.max(0, v))
  // 手动拖日光＝我要定格这一帧，自动昼夜循环让位（与上游「手动设置即停循环」一致）
  if (oceanSkin.autoCycle) oceanSkin.autoCycle = false
}

function onSeaInput(value: number | number[]) {
  oceanSkin.sea = Math.round(Array.isArray(value) ? value[0] : value)
}

function onGlassInput(value: number | number[]) {
  oceanSkin.glass = Math.round(Array.isArray(value) ? value[0] : value)
}

/**
 * 点面板外面 / 按 Esc 关闭。
 * 点触发按钮不算「外面」—— 那是切换动作，交给按钮自己的 click 处理，
 * 否则 pointerdown 先关、click 又取反，按钮会永远关不掉。
 */
function onPointerDown(event: PointerEvent) {
  if (!skinPanel.open) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (panelRef.value?.contains(target)) return
  if (target instanceof Element && target.closest('.skin-trigger')) return
  skinPanel.open = false
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && skinPanel.open) skinPanel.open = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Transition name="skin-pop">
    <div
      v-if="skinPanel.open"
      ref="panelRef"
      class="skin-panel"
      role="dialog"
      aria-label="背景特效设置"
    >
      <div class="head">
        <div>
          <div class="eyebrow">MARS SKIN</div>
          <div class="ptitle">海洋 · 夕阳光影</div>
        </div>
        <button class="close" type="button" title="关闭" @click="skinPanel.open = false">
          <CloseOutlined />
        </button>
      </div>

      <!-- 背景皮肤：海洋 / 丝绸 / 关闭 -->
      <div class="seg">
        <button
          v-for="s in SKIN_OPTIONS"
          :key="s.value"
          type="button"
          :title="s.hint"
          :class="{ on: oceanSkin.skin === s.value }"
          @click="oceanSkin.skin = s.value"
        >
          {{ s.label }}
        </button>
      </div>

      <div class="rows" :class="{ off: !oceanOn }">
        <label class="row">
          <span class="lb">波浪大小</span>
          <a-slider
            :value="oceanSkin.sea"
            :min="0"
            :max="100"
            :disabled="!oceanOn"
            @change="onSeaInput"
          />
          <span class="val">{{ String(oceanSkin.sea).padStart(2, '0') }}</span>
        </label>

        <label class="row">
          <span class="lb">日光</span>
          <a-slider
            :value="sliderDaylight"
            :min="0"
            :max="100"
            :disabled="!oceanOn || oceanSkin.autoCycle"
            @change="onDaylightInput"
          />
          <span class="val">{{ daylightText }}</span>
        </label>

        <label class="row">
          <span class="lb">玻璃不透明度</span>
          <a-slider :value="oceanSkin.glass" :min="40" :max="90" @change="onGlassInput" />
          <span class="val">{{ oceanSkin.glass }}%</span>
        </label>
      </div>

      <div class="toggles">
        <label class="tgl">
          <span>自动昼夜循环</span>
          <a-switch
            :checked="oceanSkin.autoCycle"
            :disabled="!oceanOn"
            @change="(v: unknown) => (oceanSkin.autoCycle = !!v)"
          />
        </label>
        <label class="tgl">
          <span>画质</span>
          <!-- 下拉浮层是 Teleport 到 body 的，scoped 样式够不着，
               所以给它挂 glass-pop，样式写在下面那个不带 scoped 的 style 块里 -->
          <a-select
            :value="oceanSkin.quality"
            :disabled="!oceanOn"
            size="small"
            class="quality"
            popup-class-name="glass-pop"
            @change="(v: unknown) => (oceanSkin.quality = v as typeof oceanSkin.quality)"
          >
            <a-select-option value="high">精细优先</a-select-option>
            <a-select-option value="low">流畅优先</a-select-option>
          </a-select>
        </label>
      </div>

      <p v-if="oceanRuntime.failed" class="note warn">
        海洋渲染没能启动，已回落到火星星云底。
        <span v-if="oceanRuntime.error" class="err">{{ oceanRuntime.error }}</span>
      </p>
      <p v-else class="note">
        拖动「日光」会定格当下这一刻，自动昼夜循环随之关闭。改动即时生效并自动保存。
      </p>

      <button class="reset" type="button" @click="resetOceanSkin()">
        恢复默认（波浪 45 · 日光 80 · 玻璃 72% · 精细）
      </button>
    </div>
  </Transition>
</template>

<style scoped>
/* 锚在侧栏左下角、触发按钮的正上方（侧栏 400px 宽，去掉两侧 16px 内边距 = 368px） */
.skin-panel {
  position: fixed;
  left: 16px;
  bottom: 108px;
  width: 368px;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  z-index: 85;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--line-strong);
  background: var(--glass-sheen), var(--popup-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: var(--glass-edge), var(--shadow-pop);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.22em;
  color: var(--accent-2);
  margin-bottom: 3px;
}
.ptitle {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
  letter-spacing: 1px;
}
.close {
  border: 0;
  background: transparent;
  color: var(--text-2);
  font-size: 15px;
  cursor: pointer;
  padding: 2px 4px;
  transition: var(--ease);
}
.close:hover {
  background: var(--accent-soft);
  color: var(--accent-3);
  transform: translateY(-2px);
}

/* —— 皮肤三选一 —— */
.seg {
  display: flex;
  gap: 6px;
  padding: 4px;
  margin-bottom: 16px;
  border-radius: 12px;
  background: var(--bg-0);
  border: 1px solid var(--line);
}
.seg button {
  flex: 1;
  padding: 7px 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: var(--ease);
}
.seg button:hover {
  background: var(--accent-soft);
  color: var(--accent-3);
  transform: translateY(-2px);
}
.seg button.on {
  background: var(--ctrl-accent-soft);
  color: var(--ctrl-accent-ink);
  box-shadow: var(--glass-edge);
}

/* —— 滑块行 —— */
.rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: opacity 0.3s ease;
}
.rows.off {
  opacity: 0.42;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  /* 行底那圈玻璃盒来自全局 .row，但内边距不在那里统一给（列表行、滑块行需求不同），
     得各自补：不补的话「波浪大小」会贴在圆角边上、读数也顶到右侧描边。
     横向取歌曲行同款 14px，纵向只给一点，免得三条滑块把弹窗撑得太高。 */
  padding: 4px 14px;
}
.lb {
  flex: none;
  width: 84px;
  font-size: 13px;
  color: var(--text-1);
}
.row :deep(.ant-slider) {
  flex: 1;
  margin: 10px 0;
}
.val {
  flex: none;
  width: 56px;
  text-align: right;
  font-size: 12px;
  color: var(--accent-3);
  font-variant-numeric: tabular-nums;
}
.row :deep(.ant-slider-track) {
  background: linear-gradient(92deg, var(--accent), var(--accent-3));
}
.row :deep(.ant-slider-handle::after) {
  box-shadow: 0 0 0 2px var(--accent);
}

/* —— 开关行 —— */
.toggles {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.tgl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-1);
}
.quality {
  width: 112px;
}

/* —— 玻璃开关（自动昼夜循环）——
   Ant 默认是「灰轨 + 白点 / 亮蓝轨」，在这里换成面板同一套语言：
   轨道是凹陷玻璃（--bg-0 + 发丝描边），选中 = 橙玻璃 soft 档（与导航选中态同款）。
   选择器都带 .tgl 前缀，特异性压过 Ant 运行时注入的 cssinjs 样式，不用 !important。 */
.tgl :deep(.ant-switch) {
  background-color: var(--bg-0);
  box-shadow: inset 0 0 0 1px var(--line);
}
.tgl :deep(.ant-switch:hover:not(.ant-switch-checked)) {
  background-color: var(--bg-0);
}
.tgl :deep(.ant-switch-handle::before) {
  background-color: var(--text-2);
}
.tgl :deep(.ant-switch-checked) {
  background-color: var(--bg-2);
  background-image: var(--ctrl-accent-soft);
  box-shadow: inset 0 0 0 1px var(--ctrl-accent-line);
}
.tgl :deep(.ant-switch-checked:hover) {
  background-image: var(--ctrl-accent); /* 悬停升 strong 档，与 .btn.accent 一致 */
}
.tgl :deep(.ant-switch-checked .ant-switch-handle::before) {
  background-color: var(--ctrl-accent-ink);
}
/* 海洋皮肤关掉时，开关跟着 .rows.off 一起淡下去，别还是亮着的 */
.tgl :deep(.ant-switch-disabled) {
  opacity: 0.5;
}
/* Ant 那圈 focus 蓝辉换成火星橙 */
.tgl :deep(.ant-switch:focus-visible) {
  outline: none;
  box-shadow: inset 0 0 0 1px var(--ctrl-accent-line), 0 0 0 3px rgba(255, 95, 55, 0.18);
}

/* —— 玻璃下拉（画质）—— 选中框本体；浮层见下面不带 scoped 的 style 块 */
.quality :deep(.ant-select-selector) {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--text-0);
  font-size: 13px;
  box-shadow: inset 0 1px 0 rgba(255, 250, 246, 0.08);
}
.quality :deep(.ant-select-selection-item),
.quality :deep(.ant-select-selection-placeholder) {
  color: var(--text-0);
  line-height: 24px;
}
.quality :deep(.ant-select-arrow) {
  color: var(--text-2);
}
.quality :deep(.ant-select:hover .ant-select-selector) {
  border-color: var(--line-strong);
}
.quality :deep(.ant-select-focused .ant-select-selector) {
  border-color: var(--accent-line);
  box-shadow: inset 0 1px 0 rgba(255, 250, 246, 0.08), 0 0 0 3px rgba(255, 95, 55, 0.18);
}

.note {
  margin: 14px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-2);
}
.note.warn {
  color: var(--danger);
}
/* 失败原因原文：等宽 + 允许折断，方便直接照着去查 */
.err {
  display: block;
  margin-top: 6px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-2);
  word-break: break-all;
}

.reset {
  width: 100%;
  margin-top: 12px;
  padding: 9px 0;
  border-radius: 11px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 12px;
  cursor: pointer;
  transition: var(--ease);
}
.reset:hover {
  border-color: var(--accent-line);
  color: var(--accent-ink);
  background: var(--accent-soft);
  transform: translateY(-2px);
}

/* —— 弹出动效 —— */
.skin-pop-enter-active,
.skin-pop-leave-active {
  transition: opacity 0.22s ease, transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.skin-pop-enter-from,
.skin-pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
}
</style>

<!-- 画质下拉的浮层被 Teleport 到 body，scoped 样式够不着，只能写成全局块。
     取色跟弹窗本体同一套：玻璃底 + 发丝描边 + 顶边高光，选中项 = 橙玻璃 soft 档。 -->
<style>
.glass-pop.ant-select-dropdown {
  padding: 4px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: var(--glass-sheen), var(--popup-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: var(--glass-edge), var(--shadow-pop);
}
.glass-pop .ant-select-item {
  color: var(--text-1);
  border-radius: 8px;
  font-size: 13px;
  padding: 6px 10px;
  min-height: 30px;
}
.glass-pop .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background-color: var(--bg-3);
  color: var(--text-0);
}
.glass-pop .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  background-color: transparent;
  background-image: var(--ctrl-accent-soft);
  color: var(--ctrl-accent-ink);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--ctrl-accent-line);
}
</style>
