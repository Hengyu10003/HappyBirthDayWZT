import { config } from '../config.js'
import { LAYER_BACK, LAYER_FRONT } from '../fx/particles.js'
import { createCakePoints, MODEL_HEIGHT } from '../fx/cakeShape.js'
import { clamp } from '../core/math.js'

const OWNER = 'cake'
const MS = 1000
const TAU = Math.PI * 2
const rand = (min, max) => min + Math.random() * (max - min)

/**
 * 蛋糕幕：星光从屏幕各处飞向中央，凝成一座由参数方程定义的三维蛋糕，
 * 随后整体绕竖轴缓慢旋转。蜡烛点亮、提示许愿，过一会儿自动吹灭，
 * 接着整个画面绽放烟花。烟花放完才允许点击进入最后一幕。
 *
 * 旋转的实现很轻：模型是旋转体，每帧把三维坐标绕竖轴转一个角度，
 * 再投影成屏幕坐标、按深度调整大小与亮度 —— 不需要任何 3D 库。
 */
export function createCakeScene({ stage, system, runtime, dom }) {
  const cfg = config.scenes.cake

  const gatherStart = cfg.gatherStart / MS
  const candleAt = cfg.candleLightAt / MS
  const hintAt = cfg.hintAt / MS
  const wishDeadline = hintAt + cfg.wishDuration / MS
  const flameOut = cfg.flameOut / MS
  const fireworkDuration = cfg.fireworkDuration / MS
  const fireworkInterval = fireworkDuration / cfg.fireworkBursts

  let nodes = []
  let flameNodes = []
  let scale = 360
  let centerX = 0
  let centerY = 0
  let spawned = false
  let litProgress = 0
  let wishedAt = -1
  let fireworksLeft = 0
  let fireworkTimer = 0
  let hintShown = false
  let hintHidden = false
  let angle = 0

  function measure() {
    // 归一化模型高约 1.04、宽约 1.04，scale 就是「归一化单位 → 像素」的换算
    scale = Math.min(stage.width * 0.52, stage.height * 0.52)
    centerX = stage.width / 2
    centerY = stage.height * 0.5
  }

  function spawnCake() {
    measure()
    const { points } = createCakePoints()
    const maxDelay = cfg.gatherDelay / MS
    const items = []

    nodes = points.map((pt) => {
      const pad = pt.size * scale
      items.push({
        x: rand(pad, stage.width - pad),
        y: rand(pad, stage.height - pad),
        targetX: centerX,
        targetY: centerY,
        size: pt.size * scale,
        color: pt.color,
        alpha: pt.tag === 'flame' ? 0 : pt.alpha, // 火苗先不着，等点烛时再亮
        fadeIn: 0.35,
        delay: rand(0.05, maxDelay),
        tag: pt.tag,
      })

      return {
        x3: pt.x,
        y3: pt.y,
        z3: pt.z,
        baseSize: pt.size,
        baseAlpha: pt.alpha,
        tag: pt.tag,
        phase: rand(0, TAU),
        // 只有一部分粒子会缓慢飘散，飘完淡出、再回到原位
        driftRate: Math.random() < cfg.driftRatio ? rand(0.05, 0.11) : 0,
        driftPhase: rand(0, 1),
      }
    })

    const created = system.emitHoming(OWNER, items, { layer: LAYER_FRONT })
    // emitHoming 返回的粒子与 items 一一对应，绑回去即可
    nodes = nodes.map((node, i) => Object.assign(node, { p: created[i] }))
    flameNodes = nodes.filter((node) => node.tag === 'flame')

    system.emitStarlight(OWNER, Math.round(cfg.ambientSparks * runtime.quality), stage.width, stage.height, {
      centerBias: 0.1,
      speed: 6,
      life: [4e5, 4e5],
      alpha: 0.34,
      sizeRange: [8, 22],
      topInset: 0,
    })
  }

  /** 把三维点云绕竖轴转 angle、投影到屏幕，并写回每颗粒子的目标位置 */
  function project(elapsed) {
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    const halfHeight = MODEL_HEIGHT / 2
    const tilt = cfg.tilt
    const jitter = cfg.jitter
    const flameLit = litProgress

    for (const node of nodes) {
      const p = node.p
      // 已经被放开自由飞行的粒子（比如吹灭后的火苗）不再接受牵引
      if (!p || !p.alive || !p.homing) continue

      // 绕竖轴旋转
      const rx = node.x3 * ca - node.z3 * sa
      const rz = node.x3 * sa + node.z3 * ca
      const depth = clamp(rz / 0.55, -1, 1) // 越靠前越大越亮

      // 轻微随机抖动：让轮廓不是死板的几何线
      const t = elapsed + node.phase
      let offsetX = Math.sin(t * 1.6) * jitter
      let offsetY = Math.cos(t * 2.1 + 1.7) * jitter

      // 部分粒子缓慢飘散：向上飘、后段淡出，到周期末尾已不可见，再回到原位
      let fade = 1
      if (node.driftRate > 0) {
        const d = (elapsed * node.driftRate + node.driftPhase) % 1
        const fadeIn = clamp(d / 0.18, 0, 1)
        const fadeOut = d < 0.45 ? 1 : clamp(1 - (d - 0.45) / 0.25, 0, 1)
        fade = fadeIn * fadeOut
        const drift = Math.min(d, 0.7) * 0.12 * scale
        offsetY -= drift
        offsetX += Math.sin(t * 0.7) * drift * 0.5
      }

      p.targetX = centerX + rx * scale + offsetX
      p.targetY = centerY - (node.y3 - halfHeight) * scale + rz * scale * tilt + offsetY
      p.size = node.baseSize * scale * (1 + depth * 0.22)
      p.alpha = node.baseAlpha * (0.55 + 0.45 * (depth + 1) * 0.5) * fade * (node.tag === 'flame' ? flameLit : 1)
    }
  }

  /** 吹灭：火苗脱开原位、向上飘散 */
  function blowOutFlames() {
    for (const node of flameNodes) {
      const p = node.p
      if (!p) continue
      p.homing = false
      p.settle = false
      p.pull = 0
      p.vx = rand(-16, 16)
      p.vy = -rand(58, 96)
      p.gravity = -20
      p.alpha = node.baseAlpha
      p.maxLife = p.life + flameOut
      p.fadeOut = flameOut
    }
  }

  /** 一缕光自蛋糕顶端升腾 */
  function emitRise() {
    system.emitBurst(OWNER, centerX, centerY - 0.5 * scale, 18, config.colors.cake.flame, {
      speedRange: [10, 42],
      gravityRange: [-18, -6],
      lifeRange: [1.6, 2.7],
      sizeRange: [16, 30],
      upwardBias: 40,
    })
  }

  /** 全屏烟花：在画面各处的随机位置炸开一簇星光，合起来覆盖整个屏幕 */
  function emitFirework() {
    system.emitBurst(
      OWNER,
      rand(stage.width * 0.12, stage.width * 0.88),
      rand(stage.height * 0.12, stage.height * 0.62),
      Math.round(cfg.sparkPerFirework * runtime.quality),
      config.colors.spark,
      {
        speedRange: [120, 380],
        gravityRange: [40, 86],
        lifeRange: [1.7, 3.0],
        sizeRange: [10, 26],
        upwardBias: 40,
      },
    )
  }

  function startWish(at) {
    wishedAt = at
    blowOutFlames()
    emitRise()
    fireworksLeft = Math.round(cfg.fireworkBursts * runtime.quality)
    fireworkTimer = 0
  }

  return {
    name: OWNER,

    async enter() {
      stage.onResize(measure)

      nodes = []
      flameNodes = []
      spawned = false
      litProgress = 0
      wishedAt = -1
      fireworksLeft = 0
      hintShown = false
      hintHidden = false
      angle = 0

      measure()
    },

    /** 「轻触继续」和烟花同时出现：烟花一炸开就允许点击进入最后一幕 */
    isClickable() {
      return wishedAt >= 0
    },

    update(dt, elapsed) {
      if (!spawned) {
        if (elapsed < gatherStart) return
        spawned = true
        spawnCake()
      }

      angle += cfg.rotateSpeed * dt

      if (elapsed >= candleAt) {
        litProgress = clamp((elapsed - candleAt) / 0.6, 0, 1)
      }

      project(elapsed)

      if (!hintShown && elapsed >= hintAt) {
        hintShown = true
        dom.wishHint.classList.add('is-on')
      }

      if (wishedAt < 0 && elapsed >= wishDeadline) startWish(elapsed)

      if (wishedAt >= 0) {
        if (!hintHidden) {
          hintHidden = true
          dom.wishHint.classList.remove('is-on')
        }

        if (fireworksLeft > 0) {
          fireworkTimer -= dt
          if (fireworkTimer <= 0) {
            fireworkTimer = fireworkInterval
            fireworksLeft -= 1
            emitFirework()
          }
        }
      }
    },

    draw(ctx, alpha, layer) {
      const target = layer === 'front' ? LAYER_FRONT : LAYER_BACK
      system.draw(ctx, alpha, target, stage.dpr)
    },

    exit() {
      system.releaseByOwner(OWNER)
      dom.wishHint.classList.remove('is-on')
    },
  }
}
