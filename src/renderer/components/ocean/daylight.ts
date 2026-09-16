/**
 * 日光刻度（0~100）与时段名的对应关系 —— 与 open-sea-skin 的 timeOfDayLabel 一致。
 *
 * 单独放一个文件是为了让控制弹窗能显示时段名，又不必把 three 那套引擎拉进主包：
 * 弹窗静态 import 这里（纯函数，零依赖），引擎在动态 chunk 里 import 同一份。
 */

/** 日光刻度分档：黄昏 → 金红时刻 → 午后 → 正午 */
export function daylightLabel(daylight: number): string {
  const t = daylight / 100
  if (t < 0.12) return '黄昏'
  if (t < 0.3) return '金红时刻'
  if (t < 0.62) return '午后'
  return '正午'
}
