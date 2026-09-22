import { config } from '../config.js'
import { SPARK, SHARD, LAYER_FRONT } from '../fx/particles.js'
import { sampleTextPoints } from '../fx/textPoints.js'
import { clamp, easeInOutCubic, shortestAngle } from '../core/math.js'

const OWNER = 'starWords'
const MS = 1000
const TAU = Math.PI * 2
const rand = (min, max) => min + Math.random() * (max - min)
const pick = (list) => list[(Math.random() * list.length) | 0]

/** 三维漂浮的范围与速度（归一化单位：1 约等于屏幕短边的一半） */
const FIELD = { x: 1.25, y: 0.85, z: 1 }
const DRIFT = 0.17

/**
 * 开场幕：几百颗星尘与时光碎片先散在三维空间里慢慢漂浮 —— 像宇宙里散落的星光；
 * 随后它们一颗颗平滑地飞向自己的位置，汇聚成「生日快乐 WZT」。
 * 观众点一下屏幕，同一批粒子再整体重排成「欢迎来到 20 岁」，再点一下才散开。
 *
 * 「三维」不需要任何 3D 库：每颗粒子有自己的 (x, y, z) 与漂移速度，
 * 每帧按透视投影成屏幕坐标，近处更大更亮、远处更小更暗，就有了纵深。
 */
export function createStarWordsScene({ stage, system, runtime }) {
  const cfg = config.scenes.starWords

  const floatUntil = cfg.floatUntil / MS
  const formStagger = cfg.formStagger / MS
  const travelTime = cfg.travelTime / MS
  const readSettle = cfg.readSettle / MS
  const scatterTime = cfg.scatterTime / MS
  // 全部粒子走完错位 + 飞行，再留一点时间让人看清，之后才允许点击
  const readyAt = floatUntil + formStagger + travelTime + readSettle
  // 从点击到第二段文字完全落位所需的时间
  const reformSettle = scatterTime + formStagger + travelTime + readSettle

  let nodes = []
  let spawned = false
  let phase = 'float' // float → formA → holdA → scatterA → holdB → gone
  let phaseAt = 0
  let centerX = 0
  let centerY = 0
  let camScale = 400
  let spacing = 10

  /** 把两段文字各采样成一组屏幕坐标目标点 */
  function sampleTargets() {
    const width = stage.width
    const height = stage.height
    const maxWidth = Math.min(width * 0.78, 900)
    // 字体直接取正文的计算样式，省得 CSS 与 JS 各写一份字体栈
    const fontFamily = getComputedStyle(document.body).fontFamily

    spacing = clamp(Math.min(width, height) / 58, 10, 17) / Math.sqrt(cfg.density)

    const options = {
      fontFamily,
      maxWidth,
      spacing,
      maxPoints: Math.max(60, Math.round(cfg.maxPoints * runtime.quality)),
    }

    return [config.texts.greeting, config.texts.welcome].map((text) => {
      const sampled = sampleTextPoints(text, options)
      const originX = width / 2 - sampled.width / 2
      const originY = height / 2 - sampled.height / 2
      return sampled.points.map((p) => ({ x: originX + p.x, y: originY + p.y, angle: p.angle }))
    })
  }

  function spawn() {
    centerX = stage.width / 2
    centerY = stage.height / 2
    camScale = Math.min(stage.width, stage.height) * 0.62

    const [first, second] = sampleTargets()
    const count = Math.max(first.length, second.length, 1)
    const seeds = []
    const items = []

    for (let i = 0; i < count; i++) {
      const a = first[i % first.length]
      const b = second[i % second.length]
      const isShard = Math.random() < cfg.shardRatio
      // 星尘是锐利的光点，时光碎片是细长的菱形，后者要给大一点才看得出形状
      const size = spacing * (isShard ? rand(1.8, 2.4) : rand(1.2, 1.6)) * cfg.particleScale

      const x3 = rand(-FIELD.x, FIELD.x)
      const y3 = rand(-FIELD.y, FIELD.y)
      const z3 = rand(-FIELD.z, FIELD.z)
      const depth = (z3 + FIELD.z) / (2 * FIELD.z)
      const persp = 0.55 + 0.45 * depth

      seeds.push({
        x3,
        y3,
        z3,
        vx3: rand(-DRIFT, DRIFT),
        vy3: rand(-DRIFT, DRIFT),
        vz3: rand(-DRIFT, DRIFT),
        ax: a.x,
        ay: a.y,
        bx: b.x,
        by: b.y,
        lockX: a.x,
        lockY: a.y,
        // 碎片顺着所在笔画的走向躺：细长菱形横躺会把纵向笔画切出缺口。
        // 采样给出的 angle 是笔画方向，精灵的长轴在局部 +y，所以加 π/2
        rotA: a.angle === null ? rand(-0.6, 0.6) : a.angle + Math.PI / 2,
        rotB: b.angle === null ? rand(-0.6, 0.6) : b.angle + Math.PI / 2,
        rotJitter: rand(-0.16, 0.16),
        rotTarget: 0,
        wobble: rand(0.6, 1.3),
        wobblePhase: rand(0, TAU),
        baseSize: size,
        baseAlpha: rand(0.7, 1),
        // 每颗粒子各自什么时候开始汇聚，形成「一颗颗飞过去汇成字」的过程
        convergeAt: floatUntil + rand(0, formStagger),
        // 汇聚轨迹的起点与出发时刻；Infinity 表示还没开始走
        fromX: 0,
        fromY: 0,
        travelStart: Infinity,
      })

      items.push({
        kind: isShard ? SHARD : SPARK,
        x: centerX + x3 * camScale * persp,
        y: centerY + y3 * camScale * persp,
        targetX: a.x,
        targetY: a.y,
        size: size * persp,
        color: pick(config.colors.starText),
        alpha: 1,
        fadeIn: rand(0.5, 1.1),
        delay: 0,
        tag: isShard ? 'shard' : 'dust',
        layer: LAYER_FRONT,
      })
    }

    const created = system.emitHoming(OWNER, items, {
      pull: 0.3, // 跟随要够紧，漂浮时才有「被牵引」的实感
      life: 4e5,
      shardBox: 36,
    })

    nodes = seeds.map((seed, i) => Object.assign(seed, { p: created[i] }))
  }

  /** 把目标点切到某一段文字；各颗粒子在轮到自己（convergeAt）时自行起飞 */
  function lockTo(second) {
    for (const node of nodes) {
      const p = node.p
      node.lockX = second ? node.bx : node.ax
      node.lockY = second ? node.by : node.ay
      node.rotTarget = (second ? node.rotB : node.rotA) + node.rotJitter
      if (p) p.pull = 0.3
    }
  }

  /** 每帧推进：还没轮到的继续在三维里漂，轮到的沿缓入缓出的轨迹飞向自己的位置 */
  function advanceParticles(dt, elapsed) {
    const zSpan = 2 * FIELD.z
    const forming = elapsed >= floatUntil

    for (const node of nodes) {
      const p = node.p
      if (!p || !p.alive) continue

      const travelling = node.travelStart !== Infinity

      if (!travelling && (!forming || elapsed < node.convergeAt)) {
        node.x3 += node.vx3 * dt
        node.y3 += node.vy3 * dt
        node.z3 += node.vz3 * dt

        // 软边界：撞到就往回送，并顺手把位置收进范围，避免卡在边界上抖
        if (node.x3 > FIELD.x) {
          node.x3 = FIELD.x
          node.vx3 = -Math.abs(node.vx3)
        } else if (node.x3 < -FIELD.x) {
          node.x3 = -FIELD.x
          node.vx3 = Math.abs(node.vx3)
        }
        if (node.y3 > FIELD.y) {
          node.y3 = FIELD.y
          node.vy3 = -Math.abs(node.vy3)
        } else if (node.y3 < -FIELD.y) {
          node.y3 = -FIELD.y
          node.vy3 = Math.abs(node.vy3)
        }
        if (node.z3 > FIELD.z) {
          node.z3 = FIELD.z
          node.vz3 = -Math.abs(node.vz3)
        } else if (node.z3 < -FIELD.z) {
          node.z3 = -FIELD.z
          node.vz3 = Math.abs(node.vz3)
        }

        const depth = (node.z3 + FIELD.z) / zSpan
        const persp = 0.55 + 0.45 * depth
        p.targetX = centerX + node.x3 * camScale * persp
        p.targetY = centerY + node.y3 * camScale * persp
        // 用缓动而不是直接赋值：文字散回粒子时，尺寸与亮度才会平滑地淡下去
        p.size += (node.baseSize * persp - p.size) * Math.min(1, dt * 3)
        p.alpha += (node.baseAlpha * (0.35 + 0.65 * depth) - p.alpha) * Math.min(1, dt * 3)
        p.rot += p.vr * dt
        continue
      }

      // 刚轮到自己：记下当前所在位置，作为这段缓动轨迹的起点
      if (!travelling) {
        node.fromX = p.x
        node.fromY = p.y
        node.travelStart = elapsed
      }

      // 缓入缓出：起步慢、中间快、收尾再慢下来，不会「窜」到目标点
      const progress = clamp((elapsed - node.travelStart) / travelTime, 0, 1)
      const eased = easeInOutCubic(progress)
      const breath = progress >= 1 ? 1.2 : 0

      p.targetX =
        node.fromX +
        (node.lockX - node.fromX) * eased +
        Math.sin(elapsed * node.wobble + node.wobblePhase) * breath
      p.targetY =
        node.fromY +
        (node.lockY - node.fromY) * eased +
        Math.cos(elapsed * node.wobble * 0.82 + node.wobblePhase) * breath

      // 尺寸与亮度一并归一到成字状态（从远处飞来时会同时收小、变实）
      p.size += (node.baseSize - p.size) * Math.min(1, dt * 3)
      p.alpha += (node.baseAlpha - p.alpha) * Math.min(1, dt * 3)

      // 途中就开始把碎片转向所在笔画的走向，落位时正好贴合
      p.rot += p.vr * dt
      p.vr += (0 - p.vr) * Math.min(1, dt * 2.5)
      p.rot += shortestAngle(p.rot, node.rotTarget) * Math.min(1, dt * 3)
    }
  }

  /**
   * 散开回到漂浮状态：沿用原来的纵深，把当前屏幕位置反投影回三维坐标，
   * 所以散开是「就地散」而不是跳回原位。之后各颗粒子会在新的 convergeAt
   * 时刻，重新沿缓入缓出的轨迹汇聚到第二段文字。
   */
  function releaseToFloat(elapsed) {
    for (const node of nodes) {
      const p = node.p
      if (!p) continue

      const depth = (node.z3 + FIELD.z) / (2 * FIELD.z)
      const persp = 0.55 + 0.45 * depth
      node.x3 = (p.x - centerX) / (camScale * persp)
      node.y3 = (p.y - centerY) / (camScale * persp)

      node.travelStart = Infinity
      node.convergeAt = elapsed + scatterTime + rand(0, formStagger)
    }
  }

  /** 散开：脱离归位状态，向四周飘走并淡出 */
  function dissolve() {
    for (const node of nodes) {
      const p = node.p
      if (!p) continue
      const dx = p.x - centerX
      const dy = p.y - centerY
      const distance = Math.hypot(dx, dy) || 1

      p.homing = false
      p.settle = false
      p.pull = 0
      p.vx = (dx / distance) * rand(26, 80) + rand(-16, 16)
      p.vy = (dy / distance) * rand(26, 80) - rand(0, 24) // 略微向上飘走
      p.fadeOut = 2.4
      p.maxLife = p.life + rand(2.4, 3.6)
      if (p.kind === SHARD) {
        p.swayAmp = rand(16, 42)
        p.swayFreq = rand(0.5, 1.3)
        p.vr = rand(-1.2, 1.2)
      }
    }
  }

  return {
    name: OWNER,

    enter() {
      nodes = []
      spawned = false
      phase = 'float'
      phaseAt = 0
    },

    /** 等所有粒子都汇聚完、字迹稳下来之后才接受点击 */
    isClickable() {
      return phase === 'holdA' || phase === 'holdB'
    },

    /** 第一次点击让文字散回粒子、再重新汇聚成第二段；第二次点击直接散开并放行换幕 */
    onClick(elapsed) {
      if (phase === 'holdA') {
        // 目标点先切到第二段文字，再让粒子散回漂浮态；过一会儿它们会自己重新汇聚
        lockTo(true)
        releaseToFloat(elapsed)
        phase = 'scatterA'
        phaseAt = elapsed
        return 'consume'
      }

      dissolve()
      phase = 'gone'
      return 'pass'
    },

    update(dt, elapsed) {
      if (!spawned) {
        spawned = true
        spawn()
      }

      if (phase === 'float' && elapsed >= floatUntil) {
        phase = 'formA'
        phaseAt = elapsed
        lockTo(false)
      }

      if (phase === 'formA' && elapsed >= readyAt) {
        phase = 'holdA'
        phaseAt = elapsed
      }

      // 散回漂浮之后，等所有粒子重新汇聚、站稳，才允许下一次点击
      if (phase === 'scatterA' && elapsed - phaseAt >= reformSettle) {
        phase = 'holdB'
        phaseAt = elapsed
      }

      if (phase === 'gone') return

      advanceParticles(dt, elapsed)
    },

    draw(ctx, alpha, layer) {
      if (layer !== 'front') return
      system.draw(ctx, alpha, LAYER_FRONT, stage.dpr)
    },

    exit() {
      system.releaseByOwner(OWNER)
    },
  }
}
