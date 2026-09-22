import { config } from '../config.js'
import { getShardSprite, getSparkSprite } from './sprites.js'

const TAU = Math.PI * 2
const rand = (min, max) => min + Math.random() * (max - min)
const pick = (list) => list[(Math.random() * list.length) | 0]

/** 三维漫游的范围（归一化单位：1 约等于屏幕短边的一半） */
const FIELD = { x: 1.35, y: 1.0, z: 1.6 }
const EDGE_FADE = 0.35 // 靠近 z 两端时淡出，避免循环回绕时出现突兀的闪现

/**
 * 常驻的三维碎片星野：一层低透明度的时光碎片与星尘，在三维空间里缓慢漫游。
 * 它不参与任何一幕的剧情，只铺在最后面，让夜空不是一块死的渐变。
 *
 * 和场景里那些「要汇聚成文字」的粒子不同，这层刻意压得很暗 ——
 * 它是背景，不该跟主体抢注意力。所以自己没有对象池，也不占用粒子系统。
 */
export function createStarField(count = 260) {
  const nodes = []

  for (let i = 0; i < count; i++) {
    const isShard = Math.random() < 0.55 // 背景以碎片为主，「碎片化」更明显
    const color = pick(config.colors.starText)
    const sprite = isShard ? getShardSprite(color, 28) : getSparkSprite(color)

    nodes.push({
      x3: rand(-FIELD.x, FIELD.x),
      y3: rand(-FIELD.y, FIELD.y),
      z3: rand(-FIELD.z, FIELD.z),
      vx3: rand(-0.05, 0.05),
      vy3: rand(-0.05, 0.05),
      // 整体朝观众缓慢飘来，形成「在星野里穿行」的感觉
      vz3: rand(0.05, 0.13),
      size: isShard ? rand(7, 17) : rand(5, 12),
      alpha: rand(0.1, 0.26),
      rot: rand(0, TAU),
      vr: rand(-0.5, 0.5),
      twinklePhase: rand(0, TAU),
      twinkleSpeed: rand(0.5, 1.6),
      sprite,
      isShard,
    })
  }

  let centerX = 0
  let centerY = 0
  let camScale = 400

  return {
    update(dt, bounds) {
      centerX = bounds.w / 2
      centerY = bounds.h / 2
      camScale = Math.min(bounds.w, bounds.h) * 0.7

      for (const node of nodes) {
        node.x3 += node.vx3 * dt
        node.y3 += node.vy3 * dt
        node.z3 += node.vz3 * dt
        node.rot += node.vr * dt
        node.twinklePhase += node.twinkleSpeed * dt

        // 横向纵向来回漫游；纵深走到头就回绕到另一端（配合淡出淡入，看不出接缝）
        if (node.x3 > FIELD.x || node.x3 < -FIELD.x) node.vx3 = -node.vx3
        if (node.y3 > FIELD.y || node.y3 < -FIELD.y) node.vy3 = -node.vy3
        if (node.z3 > FIELD.z) node.z3 = -FIELD.z
      }
    },

    draw(ctx, dpr) {
      const zSpan = 2 * FIELD.z

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      for (const node of nodes) {
        const depth = (node.z3 + FIELD.z) / zSpan
        const persp = 0.5 + 0.5 * depth
        // 靠近 z 两端时淡出，回绕的另一端再淡入
        const edge = Math.min(1, (FIELD.z - Math.abs(node.z3)) / EDGE_FADE)
        if (edge <= 0) continue

        const twinkle = 0.7 + 0.3 * Math.sin(node.twinklePhase)
        const alpha = node.alpha * (0.4 + 0.6 * depth) * edge * twinkle
        if (alpha <= 0.004) continue

        const size = node.size * persp
        ctx.globalAlpha = alpha
        ctx.translate(centerX + node.x3 * camScale * persp, centerY + node.y3 * camScale * persp)
        ctx.rotate(node.rot)
        ctx.drawImage(node.sprite, -size / 2, -size / 2, size, size)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      ctx.restore()
    },
  }
}
