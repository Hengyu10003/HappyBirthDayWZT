import './styles/main.css'
import { config } from './config.js'
import { Stage } from './core/stage.js'
import { Timeline } from './core/timeline.js'
import { ParticleSystem } from './fx/particles.js'
import { createStarField } from './fx/starField.js'
import { createStarWordsScene } from './scenes/starWords.js'
import { createCrownScene } from './scenes/crown.js'
import { createCakeScene } from './scenes/cake.js'

// 上面那行 import 已经把样式表注入了。摘掉 body 上的 booting —— 它负责在
// 样式表就位前藏住几处提示文字，避免首帧裸着闪一下（见 index.html 里的内联样式）
document.body.classList.remove('booting')

const dom = {
  back: document.getElementById('fx-back'),
  front: document.getElementById('fx-front'),
  wishHint: document.getElementById('wish-hint'),
  tapHint: document.getElementById('tap-hint'),
  playHint: document.getElementById('play-hint'),
  wishLines: document.getElementById('wish-lines'),
}

const stage = new Stage({ back: dom.back, front: dom.front })
stage.init()

// 容量要覆盖各处峰值：开场星尘组字（约 550）与蛋糕幕（约 2760 + 氛围 36 + 烟花）
const system = new ParticleSystem(3800)
// 常驻的碎片星野：全程铺在最底层当背景，不参与任何一幕的剧情
const starField = createStarField(260)
const runtime = { quality: 1 }

const deps = { stage, system, runtime, dom }
// 顺序：星尘汇聚组字（两段文字各需点一次）→ 蛋糕许愿放烟花 → 气球与自己放烟花（最后一幕）
const scenes = [createStarWordsScene(deps), createCakeScene(deps), createCrownScene(deps)]

const timeline = new Timeline(stage, { crossfade: 0.95 })
timeline.setScenes(scenes)

/* ---------------- 点击切换 ---------------- */

// 用 pointerdown 而不是 click：鼠标与触摸都能立刻响应，不必等 tap 判定。
// 最后一幕自己监听 pointerdown / pointerup 做「攥气球」，那边的监听在进入后
// 才挂上，所以两者不会互相抢事件。
document.addEventListener('pointerdown', () => timeline.advance())

/* ---------------- 主循环 ---------------- */

// 仅开发环境生效的调试开关：地址栏加 ?speed=4 可把整条时间线加速 4 倍，
// 这样改完效果不用再等两三分钟才能看到后半段
const timeScale = (() => {
  if (!import.meta.env.DEV) return 1
  const value = Number(new URLSearchParams(window.location.search).get('speed'))
  return Number.isFinite(value) && value > 0 ? Math.min(value, 12) : 1
})()

const bounds = { w: 0, h: 0 }
let slowTime = 0
let monitorTimer = 0
let tapHintShown = false

/** 当前这一幕播完、可以点击时，把「轻触继续」提示淡入 */
function syncTapHint() {
  const visible = timeline.clickable
  if (visible === tapHintShown) return
  tapHintShown = visible
  dom.tapHint.classList.toggle('is-on', visible)
}

/** 连续掉帧时下调粒子上限，保证动画整体流畅 */
function monitorPerformance(dt) {
  monitorTimer += dt
  if (monitorTimer < 0.5) return
  monitorTimer = 0

  if (stage.fps < config.performance.lowFpsThreshold) {
    slowTime += 0.5
  } else {
    slowTime = Math.max(0, slowTime - 0.5)
  }

  if (slowTime >= config.performance.lowFpsSeconds && runtime.quality > config.performance.lowFpsScale) {
    runtime.quality = config.performance.lowFpsScale
  }
}

stage.start((dt) => {
  const scaled = dt * timeScale
  bounds.w = stage.width
  bounds.h = stage.height

  system.update(scaled, bounds)
  starField.update(scaled, bounds)
  timeline.update(scaled)
  syncTapHint()

  stage.beginFrame('back')
  stage.beginFrame('front')
  // 碎片星野永远在所有场景之下
  starField.draw(stage.ctx.back, stage.dpr)
  timeline.draw('back')
  timeline.draw('front')

  monitorPerformance(dt)
})

timeline.start()
