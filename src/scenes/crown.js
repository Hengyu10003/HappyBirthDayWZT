import { config } from '../config.js'
import { SPARK, BALLOON, LAYER_BACK, LAYER_FRONT } from '../fx/particles.js'

const OWNER = 'crown'
/** 开场引子的星光单独一个 owner，这样汇聚只作用在它们身上，不会带走气球或氛围星光 */
const LEAD_OWNER = 'crownLead'
const MS = 1000
const TAU = Math.PI * 2
const TIGHTEST = 10 // 蚁球收紧到的最小半径（像素）

const rand = (min, max) => min + Math.random() * (max - min)
const pick = (list) => list[(Math.random() * list.length) | 0]

/**
 * 最后一幕：气球升空 + 自己放烟花。
 *
 * 引子过后气球不断从下方升起。按住画面任意位置，气球会像蚁球一样朝按住的地方
 * 聚拢、越攥越紧；松手时落点附近的气球一起炸开，并在落点补上一簇烟花。
 * 攥得越久聚得越拢，一次放出来的烟花就越大。
 *
 * （文件名沿用，实际已不含皇冠与人脸识别。）
 */
export function createCrownScene({ stage, system, runtime, dom }) {
  const cfg = config.scenes.crown

  let emitTimer = 0
  let ambientTimer = 0
  let leadEmitted = false
  let leadPulled = false
  let holding = false
  let holdX = 0
  let holdY = 0
  let hintShown = false
  let linesShown = false
  /** 当前这一幕已经跑了多久（秒）；事件回调里拿不到 elapsed，靠它记一份 */
  let sceneTime = 0
  /** 短诗开始铺的时刻（秒） */
  let poemStart = -1
  /** 短诗铺完、开始接受点击的时刻到了没有 */
  let poemReady = false
  /** 末句那张是否已经被点开 */
  let finalShown = false

  function spawnBalloon() {
    const w = stage.width
    const h = stage.height
    const layer = Math.random() < 0.55 ? LAYER_FRONT : LAYER_BACK
    const p = system.emitBalloon(OWNER, {
      x: rand(w * 0.06, w * 0.94),
      y: h + rand(50, 150),
      size: rand(30, 46) * (layer === LAYER_FRONT ? 1.1 : 1),
      color: pick(config.colors.balloon),
      speed: rand(58, 104),
      swayAmp: rand(10, 26),
      swayFreq: rand(0.35, 0.75),
      layer,
      burstY: h * rand(0.15, 0.25),
    })
    // 正被攥着时新生成的气球也加入蚁球，从出场位置飞过去
    if (p && holding) grab(p, rand(120, 260))
    return p
  }

  /** 让一只气球加入蚁球：给它一个绕中心自转的相位与半径 */
  function grab(p, radius = rand(20, 70)) {
    p.gather = true
    p.gatherAngle = rand(0, TAU)
    p.gatherRadius = radius
    // 先把目标点落在原地，否则系统会在算出真正的目标前，让它朝 (0,0) 窜一帧
    p.targetX = p.x
    p.targetY = p.y
  }

  function showHint() {
    if (hintShown) return
    hintShown = true
    dom.playHint.classList.add('is-on')
  }

  function hideHint() {
    if (!hintShown) return
    hintShown = false
    dom.playHint.classList.remove('is-on')
  }

  /** 短诗整屏收走，把位置让给末句那张 */
  function revealFinal() {
    if (finalShown) return
    finalShown = true
    dom.wishLines.classList.add('is-final')
    dom.tapHint.classList.remove('is-on')
  }

  function onHold(event) {
    // 短诗铺完后的这一次点击专门用来切到末句那张，不参与攥气球，
    // 否则切换的同时还会把气球拽过来炸掉，画面太乱。
    if (poemReady && !finalShown) {
      revealFinal()
      return
    }

    holding = true
    holdX = event.clientX
    holdY = event.clientY
    hideHint()
    system.eachKind(OWNER, BALLOON, (p) => grab(p))
  }

  /**
   * 松手：落点附近的气球一起炸开，在落点炸一发铺满屏幕的烟花，并第一次亮出那段短诗。
   *
   * 爆炸范围是叠加的 —— 攥住的气球越多，这一发就越大：星光数量按只数往上加，
   * 初速（决定炸开的半径）也在基准上按只数往上抬。攥得越久聚得越拢、落点附近
   * 够得着的气球就越多，一次炸开的规模自然就叠上去了。
   */
  function onRelease(event) {
    if (!holding) return
    holding = false

    const x = Number.isFinite(event.clientX) ? event.clientX : holdX
    const y = Number.isFinite(event.clientY) ? event.clientY : holdY

    const popped = system.releaseGathered(OWNER, x, y, cfg.popRadius)
    const speedGain = 1 + cfg.speedGainPerBalloon * popped

    system.emitBurst(
      OWNER,
      x,
      y,
      Math.round((cfg.fireworkSparks + cfg.sparkPerBalloon * popped) * runtime.quality),
      config.colors.spark,
      {
        speedRange: [cfg.fireworkSpeed[0] * speedGain, cfg.fireworkSpeed[1] * speedGain],
        gravityRange: [34, 92],
        lifeRange: cfg.fireworkLife,
        sizeRange: [10, 26],
        upwardBias: 40,
      },
    )

    // 只有第一次松手才亮出来，之后照旧可以继续攥气球放烟花
    if (!linesShown) {
      linesShown = true
      poemStart = sceneTime
      dom.wishLines.classList.add('is-on')
    }
  }

  const scene = {
    name: OWNER,
    // 最后一幕：气球升空 → 按住聚成蚁球 → 松手放烟花，一直循环，不再切换

    enter() {
      emitTimer = 0
      ambientTimer = 0
      leadEmitted = false
      leadPulled = false
      holding = false
      hintShown = false
      linesShown = false
      sceneTime = 0
      poemStart = -1
      poemReady = false
      finalShown = false
      showHint()

      system.onBurst = (balloon) => {
        system.emitBurst(
          OWNER,
          balloon.x,
          balloon.y,
          Math.round(cfg.sparkPerBurst * runtime.quality),
          config.colors.spark,
          {
            speedRange: [90, 340],
            gravityRange: [30, 74],
            lifeRange: [1.8, 3],
          },
        )
      }

      // 换幕的那一次点击正在派发中。等这一轮事件走完再挂监听，
      // 否则那次点击会被接下来的 pointerup 当成一次「按住又松手」。
      setTimeout(() => {
        window.addEventListener('pointerdown', onHold)
        window.addEventListener('pointerup', onRelease)
        window.addEventListener('pointercancel', onRelease)
      }, 0)
    },

    update(dt, elapsed) {
      sceneTime = elapsed

      // 短诗铺完，亮出「轻触继续」，这一次点击专门用来切到末句那张
      if (linesShown && !finalShown && !poemReady && elapsed - poemStart >= cfg.poemHold / MS) {
        poemReady = true
        dom.tapHint.classList.add('is-on')
      }

      // 开场引子：一片星光先汇聚过来、再自己淡掉
      if (!leadEmitted) {
        leadEmitted = true
        system.emitStarlight(LEAD_OWNER, Math.round(cfg.leadStars * runtime.quality), stage.width, stage.height, {
          centerBias: 0.3,
          speed: 12,
          life: [3, 3.8],
          fadeOut: [1.2, 1.6],
          alpha: 0.9,
        })
      }
      if (!leadPulled && elapsed >= cfg.leadPullAt / MS) {
        leadPulled = true
        system.setPull(LEAD_OWNER, 0.01, stage.width / 2, stage.height / 2)
      }

      // 引子散尽之后才开始放气球，并补上常驻氛围星光
      if (elapsed >= cfg.leadUntil / MS) {
        ambientTimer -= dt
        if (ambientTimer <= 0) {
          ambientTimer = 2
          const deficit = Math.round(cfg.ambientSparks * runtime.quality) - system.liveCount(OWNER, SPARK)
          if (deficit > 0) {
            system.emitStarlight(OWNER, Math.min(deficit, 20), stage.width, stage.height, {
              centerBias: 0.2,
              speed: 7,
              life: [4e5, 4e5],
              alpha: 0.42,
              sizeRange: [8, 26],
              topInset: 0,
            })
          }
        }

        emitTimer -= dt
        if (emitTimer <= 0) {
          emitTimer = (cfg.balloonInterval / MS) * rand(0.75, 1.3)
          if (system.liveCount(OWNER, BALLOON) < cfg.maxBalloons * runtime.quality) spawnBalloon()
        }
      }

      // 蚁球：每帧算出每只气球该待的位置 —— 绕按住的地方缓慢自转，并逐渐收紧
      if (holding) {
        const spin = elapsed * cfg.spinSpeed
        system.eachKind(OWNER, BALLOON, (p) => {
          if (!p.gather) return
          p.gatherRadius = Math.max(TIGHTEST, p.gatherRadius - cfg.gatherTighten * dt)
          const angle = spin + p.gatherAngle
          p.targetX = holdX + Math.cos(angle) * p.gatherRadius
          p.targetY = holdY + Math.sin(angle) * p.gatherRadius
        })
      }
    },

    draw(ctx, alpha, layer) {
      const target = layer === 'front' ? LAYER_FRONT : LAYER_BACK
      system.draw(ctx, alpha, target, stage.dpr)
    },

    exit() {
      system.onBurst = null
      system.releaseByOwner(OWNER)
      system.releaseByOwner(LEAD_OWNER)
      window.removeEventListener('pointerdown', onHold)
      window.removeEventListener('pointerup', onRelease)
      window.removeEventListener('pointercancel', onRelease)
      hideHint()
      dom.tapHint.classList.remove('is-on')
      dom.wishLines.classList.remove('is-on')
      dom.wishLines.classList.remove('is-final')
    },
  }

  return scene
}
