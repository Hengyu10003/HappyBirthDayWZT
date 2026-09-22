import { describe, it, expect } from 'vitest'
import { ParticleSystem, SHARD, SPARK, BALLOON } from '../src/fx/particles.js'

const BOUNDS = { w: 800, h: 600 }

function makeShard(system, owner = 'test') {
  const p = system.spawn(owner)
  p.kind = SHARD
  p.x = 400
  p.y = 100
  p.vx = 0
  p.vy = 60
  p.size = 40
  p.swayAmp = 0
  p.swayFreq = 0
  p.vr = 0
  p.alpha = 1
  p.fadeIn = 0
  p.maxLife = 1e9
  p.fadeOut = 0
  return p
}

function makeBalloon(system, owner = 'test') {
  const p = system.spawn(owner)
  p.kind = BALLOON
  p.x = 400
  p.y = 400
  p.vy = -100
  p.size = 60
  p.swayAmp = 0
  p.swayFreq = 0
  p.vr = 0
  p.alpha = 1
  p.fadeIn = 0
  p.maxLife = 1e9
  p.fadeOut = 0
  p.state = 'rising'
  p.burstY = 200
  return p
}

describe('ParticleSystem 对象池', () => {
  it('容量用尽后 spawn 返回 null，且不超出容量', () => {
    const system = new ParticleSystem(3)
    expect(system.spawn('a')).not.toBeNull()
    expect(system.spawn('a')).not.toBeNull()
    expect(system.spawn('a')).not.toBeNull()
    expect(system.spawn('a')).toBeNull()
    expect(system.liveCount('a')).toBe(3)
  })

  it('回收后可再次复用同一批对象', () => {
    const system = new ParticleSystem(2)
    const first = system.spawn('a')
    first.x = 999
    system.spawn('a')
    expect(system.spawn('a')).toBeNull()

    system.release(first)
    const reused = system.spawn('a')
    expect(reused).toBe(first)
    // 复用时字段被重置，不会残留上一轮的状态
    expect(reused.x).toBe(0)
    expect(reused.alive).toBe(true)
    expect(system.liveCount('a')).toBe(2)
  })

  it('重复 release 不会把同一个槽位放回两次', () => {
    const system = new ParticleSystem(1)
    const p = system.spawn('a')
    system.release(p)
    system.release(p)
    system.spawn('a')
    expect(system.spawn('a')).toBeNull()
  })

  it('releaseByOwner 只回收所属幕的粒子', () => {
    const system = new ParticleSystem(4)
    system.spawn('petals')
    system.spawn('petals')
    system.spawn('crown')
    system.releaseByOwner('petals')
    expect(system.liveCount('petals')).toBe(0)
    expect(system.liveCount('crown')).toBe(1)
  })

  it('liveCount 支持按类型过滤', () => {
    const system = new ParticleSystem(4)
    makeShard(system, 'crown')
    makeBalloon(system, 'crown')
    expect(system.liveCount('crown')).toBe(2)
    expect(system.liveCount('crown', SHARD)).toBe(1)
    expect(system.liveCount('crown', BALLOON)).toBe(1)
  })
})

describe('ParticleSystem 更新', () => {
  it('碎片按速度下落，越出下边界后被回收', () => {
    const system = new ParticleSystem(2)
    const p = makeShard(system)
    system.update(1, BOUNDS)
    expect(p.y).toBeCloseTo(160, 5)
    expect(p.alive).toBe(true)

    system.update(10, BOUNDS)
    expect(p.alive).toBe(false)
  })

  it('气球升到 burstY 时触发绽放并回收', () => {
    const system = new ParticleSystem(2)
    const p = makeBalloon(system)
    const bursts = []
    system.onBurst = (balloon) => bursts.push({ x: balloon.x, y: balloon.y })

    system.update(1, BOUNDS)
    expect(p.y).toBeCloseTo(300, 5)
    expect(p.alive).toBe(true)

    system.update(2, BOUNDS)
    expect(p.alive).toBe(false)
    expect(bursts).toHaveLength(1)
    expect(bursts[0].y).toBeLessThanOrEqual(200)
  })

  it('生命耗尽后被回收', () => {
    const system = new ParticleSystem(2)
    const p = makeShard(system)
    p.maxLife = 0.5
    system.update(0.6, BOUNDS)
    expect(p.alive).toBe(false)
  })

  it('dt 内所有粒子位移与速度成正比', () => {
    const system = new ParticleSystem(2)
    const p = makeShard(system)
    system.update(0.5, BOUNDS)
    expect(p.y).toBeCloseTo(130, 5)
    system.update(0.25, BOUNDS)
    expect(p.y).toBeCloseTo(145, 5)
  })
})

describe('归位凝形', () => {
  function makeHoming(system, owner = 'cake') {
    const p = system.spawn(owner)
    p.kind = SPARK
    p.x = 0
    p.y = 0
    p.targetX = 100
    p.targetY = 50
    p.pull = 0.5
    p.homing = true
    p.settle = false
    p.wait = 0
    p.size = 10
    p.alpha = 1
    p.fadeIn = 0
    p.maxLife = 1e9
    p.fadeOut = 0
    return p
  }

  it('等待期结束立刻转为停驻：清速度并按系数逼近目标', () => {
    const system = new ParticleSystem(2)
    const p = makeHoming(system)
    p.vx = 500
    p.vy = -500

    system.update(0.016, BOUNDS)

    expect(p.settle).toBe(true)
    expect(p.vx).toBe(0)
    expect(p.vy).toBe(0)
    // 与实现同源的期望值：k = 1 - (1 - pull)^(dt * 60)
    const k = 1 - Math.pow(0.5, 0.016 * 60)
    expect(p.x).toBeCloseTo(100 * k, 5)
    expect(p.y).toBeCloseTo(50 * k, 5)
  })

  it('delay 未到时保持自由漂移，不提前被牵引', () => {
    const system = new ParticleSystem(2)
    const p = makeHoming(system)
    p.wait = 1
    p.vx = 100
    p.vy = 0

    system.update(0.5, BOUNDS)

    expect(p.settle).toBe(false)
    expect(p.x).toBeCloseTo(50, 5)
  })

  it('停驻后目标再远也不会被边界回收', () => {
    const system = new ParticleSystem(2)
    const p = makeHoming(system)
    p.targetX = 5000
    p.targetY = 5000
    for (let i = 0; i < 12; i++) system.update(0.016, BOUNDS)
    expect(p.alive).toBe(true)
  })

  it('关掉 homing 后不再受目标点牵引', () => {
    const system = new ParticleSystem(2)
    const p = makeHoming(system)
    p.homing = false
    p.pull = 0
    p.vx = 100
    p.vy = 0

    system.update(0.1, BOUNDS)

    expect(p.settle).toBe(false)
    expect(p.x).toBeCloseTo(10, 5)
  })
})
