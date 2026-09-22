/**
 * 精灵预渲染：所有粒子图形只在首次使用时绘制一次到离屏画布，
 * 之后每帧只用 drawImage 贴图，避免在主循环里反复构建渐变。
 */

const cache = new Map()

function hexToRgb(hex) {
  let v = hex.replace('#', '')
  if (v.length === 3) {
    v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2]
  }
  const n = parseInt(v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(rgb, a) {
  return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${a})`
}

/** t > 0 向白提亮，t < 0 向深色压暗 */
function shade(rgb, t) {
  const target = t > 0 ? [255, 255, 255] : [8, 6, 24]
  const k = Math.abs(t)
  return rgb.map((c, i) => c + (target[i] - c) * k)
}

function createCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function cached(key, factory) {
  if (!cache.has(key)) cache.set(key, factory())
  return cache.get(key)
}

/** 星尘：中心锐利、外围柔和的光点，附带十字光芒 */
export function getSparkSprite(color, box = 96) {
  return cached(`spark:${color}:${box}`, () => {
    const rgb = hexToRgb(color)
    const canvas = createCanvas(box, box)
    const ctx = canvas.getContext('2d')
    const c = box / 2

    const glow = ctx.createRadialGradient(c, c, 0, c, c, c)
    glow.addColorStop(0, 'rgba(255,255,255,0.98)')
    glow.addColorStop(0.12, rgba(shade(rgb, 0.55), 0.95))
    glow.addColorStop(0.3, rgba(rgb, 0.46))
    glow.addColorStop(0.62, rgba(rgb, 0.13))
    glow.addColorStop(1, rgba(rgb, 0))

    ctx.fillStyle = glow
    ctx.fillRect(0, 0, box, box)

    // 十字光芒
    ctx.globalCompositeOperation = 'lighter'
    const arm = box * 0.42
    const drawArm = (horizontal) => {
      const g = horizontal
        ? ctx.createLinearGradient(c - arm, c, c + arm, c)
        : ctx.createLinearGradient(c, c - arm, c, c + arm)
      g.addColorStop(0, rgba(shade(rgb, 0.8), 0))
      g.addColorStop(0.5, rgba(shade(rgb, 0.85), 0.55))
      g.addColorStop(1, rgba(shade(rgb, 0.8), 0))
      ctx.fillStyle = g
      if (horizontal) ctx.fillRect(c - arm, c - box * 0.008, arm * 2, box * 0.016)
      else ctx.fillRect(c - box * 0.008, c - arm, box * 0.016, arm * 2)
    }
    drawArm(true)
    drawArm(false)
    ctx.globalCompositeOperation = 'source-over'

    return canvas
  })
}

/** 时光碎片：一片细长的发光菱形，两端渐隐，像碎掉的光 */
export function getShardSprite(color, box = 80) {
  return cached(`shard:${color}:${box}`, () => {
    const rgb = hexToRgb(color)
    const canvas = createCanvas(box, box)
    const ctx = canvas.getContext('2d')
    const cx = box / 2
    const halfLen = box * 0.42
    const halfWidth = box * 0.16

    const grad = ctx.createLinearGradient(cx, cx - halfLen, cx, cx + halfLen)
    grad.addColorStop(0, rgba(shade(rgb, 0.7), 0))
    grad.addColorStop(0.3, rgba(shade(rgb, 0.8), 0.85))
    grad.addColorStop(0.5, 'rgba(255,255,255,0.95)')
    grad.addColorStop(0.7, rgba(shade(rgb, 0.8), 0.85))
    grad.addColorStop(1, rgba(shade(rgb, 0.7), 0))

    ctx.save()
    ctx.shadowColor = rgba(rgb, 0.9)
    ctx.shadowBlur = box * 0.16
    ctx.beginPath()
    ctx.moveTo(cx, cx - halfLen)
    ctx.lineTo(cx + halfWidth, cx)
    ctx.lineTo(cx, cx + halfLen)
    ctx.lineTo(cx - halfWidth, cx)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()

    return canvas
  })
}

/** 小气球：带高光与细绳的椭圆气球，绳在精灵底部 */
export function getBalloonSprite(color, w = 120, h = 152) {
  return cached(`balloon:${color}:${w}:${h}`, () => {
    const rgb = hexToRgb(color)
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    const cx = w / 2
    const cy = h * 0.408
    const rx = w * 0.35
    const ry = h * 0.342

    // 细绳
    ctx.beginPath()
    ctx.moveTo(cx, cy + ry * 1.03)
    ctx.quadraticCurveTo(cx - w * 0.075, cy + ry * 1.4, cx + w * 0.012, h * 0.995)
    ctx.strokeStyle = 'rgba(226,222,255,0.32)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    // 球体
    const grad = ctx.createRadialGradient(cx - rx * 0.36, cy - ry * 0.42, rx * 0.1, cx, cy, ry * 1.18)
    grad.addColorStop(0, rgba(shade(rgb, 0.68), 1))
    grad.addColorStop(0.36, rgba(rgb, 1))
    grad.addColorStop(1, rgba(shade(rgb, -0.52), 1))

    ctx.save()
    ctx.shadowColor = rgba(rgb, 0.6)
    ctx.shadowBlur = w * 0.12
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()

    // 高光
    const spec = ctx.createRadialGradient(cx - rx * 0.38, cy - ry * 0.44, 0, cx - rx * 0.38, cy - ry * 0.44, rx * 0.72)
    spec.addColorStop(0, 'rgba(255,255,255,0.62)')
    spec.addColorStop(0.55, 'rgba(255,255,255,0.16)')
    spec.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    ctx.ellipse(cx - rx * 0.32, cy - ry * 0.4, rx * 0.44, ry * 0.36, -0.4, 0, Math.PI * 2)
    ctx.fillStyle = spec
    ctx.fill()

    // 底部收口
    ctx.beginPath()
    ctx.moveTo(cx, cy + ry * 0.86)
    ctx.lineTo(cx - rx * 0.16, cy + ry * 1.06)
    ctx.lineTo(cx + rx * 0.16, cy + ry * 1.06)
    ctx.closePath()
    ctx.fillStyle = rgba(shade(rgb, -0.42), 1)
    ctx.fill()

    return canvas
  })
}
