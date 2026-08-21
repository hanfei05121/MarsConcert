// 生成演示素材库：D:/song-lib/<歌名>/{video.mp4, orig.m4a, accomp.m4a, orig.lrc}
// 若本机已安装 ffmpeg，会自动生成测试素材，便于直接体验播放 + 歌词 + 原唱/伴奏切换。
// 素材规范（单视频 + 双音频）：video.mp4 只有画面（无音轨），orig.m4a 原唱、accomp.m4a 伴奏。
// 用法：npm run sample
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const LIB = 'D:/song-lib'

const samples = [
  {
    name: '稻香',
    artist: '周杰伦',
    lrc: [
      '[ti:稻香]',
      '[ar:周杰伦]',
      '[00:00.00]稻香 - 周杰伦',
      '[00:04.50]对这个世界如果你有太多的抱怨',
      '[00:09.20]跌倒了 就不敢继续往前走',
      '[00:14.00]为什么 人要这么的脆弱 堕落',
      '[00:19.00]请你打开电视看看',
      '[00:23.50]多少人为生命在努力勇敢的走下去',
      '[00:28.80]我们是不是该知足',
      '[00:33.00]珍惜一切 就算没有拥有',
      '[00:38.50]还记得你说家是唯一的城堡',
      '[00:43.20]随着稻香河流继续奔跑',
      '[00:48.00]微微笑 小时候的梦我知道',
      '[00:53.00]不要哭让萤火虫带着你逃跑',
      '[00:58.00]乡间的歌谣 永远的依靠',
      '[01:03.50]回家吧 回到最初的美好'
    ].join('\n')
  },
  {
    name: '晴天',
    artist: '周杰伦',
    lrc: [
      '[ti:晴天]',
      '[ar:周杰伦]',
      '[00:00.00]晴天 - 周杰伦',
      '[00:03.80]故事的小黄花',
      '[00:07.50]从出生那年就飘着',
      '[00:11.20]童年的荡秋千',
      '[00:14.90]随记忆一直晃到现在',
      '[00:18.60]吹着前奏 望着天空',
      '[00:22.30]我想起花瓣试着掉落',
      '[00:26.00]为你翘课的那一天',
      '[00:29.70]花落的那一天',
      '[00:33.40]教室的那一间',
      '[00:37.10]我怎么看不见',
      '[00:40.80]消失的下雨天',
      '[00:44.50]我好想再淋一遍'
    ].join('\n')
  }
]

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

mkdirSync(LIB, { recursive: true })
const withFfmpeg = hasFfmpeg()
console.log(
  withFfmpeg
    ? '检测到 ffmpeg，将生成测试素材（video.mp4 + orig.m4a + accomp.m4a）。'
    : '未检测到 ffmpeg，仅生成歌词文件（请自行放入 video.mp4 / orig.m4a / accomp.m4a）。'
)

for (const s of samples) {
  const dir = join(LIB, s.name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'orig.lrc'), s.lrc, 'utf-8')
  console.log(`✓ 歌词: ${dir}/orig.lrc`)

  if (withFfmpeg) {
    try {
      // 1) 视频画面：纯视频流、无音轨（-an），70 秒测试图，时长覆盖歌词
      const video = join(dir, 'video.mp4')
      execSync(
        `ffmpeg -y -f lavfi -i testsrc=size=1280x720:rate=25 -t 70 -pix_fmt yuv420p -c:v libx264 -an "${video}"`,
        { stdio: 'ignore' }
      )
      console.log(`✓ 视频: ${video}（无音轨）`)

      // 2) 原唱音频：440Hz 正弦音（AAC）
      const orig = join(dir, 'orig.m4a')
      execSync(
        `ffmpeg -y -f lavfi -i sine=frequency=440:duration=70 -c:a aac "${orig}"`,
        { stdio: 'ignore' }
      )
      console.log(`✓ 原唱: ${orig}`)

      // 3) 伴奏音频：220Hz 正弦音（AAC），与原唱音高不同，方便听出切换
      const accomp = join(dir, 'accomp.m4a')
      execSync(
        `ffmpeg -y -f lavfi -i sine=frequency=220:duration=70 -c:a aac "${accomp}"`,
        { stdio: 'ignore' }
      )
      console.log(`✓ 伴奏: ${accomp}`)
    } catch (e) {
      console.warn(`生成素材失败（${s.name}），请手动放入 video.mp4 / orig.m4a / accomp.m4a。`, e.message)
    }
  }
}

console.log(`\n完成。素材库位置：${LIB}`)
console.log('回到应用点击「重新扫描」即可加载。')
