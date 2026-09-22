/**
 * 把一段文字采样成点阵，供花瓣飞过去拼字。
 *
 * 做法：用离屏 canvas 把文字画出来，再按网格逐格检查有没有墨迹 ——
 * 有墨迹的格子取该格墨迹的加权质心作为一个目标点。
 * 相比「沿轮廓描点」，逐格检查能保证再细的笔画也不会漏，而且点数天然可控。
 */

const INK_THRESHOLD = 128
const MAX_ATTEMPTS = 6

let scratch = null

function getContext() {
  if (!scratch) {
    scratch = document.createElement('canvas')
    scratch.width = 8
    scratch.height = 8
  }
  return scratch.getContext('2d', { willReadFrequently: true })
}

function setFont(ctx, size, weight, family) {
  ctx.font = `${weight} ${size}px ${family}`
}

/** 二分式缩放字号，让文字宽度刚好落在可用宽度内 */
function fitFontSize(ctx, text, maxWidth, maxFontSize, weight, family) {
  let size = maxFontSize
  for (let i = 0; i < 14; i++) {
    setFont(ctx, size, weight, family)
    const width = ctx.measureText(text).width
    if (width <= maxWidth || size <= 24) break
    size = Math.max(24, size * (maxWidth / width))
  }
  return Math.floor(size)
}

/**
 * 估计某个点附近的墨迹走向（相对 x 轴的主轴角度）。
 * 取窗口内墨迹像素的协方差矩阵，最大特征值对应的特征向量就是笔画方向。
 * 纯函数，便于单测。
 */
export function localDirection(mask, width, height, cx, cy, radius) {
  let count = 0
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumYY = 0
  let sumXY = 0

  for (let y = cy - radius; y <= cy + radius; y++) {
    if (y < 0 || y >= height) continue
    const rowOffset = y * width
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || x >= width) continue
      if (!mask[rowOffset + x]) continue
      const dx = x - cx
      const dy = y - cy
      count += 1
      sumX += dx
      sumY += dy
      sumXX += dx * dx
      sumYY += dy * dy
      sumXY += dx * dy
    }
  }

  if (count < 4) return null

  const meanX = sumX / count
  const meanY = sumY / count
  const cxx = sumXX / count - meanX * meanX
  const cyy = sumYY / count - meanY * meanY
  const cxy = sumXY / count - meanX * meanY

  return 0.5 * Math.atan2(2 * cxy, cxx - cyy)
}

/**
 * 按网格扫描像素，有墨迹的格子取该格墨迹的加权质心作为一个点，
 * 并顺带估计该处的笔画走向（决定花瓣要顺着哪个方向躺）。
 * 纯函数：只依赖传入的 RGBA 数据，便于单测。
 * 逐格扫描而不是沿轮廓描点，是为了保证再细的笔画也不会被漏掉。
 */
export function scanInkPoints(data, width, height, spacing, directionRadius = 0) {
  const points = []
  const cols = Math.ceil(width / spacing)
  const rows = Math.ceil(height / spacing)

  let mask = null
  if (directionRadius > 0) {
    mask = new Uint8Array(width * height)
    for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
      mask[i] = data[p] > INK_THRESHOLD ? 1 : 0
    }
  }

  for (let gy = 0; gy < rows; gy++) {
    const y0 = Math.floor(gy * spacing)
    const y1 = Math.min(height, Math.ceil((gy + 1) * spacing))

    for (let gx = 0; gx < cols; gx++) {
      const x0 = Math.floor(gx * spacing)
      const x1 = Math.min(width, Math.ceil((gx + 1) * spacing))

      let weight = 0
      let sumX = 0
      let sumY = 0

      for (let y = y0; y < y1; y++) {
        const rowOffset = y * width
        for (let x = x0; x < x1; x++) {
          const alpha = data[(rowOffset + x) * 4 + 3]
          if (alpha > INK_THRESHOLD) {
            weight += alpha
            sumX += x * alpha
            sumY += y * alpha
          }
        }
      }

      if (weight === 0) continue

      const px = sumX / weight
      const py = sumY / weight
      const angle = mask ? localDirection(mask, width, height, Math.round(px), Math.round(py), directionRadius) : null
      points.push({ x: px, y: py, angle })
    }
  }

  return points
}

/** 平移到墨迹包围盒的原点，并回报包围盒尺寸，方便调用方居中 */
export function normalizePoints(points) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  if (!points.length) return { points: [], width: 0, height: 0 }

  return {
    points: points.map((p) => ({ x: p.x - minX, y: p.y - minY, angle: p.angle })),
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * @param {string} text 要采样的文字
 * @param {{fontFamily:string, maxWidth:number, spacing:number, maxPoints:number,
 *          maxFontSize?:number, weight?:number}} options
 * @returns {{points:Array<{x:number,y:number}>, width:number, height:number, fontSize:number, spacing:number}}
 */
export function sampleTextPoints(text, options) {
  const {
    fontFamily,
    maxWidth,
    spacing,
    maxPoints = 200,
    maxFontSize = 110,
    weight = 600,
  } = options

  const ctx = getContext()
  const fontSize = fitFontSize(ctx, text, maxWidth, maxFontSize, weight, fontFamily)

  setFont(ctx, fontSize, weight, fontFamily)
  const metrics = ctx.measureText(text)
  const pad = Math.ceil(fontSize * 0.2) + 2
  const width = Math.ceil(metrics.width) + pad * 2
  const height = Math.ceil(fontSize * 1.45) + pad * 2

  if (scratch.width < width || scratch.height < height) {
    scratch.width = Math.max(scratch.width, width)
    scratch.height = Math.max(scratch.height, height)
  }

  ctx.clearRect(0, 0, scratch.width, scratch.height)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  setFont(ctx, fontSize, weight, fontFamily)
  ctx.fillStyle = '#fff'
  ctx.fillText(text, pad, height / 2)

  const image = ctx.getImageData(0, 0, width, height)

  // 点太多就放宽网格重扫，直到落进预算；方向估计的窗口跟着格距走
  let step = spacing
  const radius = () => Math.max(3, Math.round(step * 0.9))
  let result = normalizePoints(scanInkPoints(image.data, width, height, step, radius()))

  for (let attempt = 0; attempt < MAX_ATTEMPTS && result.points.length > maxPoints; attempt++) {
    step *= 1.14
    result = normalizePoints(scanInkPoints(image.data, width, height, step, radius()))
  }

  return { ...result, fontSize, spacing: step }
}
