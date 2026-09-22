import { config } from '../config.js'
import { getSparkSprite, getShardSprite, getBalloonSprite } from './sprites.js'

export const SPARK = 'spark'
export const SHARD = 'shard'
export const BALLOON = 'balloon'

export const LAYER_BACK = 0
export const LAYER_FRONT = 1

const rand = (min, max) => min + Math.random() * (max - min)
const pick = (list) => list[(Math.random() * list.length) | 0]

function createItem(index) {
  return {
    _i: index,
    alive: false,
    owner: '',
    kind: '',
    layer: LAYER_BACK,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 1,
    rot: 0,
    vr: 0,
    swayAmp: 0,
    swayFreq: 0,
    phase: 0,
    alpha: 1,
    fadeIn: 0,
    life: 0,
    maxLife: 1e9,
    fadeOut: 0,
    gravity: 0,
    pull: 0,
    targetX: 0,
    targetY: 0,
    twinkleSpeed: 0,
    twinklePhase: 0,
    sprite: null,
    spriteW: 1,
    spriteH: 1,
    state: '',
    burstY: 0,
    homing: false,
    settle: false,
    wait: 0,
    tag: '',
    // 气球被「攥住」时用：聚成蚁球的目标偏移
    gather: false,
    gatherAngle: 0,
    gatherRadius: 0,
  }
}

/**
 * 粒子系统：所有粒子来自预分配对象池，主循环内不产生任何新对象。
 * 每个粒子记录所属 owner（幕名），幕退出时按 owner 批量回收。
 */
export class ParticleSystem {
  constructor(capacity = 420) {
    this.items = new Array(capacity)
    this.free = []
    for (let i = capacity - 1; i >= 0; i--) {
      this.items[i] = createItem(i)
      this.free.push(i)
    }
    this.capacity = capacity
    this.onBurst = null
  }

  spawn(owner) {
    const index = this.free.pop()
    if (index === undefined) return null
    const p = this.items[index]
    p.alive = true
    p.owner = owner
    p.kind = ''
    p.layer = LAYER_BACK
    p.x = 0
    p.y = 0
    p.vx = 0
    p.vy = 0
    p.size = 1
    p.rot = 0
    p.vr = 0
    p.swayAmp = 0
    p.swayFreq = 0
    p.phase = 0
    p.alpha = 1
    p.fadeIn = 0
    p.life = 0
    p.maxLife = 1e9
    p.fadeOut = 0
    p.gravity = 0
    p.pull = 0
    p.targetX = 0
    p.targetY = 0
    p.twinkleSpeed = 0
    p.twinklePhase = 0
    p.sprite = null
    p.spriteW = 1
    p.spriteH = 1
    p.state = ''
    p.burstY = 0
    p.homing = false
    p.settle = false
    p.wait = 0
    p.tag = ''
    p.gather = false
    p.gatherAngle = 0
    p.gatherRadius = 0
    return p
  }

  release(p) {
    if (!p.alive) return
    p.alive = false
    p.owner = ''
    this.free.push(p._i)
  }

  releaseByOwner(owner) {
    for (const p of this.items) {
      if (p.alive && p.owner === owner) this.release(p)
    }
  }

  liveCount(owner, kind = null) {
    let n = 0
    for (const p of this.items) {
      if (p.alive && p.owner === owner && (kind === null || p.kind === kind)) n++
    }
    return n
  }

  /* ---------------- 生成 ---------------- */

  /** 星光：缓慢漂移 + 呼吸闪烁 */
  emitStarlight(owner, count, width, height, options = {}) {
    const {
      centerBias = 0.35,
      speed = 12,
      life = [7, 13],
      layer = LAYER_BACK,
      alpha = 0.9,
      sizeRange = [10, 34],
      topInset = 0.04,
      fadeOut = [1.4, 3],
    } = options

    for (let i = 0; i < count; i++) {
      const p = this.spawn(owner)
      if (!p) return
      const color = pick(config.colors.spark)
      const sprite = getSparkSprite(color)

      p.kind = SPARK
      p.layer = layer
      p.x = rand(0, width)
      p.y = rand(height * topInset, height)
      if (centerBias > 0) {
        p.x += (width / 2 - p.x) * rand(0, centerBias)
        p.y += (height / 2 - p.y) * rand(0, centerBias)
      }
      const angle = rand(0, Math.PI * 2)
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed - rand(3, 12)
      p.size = rand(sizeRange[0], sizeRange[1])
      p.alpha = alpha
      p.fadeIn = rand(0.6, 1.6)
      p.maxLife = rand(life[0], life[1])
      p.fadeOut = rand(fadeOut[0], fadeOut[1])
      p.twinkleSpeed = rand(1.1, 2.8)
      p.twinklePhase = rand(0, Math.PI * 2)
      p.sprite = sprite
      p.spriteW = sprite.width
      p.spriteH = sprite.height
    }
  }

  /** 星光扩散：默认是气球绽放的力度，传 options 可调成更轻柔的星光雨 */
  emitBurst(owner, x, y, count, colors, options = {}) {
    const list = colors || config.colors.spark
    const {
      speedRange = [40, 190],
      gravityRange = [26, 62],
      lifeRange = [1.9, 3.4],
      sizeRange = [12, 30],
      upwardBias = 0,
    } = options

    for (let i = 0; i < count; i++) {
      const p = this.spawn(owner)
      if (!p) return
      const color = pick(list)
      const sprite = getSparkSprite(color)
      const angle = rand(0, Math.PI * 2)
      const speed = rand(speedRange[0], speedRange[1])

      p.kind = SPARK
      p.layer = LAYER_FRONT
      p.x = x + Math.cos(angle) * rand(0, 14)
      p.y = y + Math.sin(angle) * rand(0, 14)
      p.vx = Math.cos(angle) * speed * 0.7
      p.vy = Math.sin(angle) * speed * 0.5 - upwardBias
      p.size = rand(sizeRange[0], sizeRange[1])
      p.alpha = rand(0.75, 1)
      p.fadeIn = 0.12
      p.maxLife = rand(lifeRange[0], lifeRange[1])
      p.fadeOut = Math.min(1.6, p.maxLife * 0.55)
      p.gravity = rand(gravityRange[0], gravityRange[1])
      p.twinkleSpeed = rand(2.4, 5)
      p.twinklePhase = rand(0, Math.PI * 2)
      p.sprite = sprite
      p.spriteW = sprite.width
      p.spriteH = sprite.height
    }
  }

  /**
   * 归位凝形：一批粒子从各自起点飞向指定目标点并停驻下来。
   * 收尾幕的蛋糕点阵与开场幕的星尘组字都靠它。
   * list 每项：{ x, y, targetX, targetY, size, color, alpha, fadeIn, delay, tag, layer }
   */
  emitHoming(owner, list, options = {}) {
    const {
      kind = SPARK,
      pull = 0.14,
      life = 4e5,
      layer = LAYER_FRONT,
      twinkleRange = [0.8, 2.2],
      spinRange = [0.5, 1.6],
      shardBox = 40,
    } = options
    const created = []

    for (const item of list) {
      const p = this.spawn(owner)
      if (!p) break
      // 同一批里可以混不同形态（比如星尘与时光碎片）
      const particleKind = item.kind ?? kind
      const sprite =
        particleKind === SHARD ? getShardSprite(item.color, shardBox) : getSparkSprite(item.color)

      p.kind = particleKind
      p.layer = item.layer ?? layer
      p.x = item.x
      p.y = item.y
      // 等待期内的自由漂移，幅度很小，只为让粒子不是僵在原地等
      p.vx = rand(-12, 12)
      p.vy = rand(-12, 12)
      p.size = item.size
      p.alpha = item.alpha
      p.fadeIn = item.fadeIn ?? 0.3
      p.maxLife = life
      p.fadeOut = 0
      p.pull = pull
      p.targetX = item.targetX
      p.targetY = item.targetY
      p.homing = true
      p.settle = false
      p.wait = item.delay ?? 0
      p.tag = item.tag ?? ''
      p.twinkleSpeed = rand(twinkleRange[0], twinkleRange[1])
      p.twinklePhase = rand(0, Math.PI * 2)
      if (particleKind === SHARD) {
        p.rot = rand(0, Math.PI * 2)
        p.vr = rand(-spinRange[1], spinRange[1])
        p.swayAmp = rand(8, 22)
        p.swayFreq = rand(0.4, 1)
        p.phase = rand(0, Math.PI * 2)
      }
      p.sprite = sprite
      p.spriteW = sprite.width
      p.spriteH = sprite.height
      created.push(p)
    }

    return created
  }

  /** 按 tag 遍历粒子，用于点亮烛火、吹灭等整体操作 */
  eachTagged(owner, tag, fn) {
    for (const p of this.items) {
      if (p.alive && p.owner === owner && p.tag === tag) fn(p)
    }
  }

  /** 按 kind 遍历某个 owner 的粒子；气球没有 tag，用这个找 */
  eachKind(owner, kind, fn) {
    for (const p of this.items) {
      if (p.alive && p.owner === owner && p.kind === kind) fn(p)
    }
  }

  /**
   * 松手放烟花：把落点附近「攥住」的气球一起引爆，其余放开、恢复上升。
   * 返回引爆了几只 —— 攥得越久聚得越拢，一次炸开的规模就越大。
   */
  releaseGathered(owner, x, y, radius) {
    let popped = 0
    for (const p of this.items) {
      if (!p.alive || p.owner !== owner || p.kind !== BALLOON || !p.gather) continue
      if (Math.hypot(p.x - x, p.y - y) <= radius) {
        this._burst(p)
        this.release(p)
        popped += 1
      } else {
        p.gather = false
        p.state = 'rising'
      }
    }
    return popped
  }

  /** 小气球：自屏幕下方升起，左右摆动，到达 burstY 时触发绽放 */
  emitBalloon(owner, options) {
    const { x, y, size, color, speed, swayAmp, swayFreq, layer, burstY, alpha = 1 } = options
    const p = this.spawn(owner)
    if (!p) return null
    const sprite = getBalloonSprite(color)

    p.kind = BALLOON
    p.layer = layer
    p.x = x
    p.y = y
    p.vy = -speed
    p.size = size
    p.rot = rand(-0.14, 0.14)
    p.vr = rand(-0.32, 0.32)
    p.swayAmp = swayAmp
    p.swayFreq = swayFreq
    p.phase = rand(0, Math.PI * 2)
    p.alpha = alpha
    p.fadeIn = 0.8
    p.maxLife = 1e9
    p.state = 'rising'
    p.burstY = burstY
    p.sprite = sprite
    p.spriteW = sprite.width
    p.spriteH = sprite.height
    return p
  }

  /** 让指定 owner 的星光向某个点聚拢（pull = 0 表示取消） */
  setPull(owner, pull, targetX, targetY) {
    for (const p of this.items) {
      if (p.alive && p.owner === owner && p.kind === SPARK) {
        p.pull = pull
        p.targetX = targetX
        p.targetY = targetY
      }
    }
  }

  /* ---------------- 每帧推进 ---------------- */

  update(dt, bounds) {
    const items = this.items
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      if (!p.alive) continue

      p.life += dt
      if (p.life >= p.maxLife) {
        this.release(p)
        continue
      }

      // 归位凝形：等待期结束后转入停驻，此后运动完全由目标点驱动。
      // 只有 emitHoming 生成的粒子会打开 homing，setPull 那种轻柔吸引不受影响
      if (p.homing) {
        if (p.wait > 0) p.wait -= dt
        if (p.wait <= 0) p.settle = true
        if (p.settle) {
          p.vx = 0
          p.vy = 0
          const k = 1 - Math.pow(1 - Math.min(0.5, p.pull), dt * 60)
          p.x += (p.targetX - p.x) * k
          p.y += (p.targetY - p.y) * k
          // 碎片的自转由场景自己管（漂浮时要转，成字时要摆正）
          if (p.kind === SPARK) p.twinklePhase += p.twinkleSpeed * dt
          continue
        }
      }

      if (p.kind === SHARD) {
        p.phase += p.swayFreq * dt
        p.y += p.vy * dt
        p.x += (p.vx + Math.sin(p.phase) * p.swayAmp) * dt
        p.rot += p.vr * dt
        if (p.y > bounds.h + p.size) {
          this.release(p)
          continue
        }
      } else if (p.kind === SPARK) {
        if (p.gravity) p.vy += p.gravity * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        // 归位凝形的粒子由上面的 homing 分支接管，不走这条轻柔吸引
        if (p.pull > 0 && !p.homing) {
          const k = 1 - Math.pow(1 - Math.min(0.6, p.pull), dt * 60)
          p.x += (p.targetX - p.x) * k
          p.y += (p.targetY - p.y) * k
        }
        p.twinklePhase += p.twinkleSpeed * dt
        const m = p.size * 2.4
        if (p.x < -m || p.x > bounds.w + m || p.y < -m || p.y > bounds.h + m) {
          this.release(p)
          continue
        }
      } else if (p.kind === BALLOON) {
        // 被攥住的气球：不再上升、也不摆动，只朝着「蚁球」里属于自己的那个位置收拢。
        // 目标点由场景每帧算好（绕按住的位置缓慢自转），这里只负责跟过去。
        if (p.gather) {
          const k = 1 - Math.pow(1 - 0.14, dt * 60)
          p.x += (p.targetX - p.x) * k
          p.y += (p.targetY - p.y) * k
          p.vr += (0 - p.vr) * Math.min(1, dt * 2.5)
          p.rot += p.vr * dt
          continue
        }

        p.phase += p.swayFreq * dt
        p.y += p.vy * dt
        p.x += Math.sin(p.phase) * p.swayAmp * dt
        p.rot += p.vr * dt

        // 摆动幅度是速度量，累积位移可能把气球推出屏幕；这里做软性收拢，避免被边缘裁掉半个
        const margin = p.size * 0.46
        if (p.x < margin) p.x = margin
        else if (p.x > bounds.w - margin) p.x = bounds.w - margin

        if (p.state === 'rising' && p.y <= p.burstY) {
          this._burst(p)
          this.release(p)
          continue
        }
        if (p.y < -p.size * 2.2) {
          this.release(p)
          continue
        }
      }
    }
  }

  _burst(p) {
    if (this.onBurst) this.onBurst(p)
  }

  /* ---------------- 绘制 ---------------- */

  draw(ctx, sceneAlpha, layer, dpr = 1) {
    const items = this.items

    ctx.save()
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      if (!p.alive || p.layer !== layer || p.kind === SPARK) continue
      const a = this._alpha(p, sceneAlpha)
      if (a <= 0.004) continue

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = a
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)

      if (p.kind === BALLOON) {
        const w = p.size
        const h = p.size * (p.spriteH / p.spriteW)
        ctx.drawImage(p.sprite, -w / 2, -h * 0.408, w, h)
      } else {
        // 星尘与时光碎片都是正方形精灵，居中绘制
        const s = p.size
        ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s)
      }
    }
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      if (!p.alive || p.layer !== layer || p.kind !== SPARK) continue
      const a = this._alpha(p, sceneAlpha)
      if (a <= 0.004) continue
      const twinkle = 0.62 + 0.38 * Math.sin(p.twinklePhase)
      const s = p.size * (0.86 + 0.18 * twinkle)
      ctx.globalAlpha = Math.min(1, a * twinkle * 1.35)
      ctx.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s)
    }
    ctx.restore()

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1
  }

  _alpha(p, sceneAlpha) {
    const fadeIn = p.fadeIn > 0 ? Math.min(1, p.life / p.fadeIn) : 1
    const fadeOut = p.fadeOut > 0 ? Math.min(1, Math.max(0, (p.maxLife - p.life) / p.fadeOut)) : 1
    return p.alpha * fadeIn * fadeOut * sceneAlpha
  }
}
