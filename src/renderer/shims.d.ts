/**
 * 缺类型的依赖与静态资源的补充声明。
 *
 * 放在 renderer 下只是因为 tsconfig 的 include 覆盖了这里 —— declare module 是全局的，
 * 文件位置不影响生效。
 *
 * 注意：本文件不能出现 import / export，否则会被当成模块，下面的 declare module 会
 * 退化成「模块增强」并报「找不到模块」。
 */

/* —— three ——
   three 0.178 的 npm 包不带 TS 类型（package.json 没有 types 字段，build/ 下也没有
   .d.ts），webgpu / tsl / addons 三个入口在 IDE 里会整片报红。这里置为宽松 any，
   只影响这几个入口，其它模块的类型检查不受牵连。 */
declare module 'three/webgpu'
declare module 'three/tsl'
declare module 'three/addons/tsl/display/BloomNode.js'

/* —— 构建插件 —— postcss-pxtorem 未随包提供类型声明 */
declare module 'postcss-pxtorem'

/* —— 静态资源 ——
   tsconfig 的 types 只列了 node，没带 vite/client，所以图片导入需要自己声明。 */
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}
