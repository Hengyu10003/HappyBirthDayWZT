import { describe, it, expect } from 'vitest'
import { createCakePoints } from '../src/fx/cakeShape.js'

const HEX = /^#[0-9A-F]{6}$/i
const { points, height } = createCakePoints()

const group = (tag) => points.filter((p) => p.tag === tag)
const radiusOf = (p) => Math.hypot(p.x, p.z)
const average = (list, key) => list.reduce((sum, p) => sum + p[key], 0) / list.length

describe('createCakePoints', () => {
  it('点阵总量落在预算区间内', () => {
    // 蛋糕身体要够密才看得出体积，顶棱与侧面各加密过一次，点数上探到约 3700；
    // 粒子池的容量必须同时容纳它、氛围星光与烟花，改这里时记得一起核。
    expect(points.length).toBeGreaterThan(150)
    expect(points.length).toBeLessThanOrEqual(3800)
  })

  it('每个点的坐标、尺寸、颜色与透明度都合法', () => {
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.z)).toBe(true)
      expect(p.size).toBeGreaterThan(0)
      expect(p.size).toBeLessThan(0.1)
      expect(p.color).toMatch(HEX)
      expect(p.alpha).toBeGreaterThan(0)
      expect(p.alpha).toBeLessThanOrEqual(1)
      expect(p.tag.length).toBeGreaterThan(0)
    }
  })

  it('是绕竖轴的旋转体：蛋糕本体的半径都不超过托盘', () => {
    for (const p of points) {
      if (p.tag === 'ribbon') continue // 彩带刻意浮在蛋糕外侧，不受托盘半径约束
      expect(radiusOf(p)).toBeLessThanOrEqual(0.54)
      expect(p.y).toBeGreaterThanOrEqual(0)
    }
  })

  it('悬浮彩带在蛋糕外侧盘旋，且高度落在蛋糕范围内', () => {
    const ribbons = group('ribbon')
    expect(ribbons.length).toBeGreaterThan(100)
    for (const p of ribbons) {
      expect(radiusOf(p)).toBeGreaterThan(0.3) // 全都在蛋糕最宽处之外
      expect(p.y).toBeGreaterThan(0)
      expect(p.y).toBeLessThan(1)
    }
  })

  it('有真实的深度：圆环在 x 与 z 两个方向都铺开', () => {
    const rings = group('ring')
    expect(rings.length).toBeGreaterThan(60)
    // 若模型是扁平的 2D 轮廓，z 会恒为 0，旋转就无从谈起
    expect(Math.min(...rings.map((p) => p.z))).toBeLessThan(-0.1)
    expect(Math.max(...rings.map((p) => p.z))).toBeGreaterThan(0.1)
    expect(Math.min(...rings.map((p) => p.x))).toBeLessThan(-0.1)
    expect(Math.max(...rings.map((p) => p.x))).toBeGreaterThan(0.1)
  })

  it('三层顶面圆环自下而上逐层收窄', () => {
    // 顶棱带波浪起伏，y 不再恒定，所以按半径分三簇来判断是哪一层
    const buckets = [[], [], []] // [顶层, 中层, 底层]
    for (const p of group('ring')) {
      const radius = radiusOf(p)
      if (radius < 0.24) buckets[0].push(p)
      else if (radius < 0.36) buckets[1].push(p)
      else buckets[2].push(p)
    }

    for (const bucket of buckets) expect(bucket.length).toBeGreaterThan(8)

    const meanY = (bucket) => bucket.reduce((sum, p) => sum + p.y, 0) / bucket.length
    // 半径越小的高度越高：顶层最高、底层最低
    expect(meanY(buckets[0])).toBeGreaterThan(meanY(buckets[1]))
    expect(meanY(buckets[1])).toBeGreaterThan(meanY(buckets[2]))
  })

  it('托盘是最宽的一圈', () => {
    const plate = group('plate')
    const widest = Math.max(...plate.map(radiusOf))
    for (const p of group('ring')) expect(radiusOf(p)).toBeLessThan(widest)
  })

  it('顶部只有一根蜡烛，紧贴中轴', () => {
    const candles = group('candle')
    expect(candles.length).toBeGreaterThan(6)
    for (const p of candles) {
      expect(radiusOf(p)).toBeLessThan(0.05)
      expect(p.y).toBeGreaterThan(0.7)
    }
  })

  it('火苗位于蜡烛之上，且最亮', () => {
    const flames = group('flame')
    const candles = group('candle')
    expect(flames.length).toBeGreaterThan(6)
    expect(Math.min(...flames.map((p) => p.y))).toBeGreaterThanOrEqual(Math.max(...candles.map((p) => p.y)))
    for (const p of flames) expect(p.alpha).toBeGreaterThan(0.85)
  })

  it('轮廓比层内填充更大更亮（发光描边）', () => {
    const rings = group('ring')
    const fills = group('fill')
    expect(fills.length).toBeGreaterThan(0)
    expect(average(rings, 'size')).toBeGreaterThan(average(fills, 'size') * 1.4)
    expect(average(rings, 'alpha')).toBeGreaterThan(average(fills, 'alpha') * 1.8)
  })

  it('模型总高等于火苗尖端的高度', () => {
    expect(height).toBeCloseTo(Math.max(...points.map((p) => p.y)), 5)
  })
})
