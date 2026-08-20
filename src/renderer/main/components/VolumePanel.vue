<script setup lang="ts">
import { store } from '../store'

const v = store.state.volumes

function onChange() {
  store.applyVolumes()
}
</script>

<template>
  <div class="vol glass">
    <div class="row">
      <span class="label">原唱音量</span>
      <a-slider
        :value="v.orig * 100"
        :min="0"
        :max="100"
        @change="(val: number) => { v.orig = val / 100; onChange() }"
      />
      <span class="val">{{ Math.round(v.orig * 100) }}</span>
    </div>
    <div class="row">
      <span class="label">伴奏音量</span>
      <a-slider
        :value="v.accomp * 100"
        :min="0"
        :max="100"
        @change="(val: number) => { v.accomp = val / 100; onChange() }"
      />
      <span class="val">{{ Math.round(v.accomp * 100) }}</span>
    </div>
    <div class="row">
      <span class="label">总音量</span>
      <a-slider
        :value="v.master * 100"
        :min="0"
        :max="100"
        @change="(val: number) => { v.master = val / 100; onChange() }"
      />
      <span class="val">{{ Math.round(v.master * 100) }}</span>
    </div>
  </div>
</template>

<style scoped>
.vol {
  padding: 14px 18px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.label {
  width: 64px;
  font-size: 13px;
  color: var(--text-1);
}
.val {
  width: 30px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--neon-2);
  font-size: 13px;
}
:deep(.ant-slider-track) {
  background: linear-gradient(92deg, var(--neon), var(--neon-3));
}
:deep(.ant-slider-handle::after) {
  box-shadow: 0 0 0 2px var(--neon);
}
</style>
