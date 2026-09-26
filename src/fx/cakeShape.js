import { config } from '../config.js'

/**
 * 生日蛋糕点阵：用参数方程定义一个旋转体，而不是去描 2D 轮廓。
 *
 * 每一层都是标准旋转体 —— 半径只跟高度有关，于是有
 *     P(φ, y) = ( r(y)·cosφ , y , r(y)·sinφ )
 * 模型本身就是 3D 的，渲染端只要绕竖轴旋转 + 做一次透视投影，
 * 就能得到「整体缓慢旋转」的观感，全程不需要任何 3D 库。
 *
 * 取点策略：
 *   1. 每层顶面圆环 —— 旋转体的顶棱，负责发光描边（带波浪起伏，兼作旋转的视觉线索）
 *   2. 每层顶面圆盘 —— 交代「这是个有顶面的立体」，否则会像一串圆环
 *   3. 竖向肋线 + 侧表面铺点 —— 侧面要有足够密度，转起来才读得出体积
 *   4. 悬浮彩带 —— 在蛋糕外侧边升边绕的螺旋，用密集光点连成
 *   5. 托盘一圈、顶部一根金色蜡烛、一簇火苗
 *
 * 注意：严格的旋转体是轴对称的，等距撒点 + 等角肋线转起来与静止毫无区别。
 * 所以这里的点距带随机扰动、单点尺寸差异也拉大，转动时才能看出「珠子在走」。
 *
 * 坐标是归一化的（模型高约 1.04），由渲染端统一缩放到屏幕像素。
 */

const TAU = Math.PI * 2
const rand = (min, max) => min + Math.random() * (max - min)
const pick = (list) => list[(Math.random() * list.length) | 0]

const TIERS = [
  { y0: 0.02, y1: 0.3, r: 0.42 },
  { y0: 0.3, y1: 0.55, r: 0.3 },
  { y0: 0.55, y1: 0.78, r: 0.18 },
]

const PLATE = { y: 0, r: 0.52 }
const CANDLE = { y0: 0.78, y1: 0.95, r: 0.03 }
const FLAME = { y0: 0.95, y1: 1.04, r: 0.048 }

const RING_SPACING = 0.02 // 圆环上的点距（归一化），约等于一颗粒子的直径
const RING_WAVE = 0.018 // 顶棱的波浪幅度，转动时这道浪会走
const RIB_COUNT = 56
const RIB_HEIGHTS = [0.22, 0.5, 0.78] // 每条肋在层高上的取点位置
const TOP_FILL = 120 // 每层顶面的填充点数
const SIDE_FILL = 416 // 每层侧面的填充点数
const PLATE_FILL = 90 // 托盘顶面的填充点数
const RIBBON_COUNT = 8 // 悬浮彩带的条数
const RIBBON_SPACING = 0.034 // 彩带上的点距：仍比蛋糕本体（约 0.063）密近一倍
const RIBBON_GAP = 0.2 // 彩带浮在蛋糕表面之外多远
const RIBBON_MIN_RADIUS = 0.34 // 半径下限，免得越往上彩带越往轴心收、最后戳进蜡烛

/** 模型总高，渲染端用它把蛋糕在屏幕上居中对齐 */
export const MODEL_HEIGHT = FLAME.y1

/**
 * @returns {{points: Array<{x:number,y:number,z:number,size:number,color:string,alpha:number,tag:string}>, height:number}}
 */
export function createCakePoints() {
  const colors = config.colors.cake
  const points = []

  const push = (x, y, z, size, color, alpha, tag) => {
    points.push({ x, y, z, size, color, alpha, tag })
  }

  /** 一圈圆环：点距带随机扰动、单点尺寸拉开差异，转动时才看得出珠子在走 */
  const ring = (radius, y, sizeMin, sizeMax, color, alpha, tag, wave = 0, spacing = RING_SPACING) => {
    const count = Math.max(6, Math.round((TAU * radius) / spacing))
    for (let i = 0; i < count; i++) {
      const phi = ((i + rand(-0.35, 0.35)) / count) * TAU
      push(
        Math.cos(phi) * radius + rand(-0.002, 0.002),
        y + (wave ? Math.sin(phi * 8) * wave : 0),
        Math.sin(phi) * radius + rand(-0.002, 0.002),
        rand(sizeMin, sizeMax),
        color,
        alpha,
        tag,
      )
    }
  }

  // 托盘：外圈加密 + 一圈内圈 + 顶面铺点，做成一个有厚度、有盘面的金色托盘
  ring(PLATE.r, PLATE.y, 0.028, 0.04, pick(colors.plate), 0.9, 'plate', 0, RING_SPACING * 0.5)
  ring(PLATE.r * 0.82, PLATE.y + 0.008, 0.02, 0.03, pick(colors.plate), 0.6, 'plate', 0, 0.06)
  for (let i = 0; i < PLATE_FILL; i++) {
    const phi = rand(0, TAU)
    const radius = Math.sqrt(Math.random()) * PLATE.r * 0.78
    push(
      Math.cos(phi) * radius,
      PLATE.y + 0.006,
      Math.sin(phi) * radius,
      rand(0.012, 0.022),
      pick(colors.plate),
      rand(0.18, 0.34),
      'plate',
    )
  }

  for (const tier of TIERS) {
    // 顶棱：最亮最实，负责蛋糕的发光描边；带波浪。
    // 点距与单点尺寸都减半 —— 换成两倍数量、更细的颗粒，轮廓才是「细闪」而不是一串大珠子
    ring(tier.r, tier.y1, 0.014, 0.026, pick(colors.outline), 1, 'ring', RING_WAVE)

    // 顶面圆盘：让每一层读起来是实心的，而不是一圈线
    for (let i = 0; i < TOP_FILL; i++) {
      const phi = rand(0, TAU)
      const radius = Math.sqrt(Math.random()) * tier.r * 0.9
      push(
        Math.cos(phi) * radius,
        tier.y1 - 0.003,
        Math.sin(phi) * radius,
        rand(0.018, 0.03),
        pick(colors.top),
        0.5,
        'top',
      )
    }

    // 竖向肋线：每条肋在层高上取几个点，角度带随机偏移
    for (let i = 0; i < RIB_COUNT; i++) {
      const phi = (i / RIB_COUNT) * TAU + rand(-0.16, 0.16)
      for (const t of RIB_HEIGHTS) {
        const y = tier.y0 + (tier.y1 - tier.y0) * t
        push(
          Math.cos(phi) * tier.r,
          y,
          Math.sin(phi) * tier.r,
          rand(0.02, 0.032),
          pick(colors.surface),
          0.72,
          'rib',
        )
      }
    }

    // 侧面填充：把整个侧表面铺满。这一步才是「看起来是立体的」的关键 ——
    // 只靠顶棱与肋线，旋转起来读到的是一圈线，而不是一块有体积的面。
    // 颗粒调细、数量翻倍，近看是密密的细闪，远看仍是一整块面
    for (let i = 0; i < SIDE_FILL; i++) {
      const phi = rand(0, TAU)
      const y = rand(tier.y0 + 0.02, tier.y1 - 0.01)
      push(
        Math.cos(phi) * tier.r,
        y,
        Math.sin(phi) * tier.r,
        rand(0.008, 0.016),
        pick(colors.surface),
        rand(0.26, 0.44), // 明暗随机，表面才有颗粒感而不是一片均匀
        'fill',
      )
    }
  }

  /** 给定高度处的蛋糕半径，彩带据此判断该浮在多远 */
  const radiusAt = (y) => {
    for (const tier of TIERS) if (y <= tier.y1) return tier.r
    return CANDLE.r
  }

  // 悬浮彩带：一条条在蛋糕外侧边升边绕的螺旋，半径与高度都带波动，
  // 读起来像飘着的彩带，而不是绕在蛋糕上的铁丝。由密集光点连成，不画线。
  for (let k = 0; k < RIBBON_COUNT; k++) {
    const phi0 = (k / RIBBON_COUNT) * TAU + rand(-0.5, 0.5)
    const yStart = rand(0.06, 0.3)
    const yEnd = rand(0.82, 0.96)
    const turns = 0.6 + rand(0, 0.4)
    const waveRadius = rand(0.07, 0.14) // 半径波动，彩带才会一进一出
    const color = pick(colors.ribbon)

    const at = (t) => {
      const y = yStart + (yEnd - yStart) * t + Math.sin(t * TAU * 2) * 0.025
      const base = Math.max(radiusAt(y), RIBBON_MIN_RADIUS)
      const radius = base + RIBBON_GAP + Math.sin(t * TAU * 1.5) * waveRadius
      const phi = phi0 + turns * TAU * t
      return { x: Math.cos(phi) * radius, y, z: Math.sin(phi) * radius }
    }

    // 先量一遍曲线长度，再按固定点距取点，免得拐弯处点变稀、带子断成虚线
    const steps = 160
    let length = 0
    let prev = null
    for (let i = 0; i <= steps; i++) {
      const pt = at(i / steps)
      if (prev) length += Math.hypot(pt.x - prev.x, pt.y - prev.y, pt.z - prev.z)
      prev = pt
    }

    const count = Math.max(10, Math.round(length / RIBBON_SPACING))
    for (let i = 0; i < count; i++) {
      const pt = at(i / (count - 1))
      push(pt.x, pt.y, pt.z, rand(0.014, 0.022), color, rand(0.45, 0.75), 'ribbon')
    }
  }

  // 顶部那根金色蜡烛：立在轴心上的一根细柱，加顶端一圈
  const candleSteps = 10
  for (let i = 0; i <= candleSteps; i++) {
    const y = CANDLE.y0 + ((CANDLE.y1 - CANDLE.y0) * i) / candleSteps
    push(0, y, 0, 0.03 * rand(0.85, 1.15), colors.candle, 0.95, 'candle')
  }
  for (let i = 0; i < 6; i++) {
    const phi = (i / 6) * TAU
    push(
      Math.cos(phi) * CANDLE.r,
      CANDLE.y1,
      Math.sin(phi) * CANDLE.r,
      0.028,
      colors.candle,
      0.9,
      'candle',
    )
  }

  // 火苗：两圈收窄 + 尖端
  const flameMid = FLAME.y0 + (FLAME.y1 - FLAME.y0) * 0.18
  const flameUpper = FLAME.y0 + (FLAME.y1 - FLAME.y0) * 0.55
  for (let i = 0; i < 6; i++) {
    const phi = (i / 6) * TAU
    push(Math.cos(phi) * FLAME.r, flameMid, Math.sin(phi) * FLAME.r, rand(0.026, 0.034), pick(colors.flame), 1, 'flame')
  }
  for (let i = 0; i < 4; i++) {
    const phi = (i / 4) * TAU
    push(
      Math.cos(phi) * FLAME.r * 0.6,
      flameUpper,
      Math.sin(phi) * FLAME.r * 0.6,
      0.028,
      pick(colors.flame),
      1,
      'flame',
    )
  }
  push(0, FLAME.y1, 0, 0.032, pick(colors.flame), 1, 'flame')
  push(0, FLAME.y1 - 0.015, 0, 0.028, pick(colors.flame), 0.9, 'flame')

  return { points, height: MODEL_HEIGHT }
}
