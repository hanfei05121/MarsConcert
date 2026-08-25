import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from './store'

/**
 * 点歌台路由：
 * 每个主视图一个路由，App.vue 只负责布局，内容通过 <router-view> 出口渲染。
 * 使用 hash 模式，兼容 Electron 打包后 file:// 协议加载。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/recommend' },
    { path: '/recommend', name: 'recommend', component: () => import('./views/RecommendView.vue') },
    { path: '/artists', name: 'artists', component: () => import('./views/ArtistsView.vue') },
    { path: '/category', name: 'category', component: () => import('./views/CategoryView.vue') },
    { path: '/playlists', name: 'playlists', component: () => import('./views/PlaylistsView.vue') },
    { path: '/search', name: 'search', component: () => import('./views/SearchView.vue') },
    { path: '/mine', name: 'mine', component: () => import('./views/MineView.vue') }
  ]
})

// 切换主视图时重置详情筛选，与原 store.navigate / store.back 的行为一致
router.afterEach(() => {
  store.resetFilters()
})

export default router