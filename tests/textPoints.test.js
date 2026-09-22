import { describe, it, expect } from 'vitest'
import { scanInkPoints, normalizePoints, localDirection } from '../src/fx/textPoints.js'

/** 造一张 RGBA 图，isInk 决定某个像素是不是墨迹 */
function makeImage(width, height, isInk) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isInk(x, y)) data[(y * width + x) * 4 + 3] = 255
    }
  }
  return { data, width, height }
}

function makeMask(width, height, isInk) {
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isInk(x, y)) mask[y * width + x] = 1
    }
  }
  return mask
}

describe('scanInkPoints', () => {
  it('没有墨迹时不产出任何点', () => {
    const image = makeImage(40, 40, () => false)
    expect(scanInkPoints(image.data, 40, 40, 10)).toHaveLength(0)
  })

  it('整片墨迹按格子数产出点，且落在各格墨迹质心', () => {
    const image = makeImage(40, 40, () => true)
    const points = scanInkPoints(image.data, 40, 40, 10)
    // 40×40 切 10px 格子 → 4×4 = 16 个点
    expect(points).toHaveLength(16)
    // 第一格覆盖 0..9，质心在 4.5
    expect(points[0]).toMatchObject({ x: 4.5, y: 4.5 })
    expect(points[15]).toMatchObject({ x: 34.5, y: 34.5 })
  })

  it('1 像素宽的细笔画也不会被漏掉', () => {
    const image = makeImage(40, 40, (x) => x === 5)
    const points = scanInkPoints(image.data, 40, 40, 10)
    expect(points).toHaveLength(4)
    for (const p of points) expect(p.x).toBeCloseTo(5, 5)
  })

  it('低于墨迹阈值的半透明像素不计入', () => {
    const image = makeImage(20, 20, () => false)
    image.data[(5 * 20 + 5) * 4 + 3] = 100
    expect(scanInkPoints(image.data, 20, 20, 10)).toHaveLength(0)
  })

  it('格距越大点数越少', () => {
    const image = makeImage(60, 60, () => true)
    const fine = scanInkPoints(image.data, 60, 60, 6)
    const coarse = scanInkPoints(image.data, 60, 60, 20)
    expect(fine.length).toBeGreaterThan(coarse.length)
  })

  it('不传方向半径时不给方向，传了就给出笔画走向', () => {
    const image = makeImage(41, 41, (x) => x >= 18 && x <= 22)

    const plain = scanInkPoints(image.data, 41, 41, 10)
    for (const p of plain) expect(p.angle).toBeNull()

    const withDirection = scanInkPoints(image.data, 41, 41, 10, 9)
    expect(withDirection.length).toBeGreaterThan(0)
    for (const p of withDirection) expect(Math.abs(p.angle)).toBeCloseTo(Math.PI / 2, 1)
  })
})

describe('localDirection', () => {
  it('竖条给出竖直方向', () => {
    const mask = makeMask(41, 41, (x) => x >= 18 && x <= 22)
    expect(Math.abs(localDirection(mask, 41, 41, 20, 20, 12))).toBeCloseTo(Math.PI / 2, 2)
  })

  it('横条给出水平方向', () => {
    const mask = makeMask(41, 41, (x, y) => y >= 18 && y <= 22)
    expect(Math.abs(localDirection(mask, 41, 41, 20, 20, 12))).toBeCloseTo(0, 2)
  })

  it('斜条给出约 45 度', () => {
    const mask = makeMask(41, 41, (x, y) => Math.abs(x - y) <= 2)
    const angle = localDirection(mask, 41, 41, 20, 20, 12)
    expect(Math.abs(Math.abs(angle) - Math.PI / 4)).toBeLessThan(0.15)
  })

  it('窗口内墨迹太少时返回 null', () => {
    const mask = makeMask(41, 41, (x, y) => x === 20 && y === 20)
    expect(localDirection(mask, 41, 41, 20, 20, 12)).toBeNull()
  })
})

describe('normalizePoints', () => {
  it('平移到墨迹包围盒原点并回报尺寸', () => {
    const result = normalizePoints([
      { x: 10, y: 20, angle: 0.5 },
      { x: 30, y: 20, angle: null },
      { x: 30, y: 50, angle: 1.2 },
    ])
    expect(result.width).toBe(20)
    expect(result.height).toBe(30)
    expect(result.points[0]).toMatchObject({ x: 0, y: 0 })
    expect(result.points[2]).toMatchObject({ x: 20, y: 30 })
  })

  it('平移不丢失方向信息', () => {
    const result = normalizePoints([{ x: 5, y: 5, angle: 0.7 }])
    expect(result.points[0].angle).toBe(0.7)
  })

  it('空数组返回零尺寸而不是 Infinity', () => {
    expect(normalizePoints([])).toEqual({ points: [], width: 0, height: 0 })
  })
})
